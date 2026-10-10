# Yoda: Microsoft sign-in setup (one page for Ryan)

Yoda is the Mashura sales training tracker. Employees sign in with their Microsoft 365 account. No passwords are stored in Yoda. This takes about 10 minutes.

## 1. Register the app

In the Microsoft Entra admin center, go to **Identity, Applications, App registrations, New registration**.

- **Name:** Yoda
- **Supported account types:** Accounts in this organizational directory only (single tenant)
- **Redirect URI:** platform **Web**, value:
  `https://yoda-beta-ruby.vercel.app/api/auth/callback/microsoft-entra-id`

Click **Register**.

## 2. Permissions

Under **API permissions**, confirm Microsoft Graph delegated permissions `openid`, `profile`, `email` and `User.Read`. These are the defaults. Click **Grant admin consent** for Mashura. Yoda requests no other access.

## 3. Create a client secret

Under **Certificates and secrets, New client secret**. Name it `Yoda production`. Choose the longest expiry your policy allows. Copy the secret **Value** now. It is shown once.

## 4. Send Anton three values

1. **Application (client) ID**
2. **Directory (tenant) ID**
3. **Client secret value**

Send them by a private channel, not a channel post or email thread. Anton enters them in the hosting settings. Nobody else needs them.

## 5. Optional

- Under **Properties**, set **Assignment required** to Yes, and assign only the Yoda users: Anton, Suzi Minahan, Mike McQuarie, Phoebe, Louis, Colin and the November 2, 2026 SDR hire. This is a second lock on top of Yoda's own user list.
- Add the secret's expiry date to your calendar. Sign-in stops when it expires. Expiry date: TODO(Ryan).

## Why this is safe

- Single tenant: only Mashura accounts can sign in.
- Yoda also checks every signed-in email against its own user list and denies anyone not on it.
- Yoda reads Salesforce read-only and never writes to it.
