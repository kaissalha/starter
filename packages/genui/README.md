# @starter/genui

The generative-UI (OpenUI Lang) contract shared by the chat UI, the chart components, and the server prompt.

| Entry point              | Contents                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `@starter/genui`         | Fence parsing, visible-text extraction, and structured validation of OpenUI programs       |
| `@starter/genui/text`    | Dependency-free text normalization and chart limits used by `@starter/ui` charts           |
| `@starter/genui/library` | The chat component library definition (`createChatGenUILibrary`, `chatGenUIPromptLibrary`) |

`bun run openui:generate` writes the server prompt spec from `src/library.ts` to
`packages/server/src/ai/generated/openui-chat.spec.json`. React renderers that bind the library to `@starter/ui` stay in
the webapp (`apps/webapp/src/lib/genui-library.tsx`).
