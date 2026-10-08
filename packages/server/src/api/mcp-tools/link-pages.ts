import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { linkPageStateSchema } from "@starter/infinite-links/contracts";

import {
	getLinkPage,
	publishLinkPage,
	publishLinkPageInputSchema,
	saveLinkPage,
	saveLinkPageInputSchema,
} from "../../services/link-pages";
import { requireOrganizationPermission } from "../../services/permissions";

const toStructuredResult = (output: z.output<typeof linkPageStateSchema>) => ({
	content: [{ text: JSON.stringify(output), type: "text" as const }],
	structuredContent: output,
});

export const registerLinkPageMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	server.registerTool(
		"get_link_page",
		{
			annotations: { openWorldHint: false, readOnlyHint: true },
			description:
				"Get the active organization's complete Links page draft, inherited Brand, publication state, and current revision.",
			inputSchema: z.compile(z.object({})),
			outputSchema: linkPageStateSchema,
			title: "Get Links Page",
		},
		async () => {
			await requireOrganizationPermission({ organizationId, permission: "read", userId });

			return toStructuredResult(await getLinkPage({ organizationId }));
		}
	);

	server.registerTool(
		"save_link_page",
		{
			annotations: { idempotentHint: true, openWorldHint: false },
			description:
				"Save a complete Links page draft using the current updatedAt revision returned by get_link_page.",
			inputSchema: saveLinkPageInputSchema,
			outputSchema: linkPageStateSchema,
			title: "Save Links Page",
		},
		async ({ document, updatedAt }) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });

			return toStructuredResult(await saveLinkPage({ document, organizationId, updatedAt, userId }));
		}
	);

	server.registerTool(
		"publish_link_page",
		{
			annotations: { idempotentHint: true, openWorldHint: false },
			description:
				"Publish the active organization's Links page using the current updatedAt revision returned by get_link_page.",
			inputSchema: publishLinkPageInputSchema,
			outputSchema: linkPageStateSchema,
			title: "Publish Links Page",
		},
		async ({ updatedAt }) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });

			return toStructuredResult(await publishLinkPage({ organizationId, updatedAt }));
		}
	);
};
