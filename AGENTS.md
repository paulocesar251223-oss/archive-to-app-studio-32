<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->


- Balance = SUM(ledger); ledger/bets/audit_log are immutable via triggers and written only server-side (service_role / post_ledger_entry). Why: tamper-proof money trail.
- Roles live in public.user_roles checked via has_role/is_staff security-definer functions. Why: prevents privilege escalation.
- Protected account screens live under the managed _authenticated layout and load through authenticated server functions; private data never enters public loaders.
- KYC uploads use user-owned private paths and are checked on the server before submit_kyc; file extensions and browser MIME alone are not trusted.
- Use a single root identity-transition subscriber and clear protected query caches before sign-out to prevent stale account data.
- Admin screens live under /admin in the authenticated subtree; every privileged server function checks role (MFA intentionally removed at owner request), and privileged writes go through audited SQL functions. Why: consistent server-side authorization and an immutable operations trail.
- Account profiles are created by the auth signup trigger; optional profile reads use maybeSingle and explicitly reject missing profiles. Why: remixed accounts must not crash with a single-row coercion error or bypass verification.
- Player shell and slots are isolated from KYC screens; game entry validates approval and self-exclusion server-side. Why: existing status routing stays intact.
- Responsible-play changes use authenticated server functions and service-only audited SQL functions; append-only limits/exclusions and a ledger trigger enforce restrictions. Why: browser requests cannot bypass financial safety rules.
- Cashback missions, installment releases and achievement unlocks are created by audited database functions and server triggers; the daily managed cron route only invokes the release function. Why: clients cannot grant bonuses or badges.
- Slot outcomes use authenticated server functions plus an atomic service-only SQL batch function; fair-session secrets and idempotent responses are server-only, and clients receive only reels and balance. Why: browser code cannot control outcomes or charge twice.
- The base database schema was rebuilt from app code during migration (original base SQL was unavailable); treat drizzle/migrations as the source of truth from here on. Why: keeps one authoritative schema history.
