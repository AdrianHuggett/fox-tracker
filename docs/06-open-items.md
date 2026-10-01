# 06 · Open items (priority order)

## 1. Password reset by email: DONE (Adrian confirmed on 2 Oct 2026 that SMTP and URL configuration are set up)

Kept for reference only; the original checklist is useful again only if delivery breaks:

- **SMTP**: Supabase's built-in sender only delivers to the project's team members, at a very low hourly rate, so an alliance member will probably get nothing.
  - Fix: Adrian creates a free account with a transactional email provider (Resend, Brevo, …) and enters its SMTP settings in **Supabase → Authentication → Emails → SMTP Settings**. He handles the credentials; you never see them.
  - With Resend, a sending domain is normally required; Brevo can send from a verified single address. Let him choose.
- **URL configuration**: in **Supabase → Authentication → URL Configuration**, the Site URL must be `https://adrianhuggett.github.io/fox-tracker/` and Redirect URLs must include it. Ask him to check and tell you what is there.
- **Test**: once both are set, Adrian uses "Forgot your password?" with his own email. The email link should land on the tracker and open My password.

**Fallback, prepared but NOT approved**: an admin-only "Set temporary password" button on Members.

```sql
create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if length(new_password) < 8 then raise exception 'At least 8 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
                        updated_at = now()
   where id = target;
  if not found then raise exception 'Unknown member'; end if;
end $$;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
```

Front end: in `renderMembers()`, for non-admin rows, add a button `data-pwset="<id>"`. Its handler (admin only) does `window.prompt` for the password, checks it has at least 8 characters, calls `SB.rpc('admin_set_password', {target: id, new_password: pw})` and reports via `say()`. Adrian types the password and gives it to the member in game; the member then changes it in My password. Add a What's new entry only if members should know.

## 2. Change the site address (it contains Adrian's full name)

Recommended path (explained to Adrian; **waiting for the organization name he wants**):

1. Adrian creates a free GitHub organization (e.g. `fox-3685`) and transfers `fox-tracker` to it (repo Settings → Transfer). He does both himself.
2. Re-enable Pages on the transferred repo (Settings → Pages → Deploy from branch `main`, `/` root).
3. New URL: `https://<org>.github.io/fox-tracker/`. Update the Supabase Site URL and Redirect URLs (Adrian), `git remote set-url origin https://github.com/<org>/fox-tracker.git` on his PC, and all URLs in `CLAUDE.md` and `docs/`.
4. The old URL does **not** redirect for Pages. Write a short announcement for him to post in game. Accounts and data are unaffected (same Supabase project).

Alternatives: renaming his GitHub account (affects everything; not recommended) or a paid custom domain (about $10/year, with DNS setup).

## 3. Exchange limit semantics (needs Adrian's answer)

The code caps the **quantity given** at the weekly limit. If the game caps the **quantity received**, change `exchQty()` so that `lots × get ≤ limit` (i.e. `qty ≤ floor(limit / get) × give`), update the "Max" label wording, and update the What's new text. This matters a lot for 1:300 and 1:50.

## 4. Email copy in `profiles`

`touchProfile()` still writes `profiles.email` on every load; only the admin can read it. Adrian was offered to stop copying it and clear the column. Doing so deletes data, so it needs his "oui". The change: drop `email` from the `touchProfile()` update; SQL `update profiles set email = null;`; optionally revoke UPDATE on that column.

## 5. Housekeeping and older items (status not rechecked)

- R4 `roles` were once found empty for all tasks (cause unknown). If it recurs, the original assignments are in `D:\WOS\SVS Tracking\SvS_Savings_Tracker.xlsx`, sheet *Leadership Roles* (red dot = Main, grey = Assist; merged rows 12–15 = all R4s including Talie as Assist). **Ask before restoring.** If you ever read that workbook, do so read-only, and never save it with openpyxl (it corrupts its formatting).
- Delete `moonlight-festival.js` and the dead `@media (max-width:420px)` block in `style.css`.
- The phone hero banner takes about 400px on every tab; offer to shrink it on tabs other than the Dashboard.
- 16 of 54 items have no artwork: Gareth Sigils, Mythic Hero Gear, and hero widgets and shards for Gwen, Norah, Jeronimo, Molly, Lynn, Hector, Reina, Greg and Flint. Adrian can supply PNGs, named `item-<slug>.png`, and they get registered in `ITEM_ART`.
- Dashboard "Furthest behind": ties at 0% are in arbitrary order; rank them by shortfall value.
- Accessibility debt: touch targets of 24–28px, no `min="0"` on Have/Target inputs, sort headers not keyboard-operable, incomplete tablist ARIA.
- Adrian's old report "Pack contents is messed up" was never investigated, and resetting his own `user_items` is parked. **Do not start either without his go-ahead.**

## 6. Ideas, not requested yet

- Move an R4 task to another section (admin).
- More exchanges: add one line in `EXCH` each; the target item must exist in `user_items` / `item_template`.
- A weekly view of exchanges (spreading a large plan over the weeks left to SvS against the limit).
