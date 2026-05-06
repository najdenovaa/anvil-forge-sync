# Step 2A — Template engine tests

## Setup

In Anvl create a minimal flow:

- `trigger.command` `/start`
- `message.text` with body:

      Привет, {first_name}! Сегодня {system.today}.

Deploy via the existing `deploy-bot` flow (no changes to that endpoint).

## Test 1 — End-to-end via Telegram

Send `/start` to the bot.

Expected reply: `Привет, <твоё_имя>! Сегодня 2026-05-06.`
(`system.today` uses the server clock, ru-RU formatting `YYYY-MM-DD`.)

## Test 2 — Logging

```sql
SELECT created_at, event_type, payload
FROM bot_events
WHERE bot_id = '<bot_id>' AND event_type = 'template_rendered'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: at least one row with
`payload.used_vars = ["first_name", "system.today"]` and
`payload.missing_vars = []`.

If you intentionally use a typo like `{frist_name}`, that key shows up in
`missing_vars` instead — handy for debugging "почему пусто".

## Test 3 — Simulator parity

Open the same flow in the canvas. The preview phone (after auto-play of the
welcome message or after pressing `/start`) should show:

    Привет, Саша! Сегодня <today>.

`Саша` is the hardcoded demo user (Step 11 will make this configurable).
The date should match Test 1 — both sides call `buildSystemContext()` from
`src/lib/template-shared.ts`.

## Test 4 — Variable in a button label

Edit the `keyboard.inline` buttons param to `Привет, {first_name}|hi`.
Expected: button label renders to `Привет, Саша` in the simulator and
`Привет, <твоё_имя>` in Telegram.
