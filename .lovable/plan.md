## Шаг 10, раунд 2.5 — починка цикла обхода и переход на trigger.callback

### Корневая причина

`bot-runtime` обходит граф через `goNext()` после `keyboard.inline` и `message.text`. Существующая структура меню («keyboard → message → back_kb → message → keyboard …») образует цикл, который ограничивается только хардкап-капом 50 шагов. На каждый /start бот шлёт ~10–25 сообщений подряд. Composite tool из раунда 1 повторил тот же паттерн и добавил ещё одну ветку цикла.

Корректная архитектура: `keyboard.inline` — терминальный узел (после прикрепления клавиатуры обход останавливается). Маршрутизация нажатий идёт через `trigger.callback`-ноды, у которых `params.data` совпадает с `callback_data` кнопки.

---

### Изменения

**1. `supabase/functions/bot-runtime/index.ts` — keyboard.inline терминальный**

В `runNode` для `case "keyboard.inline"`: после установки `pendingKeyboard` возвращать `null` (а не `goNext()`). Это останавливает автообход. Идентично для `keyboard.reply`.

Пограничный случай: ранее `keyboard.inline` ставил клавиатуру и шёл дальше к `message.text`, который её и прикреплял. Теперь правильный порядок: `message.text` → `keyboard.inline` (терминал). Но runtime читает `pendingKeyboard` ВНУТРИ `message.text`, т.е. клавиатура должна быть установлена ДО сообщения. Меняю порядок: для каждой пары (msg, kb) делаем `kb` родителем msg в графе, либо — проще — переписываю `message.text`: если у узла есть исходящее ребро к `keyboard.inline`, заглядываем туда наперёд, читаем buttons, прикрепляем; затем после отправки возвращаем `null` (не идём дальше через keyboard, чтобы не зациклиться).

Решение чище: в `runNode/message.text` искать «сосед-keyboard» в исходящих рёбрах, если есть — рендерить его кнопки прямо здесь, отправить с reply_markup, вернуть `null`. Старый `pendingKeyboard`-поток удаляется.

**2. `AnvlWorkspaceContext.tsx` — переписать composite tools**

`addMenuSection` теперь принимает дополнительный `menu_msg_id` (msg-узел, который пара к `menu_id`-keyboard). Создаёт:

```
trigger.callback (data=callback_data)  →  section_msg  →  back_kb
trigger.callback (data="back_to_menu") →  menu_msg     →  menu_kb     [идемпотентно]
```

Кнопка возврата в `back_kb` имеет `callback_data="back_to_menu"`. Кнопка раздела в `menu_kb` имеет `action=callback_data` (без префикса `screen:`).

`removeMenuSection` — удаляет section trigger.callback, msg, back_kb и их рёбра.

`updateMenuSection` — без структурных изменений (только лейбл/контент).

**3. `supabase/functions/architect-chat/index.ts` — обновить описание tool'ов в BASE_PROMPT**

Зафиксировать: `keyboard.inline` — терминальный, маршрутизация через `trigger.callback`. Добавить параметр `menu_msg_id` в схему `add_menu_section`.

**4. Миграция канваса барбершопа** (`flow-34b84919`)

Одноразовое SQL-обновление поля `flows.nodes/edges`:
- Удалить рёбра `n4_main_kb → {n7_booking,n5_prices,n6_contacts,promos_msg}`.
- Удалить рёбра `back_kb → menu_msg`.
- Заменить `action:"screen:n7_booking"` в кнопках `n4_main_kb` на `callback_data:"go_booking"` и т.п. (короткие данные ≤64 байт).
- Создать 5 `trigger.callback`-нод: 4 для разделов (data=`go_booking|go_prices|go_contacts|go_promos`) → соответствующий msg, и 1 для возврата (data=`back_to_menu`) → `n3_main_menu`.
- Заменить кнопки в `n8_back_kb`/`n10_back_booking`/`promos_back_kb` на `callback_data:"back_to_menu"`.

Применяется через `supabase--migration` (UPDATE flows SET nodes=..., edges=...).

---

### Валидация

1. Деплой `bot-runtime`. На `/start` бот барбершопа отправляет ровно одно сообщение «Привет, …» с 4 кнопками — без флуда.
2. Тап «📅 Записаться» → одно сообщение «Запись принята» с кнопкой «Назад». Тап «Назад» → одно сообщение главного меню.
3. Канвас на `/flows/flow-34b84919` визуально показывает 5 новых `trigger.callback`-нод и пересобранные рёбра.
4. История канваса (кнопка History) хранит предыдущую версию для отката.
5. Typecheck чист.

### Технические детали для Architect (раунд 3)

Сигнатура `add_menu_section` после фикса:
```
{ menu_id, menu_msg_id, button_label, callback_data, content_kind, content, section_id, back_label? }
```

Architect в режиме BUILD должен сначала создать `trigger.command → action.input → message.text(menu_msg) → keyboard.inline(menu_kb)` (терминальная цепочка), затем для каждого раздела звать `add_menu_section` с обоими id.

