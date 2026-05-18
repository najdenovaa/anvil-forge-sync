## Big-bang: личные кабинеты ANVL

Email-аккаунт владельца: **najdenovaa@gmail.com**, auto-confirm **OFF** (нужна верификация по письму).

---

### 1. БД-миграция

- `flows.owner_id uuid NULL` (FK на `auth.users(id)`, ON DELETE SET NULL)
- `bots.owner_id uuid NULL` (FK на `auth.users(id)`, ON DELETE SET NULL)
- Индексы по `owner_id` на обеих таблицах
- `flow_versions` — owner-фильтр идёт через `flow_id → flows.owner_id` (доп. колонку не добавляем)
- `bot_sessions`, `bot_events`, `bot_user_state`, `bot_globals` — owner-фильтр идёт через `bot_id → bots.owner_id` (доп. колонок не добавляем; runtime эти таблицы уже пишет от service-role)

### 2. RLS — переписываем с публичных на owner-scoped

- **`flows`**: SELECT/UPDATE/DELETE — `owner_id = auth.uid() OR owner_id IS NULL`. INSERT — `owner_id = auth.uid()`. Условие `OR IS NULL` нужно ровно для одноразового claim; после claim ни одной NULL-строки не останется.
- **`bots`**: то же самое.
- **`flow_versions`**: SELECT/INSERT через EXISTS-subquery к `flows` (owner совпадает).
- **`bot_sessions`, `bot_events`, `bot_user_state`, `bot_globals`**: SELECT для owner'а бота, остальные операции (INSERT/UPDATE/DELETE) только сервис-роль (runtime использует service-role-key, поэтому RLS на запись не нужен → политики только `SELECT WHERE owner совпадает`).

### 3. Auth UI

- Маршрут `/auth` — табы Signup / Login / Forgot password
- Маршрут `/reset-password` (обязателен для recovery flow)
- `signUp` с `emailRedirectTo: window.location.origin + '/auth'`
- TopBar: показывает email текущего юзера + кнопка Logout
- Глобальный `onAuthStateChange` listener (single source of truth)

### 4. Защита роутов

- `_authenticated` layout-route с `beforeLoad` → redirect `/auth` если не залогинен
- Переносим внутрь: `flows.index`, `flows.$slug`
- Публичными остаются: `/`, `/auth`, `/reset-password`, `/m/$flowId` (Mini App для конечных юзеров бота — НЕ для ANVL-аккаунтов)

### 5. Claim существующих ресурсов

Один раз, после первой регистрации najdenovaa@gmail.com:

- В `FlowsList` показываем баннер: «Найдено N flows без владельца. Привязать к моему аккаунту» → кнопка вызывает server fn `claimOrphanResources` (`createServerFn` + `requireSupabaseAuth` + `supabaseAdmin`), которая делает `UPDATE flows/bots SET owner_id = userId WHERE owner_id IS NULL`.
- Баннер пропадает когда NULL-строк нет.

### 6. Wire-up создания

- `useFlowPersistence` / места создания flow и bot: при INSERT передаём `owner_id: session.user.id`
- Architect (`architect-chat`) и `deploy-bot` — проверить, что они не создают записи без owner_id (если создают — берём owner_id из auth-контекста запроса)

### 7. Что НЕ трогаем в этот раунд

- Существующая логика bot-runtime (он на service-role, RLS его не аффектит)
- TG Mini App страница `/m/$flowId` — публичная, без auth
- Расшаринг flows между несколькими ANVL-юзерами (пока единоличное владение)

---

### Технические детали

**Файлы (новые)**:
- `supabase/migrations/<ts>_owner_id_and_rls.sql`
- `src/routes/auth.tsx`, `src/routes/reset-password.tsx`
- `src/routes/_authenticated.tsx` (pathless layout)
- `src/routes/_authenticated/flows.index.tsx`, `src/routes/_authenticated/flows.$slug.tsx` (move)
- `src/lib/owner.functions.ts` (server fn `claimOrphanResources`)
- `src/hooks/useAuth.tsx` (context + `onAuthStateChange`)

**Файлы (edit)**:
- `src/routes/__root.tsx` — повесить `onAuthStateChange` + `router.invalidate()`
- `src/components/anvl/TopBar.tsx` — email + Logout
- `src/components/anvl/FlowsList.tsx` — claim-баннер, INSERT с owner_id
- `src/components/anvl/useFlowPersistence.ts` — owner_id при создании
- `src/start.ts` — убедиться что `attachSupabaseAuth` подключён
- удаляем старые `src/routes/flows.index.tsx`, `src/routes/flows.$slug.tsx`

**Порядок применения** (важно для big-bang без даунтайма):
1. Миграция: добавляем owner_id колонки (NULL), индексы. RLS пока НЕ трогаем.
2. Деплоим UI с auth + claim-баннером.
3. Ты регистрируешься najdenovaa@gmail.com → верифицируешь email → жмёшь Claim.
4. **Вторая миграция** (после шага 3): переписываем RLS на owner-scoped. До этого момента анонимный доступ продолжает работать.

Если шаг 4 откатить, всё остаётся рабочим (просто без owner-проверки).

### Что ты подтверждаешь, прежде чем я начну

- Email **najdenovaa@gmail.com** — корректный, доступен для получения письма верификации
- Двухшаговый порядок (UI → claim → RLS-tighten) — ОК, или жмёшь big-bang за один проход (рискованно, NULL-строки могут потеряться если что-то пойдёт не так)
