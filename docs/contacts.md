# Contacts

First version: a searchable, sortable table, an addressable contact drawer, and adding contacts with name, email and phone.

The table loads 50 contacts at a time through the shared `@starter/db` utils: `withOrderBy` (any column, id as
tie-breaker), `addFullTextSearch` (a generated `fts` tsvector with a GIN index; emails and phones are split on
punctuation so `ada@example.com`, `example` or `555` all prefix-match) and `queryWithPagination` (offset cursor plus
total count). Sorting and search live in the URL through `useDataTableState`. The header is the shared `SearchableHeader`
(Durable-style): an inline search field on `md+`, and on mobile a search icon that swaps the header for a
full-width field with back and clear buttons; going back clears the search. The server page prefetches the first page (and the
contact named in `?contact=`) into the request query client and streams it through `HydrateClient`; the shared
`getContactListInput` keeps the server and client query keys identical.

Email identity is normalized and unique per organization. The service checks live organization membership.
Creating a contact with an email that already exists returns a conflict; create is not idempotent.

UI: rows are clickable and keyboard-focusable, headers toggle the sort, and the next page loads from an
IntersectionObserver sentinel. The drawer stays mounted and toggles `open`, so Base UI plays both the enter and exit
animation. Below the `md` breakpoint it becomes a bottom sheet with a grab bar (`useIsMobile`), like the mobile sidebar. Clicking a row seeds the drawer's query cache from the row, so it opens instantly and refreshes in the background.

Implementation: one database table, one service, one oRPC router, and four route-owned UI files.
No lifecycle statuses, owners, tags, custom fields, notes, follow-ups, bulk operations or CSV.

Every contact capability is available through the same service on each surface:

| Capability            | `/api/v1`                                                | MCP                           | Assistant                  |
| --------------------- | -------------------------------------------------------- | ----------------------------- | -------------------------- |
| List and search       | `GET /contacts`                                          | `list_contacts`               | `listContacts`             |
| Read one              | `GET /contacts/{contactId}`                              | `get_contact`                 | `getContact`               |
| Create                | `POST /contacts`                                         | `create_contact`              | `createContact` (approval) |
| Update                | `PUT /contacts/{contactId}`                              | `update_contact`              | `updateContact` (approval) |
| Delete                | `DELETE /contacts/{contactId}`                           | `delete_contact`              | `deleteContact` (approval) |
| List inquiry messages | `GET /contacts/{contactId}/messages`                     | `list_contact_messages`       | `listContactMessages`      |
| Read one message      | `GET /contacts/{contactId}/messages/{messageId}`         | `get_contact_message`         | `getContactMessage`        |
| Triage a message      | `POST /contacts/{contactId}/messages/{messageId}/triage` | `triage_contact_message`      | `triageContactMessage`     |
| Inquiry summary       | `GET /contacts/inquiry-summary`                          | `get_contact_inquiry_summary` | `getContactInquirySummary` |

UI references: Durable Customers, Getolv Patients, and Figma frames 1248-2071 and 1248-2174.
