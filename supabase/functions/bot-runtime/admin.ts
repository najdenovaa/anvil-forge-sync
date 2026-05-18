// Admin router — handles owner-only commands sent to the bot via Telegram.
// The owner is identified by `bots.owner_tg_username` (set at deploy time) or
// by `bots.owner_tg_user_id` (captured on first /start from the owner).
//
// When an incoming update is from the owner AND its text starts with one of
// the admin commands, the router handles it and returns true — the main
// pipeline then skips normal flow execution for this turn.

interface AdminBot {
  id: string;
  owner_tg_username: string | null;
  owner_tg_user_id: string | null;
}

interface AdminFrom {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

const ADMIN_COMMANDS = new Set([
  "/admin",
  "/leads",
  "/clients",
  "/broadcast",
  "/content",
  "/set",
  "/stats",
  "/help_admin",
]);

// Telegram bots accept commands like `/leads@MyBot` — strip the @bot suffix.
function normCmd(raw: string): string {
  const head = raw.split(/\s+/)[0] ?? "";
  return head.split("@")[0].toLowerCase();
}

/** True if this update is from the bot's owner. May write `owner_tg_user_id`
 *  back to the bots row when matching by username for the first time. */
export async function identifyOwner(
  supa: any,
  bot: AdminBot,
  from: AdminFrom,
): Promise<boolean> {
  const tgUserId = from?.id != null ? String(from.id) : "";
  const tgUsername = (from?.username ?? "").toLowerCase();

  if (bot.owner_tg_user_id && tgUserId && bot.owner_tg_user_id === tgUserId) {
    return true;
  }
  if (
    bot.owner_tg_username &&
    tgUsername &&
    bot.owner_tg_username.toLowerCase().replace(/^@/, "") === tgUsername
  ) {
    if (tgUserId && !bot.owner_tg_user_id) {
      await supa.from("bots").update({ owner_tg_user_id: tgUserId }).eq("id", bot.id);
      bot.owner_tg_user_id = tgUserId;
    }
    return true;
  }
  return false;
}

async function tgSend(token: string, chatId: string, text: string, extra: Record<string, unknown> = {}) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...extra,
    }),
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

function valuePreview(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && v && "v" in (v as any) && Object.keys(v as any).length === 1) {
    return valuePreview((v as any).v);
  }
  const s = JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

