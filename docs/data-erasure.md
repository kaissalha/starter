# Data erasure

## Workspace deletion

Workspace owners delete a workspace from Settings → Workspace. Before Better Auth deletes the organization row,
`beforeDeleteOrganization` stops AI activity and writes an `organization_purges` row that snapshots the Blob objects
outside Postgres cascades: upload Blob URLs (including soft-deleted files) and the workspace logo. A failed snapshot
aborts the deletion.

After the cascade, `afterDeleteOrganization` runs the purge: Mastra threads, knowledge vectors and resource working
memory, then Blob objects in batches of 25. Anything that fails
stays on the row, and the `/api/organizations/purge` cron retries it every 15 minutes for up to 20 attempts. Exhausted
jobs log `Organization purge exhausted retries`. A completed row keeps no URLs and remains as the erasure record. `last_error` holds only step names, counts and error class names.

The purge refuses to run while the organization row still exists, and the sweep cancels such jobs after 24 hours.

Inspect stuck jobs with a read-only query:

```sql
select organization_id, attempts, last_error, updated_at,
       jsonb_array_length(blobs) as blobs
from organization_purges
where completed_at is null
order by updated_at;
```

## User account erasure

Self-service account deletion is not enabled. To erase a user manually:

1. Confirm the user owns no workspace that has other members. Transfer ownership or have the user delete each workspace
   they own first, and confirm its `organization_purges` row is completed.
2. Delete the `users` row. Sessions, accounts, two-factor records, memberships, invitations they sent, notifications,
   notification inboxes, preferences and email deliveries, OAuth clients, consents and tokens, and integration connections cascade.
   `files.uploaded_by` is set to null, so files they uploaded to other workspaces stay with those workspaces.
   `files.deleted_by` cascades, which hard-deletes files they soft-deleted; their upload Blobs were already removed when
   the file was deleted.
3. Delete the user's API keys with `delete from apikeys where reference_id = '<user id>'`; `apikeys.reference_id` has no
   foreign key.

## Retained data

- Mastra traces, spans and scores are covered by age-based retention, not by workspace deletion.

## Age-based retention

The nightly `/api/maintenance/retention` cron deletes in bounded batches: verifications and sessions one day past
`expires_at`, OAuth access tokens and client assertions once expired, expired OAuth refresh tokens without a live access
token, and anonymous OAuth clients older than one day with no access token, refresh token or consent. Mastra spans and scorer results expire after one day through the store's
`retention` config and `prune()`; chat memory is not expired. Events and their notifications follow the retention section of
[`events-and-notifications.md`](events-and-notifications.md#retention).
