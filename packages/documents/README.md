# @starter/documents

File-format knowledge shared by the apps and the server. It owns no storage, persistence, or ingestion workflow.

| Entry point                     | Runtime             | Contents                                                                                     |
| ------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `@starter/documents`            | Client-safe (zod)   | File kinds and extensions, upload purposes and policies, knowledge-file and viewer detection |
| `@starter/documents/extraction` | Node                | PDF, DOCX, XLSX, CSV, HTML, XML, and text extraction with size and archive limits            |
| `@starter/documents/viewer`     | React (client only) | PDF, DOCX, and XLSX viewers and their label provider                                         |

`uploadPolicies` is the single source for upload content types, size limits, and Blob access. The server's
`/api/media` handler enforces it and the webapp upload hooks validate against it before uploading.

The viewers are vendored adapters around `@embedpdf/*` and `@extend-ai/*`; they are excluded from Oxlint and jscpd.