/** Returns true if the command was handled — caller should skip flow execution. */
export async function handleAdminCommand(
  supa: any,
  bot: AdminBot & { flow_id: string },
  token: string,
  chatId: string,
  from: AdminFrom,
  text: string,
): Promise<boolean> {
  const trimmed = (text ?? "").trim();
  if (!trimmed.startsWith("/")) return false;
  const cmd = normCmd(trimmed);
  if (!ADMIN_COMMANDS.has(cmd)) return false;

  const isOwner = await identifyOwner(supa, bot, from);
  if (!isOwner) {
    // Silently ignore admin commands from non-owners — let normal flow handle them
    // (e.g. /start is also in flows). Only ban admin-specific ones.
    if (cmd === "/admin" || cmd === "/leads" || cmd === "/broadcast" || cmd === "/content" || cmd === "/set" || cmd === "/stats" || cmd === "/clients" || cmd === "/help_admin") {
      return false;
    }
    return false;
  }

  const args = trimmed.slice(cmd.length).trim();

  switch (cmd) {
    case "/admin":
    case "/help_admin": {
      await tgSend(
        token,
        chatId,
        [
          "🛠 *Админ-панель бота*",
          "",
          "Команды управления:",
          "• `/leads` — последние заявки клиентов",
          "• `/clients` — количество и список пользователей бота",
          "• `/broadcast <текст>` — отправить сообщение всем пользователям",
          "• `/content` — посмотреть глобальные переменные бота",
          "• `/set <ключ> <значение>` — изменить переменную (например `/set price 1500`)",
          "• `/stats` — статистика бота",
          "• `/help_admin` — эта справка",
        ].join("\n"),
      );
      return true;
    }

    case "/leads": {
      const { data: leads } = await supa
        .from("bot_submissions")
        .select("created_at, kind, status, tg_username, tg_user_full_name, payload, source_node_id")
        .eq("bot_id", bot.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!leads || leads.length === 0) {
        await tgSend(token, chatId, "📭 Заявок пока нет.");
        return true;
      }
      const lines = ["📥 *Последние заявки:*", ""];
      for (const l of leads) {
        const who = l.tg_username ? `@${l.tg_username}` : (l.tg_user_full_name ?? "—");
        const payloadStr = l.payload && typeof l.payload === "object"
          ? Object.entries(l.payload).map(([k, v]) => `${k}: ${valuePreview(v)}`).join(", ")
          : "";
        lines.push(`• *${fmtDate(l.created_at)}* — ${who} _(${l.status})_`);
        if (payloadStr) lines.push(`  ${payloadStr}`);
      }
      await tgSend(token, chatId, lines.join("\n"));
      return true;
    }

    case "/clients": {
      const { count } = await supa
        .from("bot_user_state")
        .select("tg_user_id", { count: "exact", head: true })
        .eq("bot_id", bot.id);
      const { data: recent } = await supa
        .from("bot_user_state")
        .select("tg_user_id, last_seen_at, vars")
        .eq("bot_id", bot.id)
        .order("last_seen_at", { ascending: false })
        .limit(10);
      const lines = [`👥 *Всего пользователей: ${count ?? 0}*`, "", "Последние активные:"];
      for (const u of recent ?? []) {
        const name = (u.vars as any)?.first_name ?? (u.vars as any)?.username ?? `id ${u.tg_user_id}`;
        lines.push(`• ${name} — ${fmtDate(u.last_seen_at)}`);
      }
      await tgSend(token, chatId, lines.join("\n"));
      return true;
    }

    case "/broadcast": {
      if (!args) {
        await tgSend(token, chatId, "Использование: `/broadcast <текст сообщения>`\n\nСообщение будет отправлено всем пользователям бота.");
        return true;
      }
      // Collect all unique chat_ids from bot_sessions
      const { data: sessions } = await supa
        .from("bot_sessions")
        .select("chat_id")
        .eq("bot_id", bot.id);
      const chats = Array.from(new Set((sessions ?? []).map((s: any) => String(s.chat_id))));
      if (chats.length === 0) {
        await tgSend(token, chatId, "📭 Нет пользователей для рассылки.");
        return true;
      }
      await tgSend(token, chatId, `📣 Запускаю рассылку для ${chats.length} пользователей…`);

      let sent = 0;
      let failed = 0;
      for (const cid of chats) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cid, text: args }),
          });
          if (r.ok) sent++; else failed++;
        } catch { failed++; }
        // Telegram rate limit: ~30 msg/sec. Sleep 50ms between sends.
        await new Promise((r) => setTimeout(r, 50));
      }

      await supa.from("bot_broadcasts").insert({
        bot_id: bot.id,
        flow_id: bot.flow_id,
        text: args,
        status: "done",
        sent_count: sent,
        fail_count: failed,
        recipients_total: chats.length,
        sent_at: new Date().toISOString(),
      });

      await tgSend(token, chatId, `✅ Рассылка завершена.\n\nОтправлено: ${sent}\nОшибок: ${failed}`);
      return true;
    }

    case "/content": {
      const { data: globals } = await supa
        .from("bot_globals")
        .select("key, label, value")
        .eq("bot_id", bot.id)
        .order("key");
      if (!globals || globals.length === 0) {
        await tgSend(
          token,
          chatId,
          "📦 Глобальных переменных нет.\n\nДобавь любую переменную командой:\n`/set <ключ> <значение>`",
        );
        return true;
      }
      const lines = ["📦 *Контент бота*", "", "В сценарии используются как `{var.ключ}`:", ""];
      for (const g of globals) {
        const label = g.label ? ` _(${g.label})_` : "";
        lines.push(`• \`${g.key}\`${label}\n  ${valuePreview(g.value)}`);
      }
      lines.push("", "Изменить: `/set <ключ> <новое значение>`");
      await tgSend(token, chatId, lines.join("\n"));
      return true;
    }

    case "/set": {
      const m = args.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([\s\S]+)$/);
      if (!m) {
        await tgSend(token, chatId, "Использование: `/set ключ значение`\n\nПример: `/set price 1500`");
        return true;
      }
      const [, key, rawValue] = m;
      const value = rawValue.trim();
      const { error } = await supa
        .from("bot_globals")
        .upsert(
          {
            bot_id: bot.id,
            key,
            value: value as unknown as never,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "bot_id,key" },
        );
      if (error) {
        await tgSend(token, chatId, `❌ Ошибка: ${error.message}`);
      } else {
        await tgSend(token, chatId, `✅ Сохранено: \`{var.${key}}\` = ${valuePreview(value)}`);
      }
      return true;
    }

    case "/stats": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

      const [{ count: usersTotal }, { count: leadsTotal }, { count: leadsToday }, { count: leadsWeek }] = await Promise.all([
        supa.from("bot_user_state").select("*", { count: "exact", head: true }).eq("bot_id", bot.id),
        supa.from("bot_submissions").select("*", { count: "exact", head: true }).eq("bot_id", bot.id),
        supa.from("bot_submissions").select("*", { count: "exact", head: true }).eq("bot_id", bot.id).gte("created_at", today.toISOString()),
        supa.from("bot_submissions").select("*", { count: "exact", head: true }).eq("bot_id", bot.id).gte("created_at", weekAgo.toISOString()),
      ]);

      await tgSend(
        token,
        chatId,
        [
          "📊 *Статистика бота*",
          "",
          `👥 Пользователей всего: *${usersTotal ?? 0}*`,
          `📥 Заявок всего: *${leadsTotal ?? 0}*`,
          `   за сегодня: *${leadsToday ?? 0}*`,
          `   за 7 дней: *${leadsWeek ?? 0}*`,
        ].join("\n"),
      );
      return true;
    }
  }

  return false;
}
