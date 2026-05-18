// Client-side attachment parser for the AI assistant chat.
// Extracts text from PDF / DOCX / XLSX / CSV / TXT in the browser,
// and uses the `extract-image` edge function for images (OCR + description).

import { supabase } from "@/integrations/supabase/client";

export type ExtractedAttachment = {
  filename: string;
  kind: "image" | "pdf" | "docx" | "xlsx" | "text" | "unknown";
  text: string; // already trimmed / truncated
  bytes: number;
};

const MAX_TEXT = 15_000; // per file, ~ a few pages of dense text
const MAX_IMG_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function clip(s: string): string {
  const t = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + "\n…[обрезано]" : t;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

async function extractPdf(file: File): Promise<string> {
  // Use the legacy build to dodge worker setup issues in Vite.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable the worker — slower, but no need to host pdf.worker.js.
  // (Files in our use case are usually small.)
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
  let out = "";
  const maxPages = Math.min(doc.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(" ");
    out += `\n--- стр. ${i} ---\n${pageText}\n`;
    if (out.length > MAX_TEXT) break;
  }
  if (doc.numPages > maxPages) out += `\n[пропущено ${doc.numPages - maxPages} стр.]`;
  return out;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value ?? "";
}

async function extractXlsx(file: File): Promise<string> {
  const XLSX: any = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`### Лист: ${name}\n${csv}`);
    if (parts.join("\n").length > MAX_TEXT) break;
  }
  return parts.join("\n\n");
}

async function extractImage(file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const { data, error } = await supabase.functions.invoke("extract-image", {
    body: { dataUrl, filename: file.name },
  });
  if (error) throw new Error(error.message || "extract-image failed");
  return (data as any)?.text ?? "";
}

export async function extractAttachment(file: File): Promise<ExtractedAttachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Файл слишком большой (>${MAX_FILE_BYTES / 1024 / 1024} МБ)`);

  const name = file.name;
  const lower = name.toLowerCase();
  const mime = file.type || "";

  if (mime.startsWith("image/")) {
    if (file.size > MAX_IMG_BYTES) throw new Error("Изображение больше 8 МБ — сожмите.");
    const text = await extractImage(file);
    return { filename: name, kind: "image", text: clip(text), bytes: file.size };
  }
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const text = await extractPdf(file);
    return { filename: name, kind: "pdf", text: clip(text), bytes: file.size };
  }
  if (
    lower.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const text = await extractDocx(file);
    return { filename: name, kind: "docx", text: clip(text), bytes: file.size };
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    mime.includes("spreadsheet") ||
    mime === "text/csv"
  ) {
    const text = await extractXlsx(file);
    return { filename: name, kind: "xlsx", text: clip(text), bytes: file.size };
  }
  if (mime.startsWith("text/") || /\.(md|txt|json|ya?ml|log|tsv)$/i.test(lower)) {
    const text = await file.text();
    return { filename: name, kind: "text", text: clip(text), bytes: file.size };
  }

  throw new Error(`Формат не поддерживается: ${name}`);
}

export function formatAttachmentBlock(att: ExtractedAttachment): string {
  const header =
    att.kind === "image"
      ? `📎 Изображение: ${att.filename}`
      : `📎 Файл (${att.kind}): ${att.filename}`;
  return `${header}\n\`\`\`\n${att.text || "[пусто]"}\n\`\`\``;
}
