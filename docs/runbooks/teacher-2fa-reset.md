# Runbook: reset a teacher's 2-step sign-in (lost phone)

When a teacher has lost every authenticator (main and backup), they can't get past the code screen. They email the support address shown on that screen (`SUPPORT_EMAIL`, else `PRINT_OPS_EMAIL`).

## 1. Verify it's really them (before touching anything)

- Reply **only to the account's email address** as it is stored in Supabase. Never reply to an address the request came from if it's different.
- Ask them to confirm one detail an attacker wouldn't have, e.g. a class name and roughly how many students it has, or the school name.
- If anything doesn't match, stop. Removing the factor would hand the account, and a class's feelings data, to whoever asked.

## 2. Remove the factor

1. Supabase Dashboard → **Authentication** → **Users**.
2. Search for the teacher's email and open the user.
3. In the user's **Multi-Factor Authentication / Factors** section, **delete every TOTP factor** listed.
   - This removes the requirement. Their password still works.
   - Existing sessions stay at their current level, so also sign the user out from that page.

## 3. Record it

Add a row to `admin_access_log` (migration 032) from the SQL editor, so the reset is on the audit trail:

```sql
insert into public.admin_access_log (actor, action, target_table, target_id, reason, detail)
values ('<OWNER_USER_ID>', 'mfa.reset', 'auth.users', '<teacher user id>',
        'Lost phone; identity confirmed by <how>', '{}'::jsonb);
```

## 4. Tell the teacher

- They can sign in with their password now.
- Ask them to turn 2-step sign-in back on (Account → 2-step sign-in) and to add a **backup authenticator** this time.

If `TEACHER_MFA_ENFORCE=on`, nothing else is needed: with no verified factor, their sessions are no longer asked for a code.
