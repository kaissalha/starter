---
name: starter-auth
description: Implement or review authentication, sessions, organizations, invitations, API keys, or authorization in the starter repository.
---

# Starter authentication

The product is permanently passwordless: email OTP and optional Google sign-in only. Never add credentials, passwords,
password reset, password-strength rules, or password-dependent UI.

## Sources of truth

- Server configuration: `packages/server/src/lib/auth.ts`
- Client configuration: `apps/webapp/src/lib/auth-client.ts`
- Auth schema: `packages/db/src/schema/auth`
- Authorization procedures: `packages/server/src/api/base.ts`
- Installed Better Auth source and types under the relevant package's `node_modules`

## Invariants

- Store email OTPs hashed and never log codes or sensitive auth payloads.
- Do not enable Better Auth's local two-factor plugin: it gates credential sign-ins, not this repository's email-OTP or
  OAuth flows. MFA belongs to the user's email or Google identity provider.
- Keep organization-owned data organization-scoped and enforce authorization on the server.
- Preserve Better Auth schema export names such as `users`, `sessions`, `accounts`, `apikeys`, and `twoFactors`.
- Keep `/api/auth/*` owned by Better Auth. Use established wrappers for adjacent Next.js handlers.
- Treat auth emails and errors as localized user-facing content; preserve English/Arabic parity.

Use `make migrate` for schema changes and focused auth tests before `bun check`.
