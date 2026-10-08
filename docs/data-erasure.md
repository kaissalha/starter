# Data erasure

## Workspace deletion

Workspace owners delete a workspace from Settings → Workspace. Before Better Auth deletes the organization row,
`beforeDeleteOrganization` stops AI activity and writes an `organization_purges` row that snapshots everything outside
Postgres cascades: upload Blob URLs (including soft-deleted files and the workspace logo), verified custom hostnames
attached to the Vercel project, and purchased domain registrations. A failed snapshot aborts the deletion.

After the cascade, `afterDeleteOrganization` runs the purge: Mastra threads, knowledge vectors and resource working
memory, Blob objects, Vercel project domains and their host cache entries, and registrar auto-renew. Anything that fails
stays on the row, and the `/api/organizations/purge` cron retries it every 15 minutes for up to 20 attempts. Exhausted
jobs log `Organization purge exhausted retries`. A completed row keeps no URLs or hostnames and remains as the erasure
record. `last_error` holds only step names, counts and error class names.

The purge refuses to run while the organization row still exists, and the sweep cancels such jobs after 24 hours. It
skips a hostname that another workspace has connected since and only changes registrations that no longer belong to a
workspace.

Inspect stuck jobs with a read-only query:

```sql
select organization_id, attempts, last_error, updated_at,
       jsonb_array_length(blobs) as blobs,
       jsonb_array_length(hostnames) as hostnames,
       jsonb_array_length(registration_domains) as registrations
from organization_purges
where completed_at is null
order by updated_at;
```

## User account erasure

Self-service account deletion is not enabled. To erase a user manually:

1. Confirm the user owns no workspace that has other members. Transfer ownership or have the user delete each workspace
   they own first, and confirm its `organization_purges` row is completed.
2. Delete the `users` row. Sessions, accounts, two-factor records, memberships, invitations they sent, notifications,
   notification inboxes and preferences, OAuth clients, consents and tokens, and integration connections cascade.
   `files.uploaded_by` is set to null, so files they uploaded to other workspaces stay with those workspaces.
   `files.deleted_by` cascades, which hard-deletes files they soft-deleted; their upload Blobs were already removed when
   the file was deleted.
3. Delete the user's API keys with `delete from apikeys where reference_id = '<user id>'`; `apikeys.reference_id` has no
   foreign key.

## Retained data

- Purchased domains keep their `domain_registrations` row and `registrant` contact data as the registrar record, with
  `auto_renew` turned off and `organization_id` set to null. Removing registrant data needs an operator decision.
- Mastra traces, spans and scores are covered by age-based retention, not by workspace deletion.

## Age-based retention

The nightly `/api/maintenance/retention` cron deletes in bounded batches: verifications and sessions one day past
`expires_at`, OAuth access tokens and client assertions once expired, expired OAuth refresh tokens without a live access
token, anonymous OAuth clients older than one day with no token or consent, website versions beyond the newest 20 per
site (never the draft or published version), and SEO answer runs older than one day or beyond the newest five per
question (always keeping the latest). Mastra spans and scorer results expire after one day through the store's
`retention` config and `prune()`; chat memory is not expired. Events follow §10.4 of `events-and-notifications.md`.
