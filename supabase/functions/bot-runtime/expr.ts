// Tiny safe expression evaluator for bot logic.
// Grammar (recursive descent):
//   expr     := or
//   or       := and ( '||' and )*
//   and      := not ( '&&' not )*
//   not      := '!' not | cmp
//   cmp      := add ( ( '==' | '!=' | '>=' | '<=' | '>' | '<' ) add )?
//   add      := mul ( ( '+' | '-' ) mul )*
//   mul      := unary ( ( '*' | '/' | '%' ) unary )*
//   unary    := '-' unary | primary
//   primary  := number | string | bool | null | ident ( '.' ident )* | '(' expr ')'
//
// Identifiers resolve against a context object (e.g. { var: {...}, user: {...}, text: "..." }).
// No function calls, no member assignment, no `eval`. Hard cap on input size.

export type ExprValue = string | number | boolean | null | undefined | Record<string, unknown>;
export type ExprContext = Record<string, ExprValue>;

const MAX_LEN = 2000;

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "dot" };

function tokenize(src: string): Token[] {
  if (src.length > MAX_LEN) throw new Error("expression too long");
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ".") { out.push({ t: "dot" }); i++; continue; }
    // strings
    if (c === '"' || c === "'") {
      const quote = c; i++;
      let s = "";
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < src.length) { s += src[i + 1]; i += 2; continue; }
        s += src[i++];
      }
      if (src[i] !== quote) throw new Error("unterminated string");
      i++;
      out.push({ t: "str", v: s });
      continue;
    }
    // numbers
    if ((c >= "0" && c <= "9") || (c === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j; continue;
    }
    // operators (multi-char first)
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two }); i += 2; continue;
    }
    if ("+-*/%<>!".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    // identifiers
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: "ident", v: src.slice(i, j) });
      i = j; continue;
    }
    throw new Error(`unexpected char '${c}' at ${i}`);
  }
  return out;
}

export function evalExpr(src: string, ctx: ExprContext): unknown {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];
  const expect = (t: Token["t"], v?: string) => {
    const tok = tokens[pos];
    if (!tok || tok.t !== t || (v !== undefined && (tok as any).v !== v)) {
      throw new Error(`expected ${t}${v ? " " + v : ""} at ${pos}`);
    }
    return tokens[pos++];
  };

  const parseExpr = (): unknown => parseOr();

  const parseOr = (): unknown => {
    let left = parseAnd();
    while (peek()?.t === "op" && (peek() as any).v === "||") {
      eat(); const right = parseAnd();
      left = truthy(left) ? left : right;
    }
    return left;
  };

  const parseAnd = (): unknown => {
    let left = parseNot();
    while (peek()?.t === "op" && (peek() as any).v === "&&") {
      eat(); const right = parseNot();
      left = truthy(left) ? right : left;
    }
    return left;
  };

  const parseNot = (): unknown => {
    if (peek()?.t === "op" && (peek() as any).v === "!") { eat(); return !truthy(parseNot()); }
    return parseCmp();
  };

  const parseCmp = (): unknown => {
    const left = parseAdd();
    const op = peek();
    if (op?.t === "op" && ["==", "!=", ">", "<", ">=", "<="].includes((op as any).v)) {
      eat(); const right = parseAdd();
      const a = left as any, b = right as any;
      switch ((op as any).v) {
        case "==": return a == b;
        case "!=": return a != b;
        case ">": return a > b;
        case "<": return a < b;
        case ">=": return a >= b;
        case "<=": return a <= b;
      }
    }
    return left;
  };

  const parseAdd = (): unknown => {
    let left = parseMul();
    while (peek()?.t === "op" && ["+", "-"].includes((peek() as any).v)) {
      const op = (eat() as any).v;
      const right = parseMul();
      if (op === "+") left = (left as any) + (right as any);
      else left = Number(left) - Number(right);
    }
    return left;
  };

  const parseMul = (): unknown => {
    let left = parseUnary();
    while (peek()?.t === "op" && ["*", "/", "%"].includes((peek() as any).v)) {
      const op = (eat() as any).v;
      const right = parseUnary();
      const a = Number(left), b = Number(right);
      left = op === "*" ? a * b : op === "/" ? a / b : a % b;
    }
    return left;
  };

  const parseUnary = (): unknown => {
    if (peek()?.t === "op" && (peek() as any).v === "-") { eat(); return -Number(parseUnary()); }
    return parsePrimary();
  };

  const parsePrimary = (): unknown => {
    const tok = peek();
    if (!tok) throw new Error("unexpected end");
    if (tok.t === "num") { eat(); return tok.v; }
    if (tok.t === "str") { eat(); return tok.v; }
    if (tok.t === "lp") { eat(); const v = parseExpr(); expect("rp"); return v; }
    if (tok.t === "ident") {
      const name = (eat() as any).v as string;
      if (name === "true") return true;
      if (name === "false") return false;
      if (name === "null") return null;
      let cur: any = ctx[name];
      while (peek()?.t === "dot") {
        eat();
        const id = expect("ident") as any;
        cur = cur == null ? undefined : cur[id.v];
      }
      return cur;
    }
    throw new Error(`unexpected token ${tok.t}`);
  };

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error(`trailing tokens at ${pos}`);
  return result;
}

function truthy(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "boolean") return v;
  return true;
}
