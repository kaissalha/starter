import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { brandOptions, brandOptionsSchema } from "@starter/infinite-brand";

import {
	brandRevisionExpectationSchema,
	brandStateSchema,
	brandUpdateMutationSchema,
	getBrand,
	publishBrand,
	updateBrand,
} from "../../services/brands";
import { requireOrganizationPermission } from "../../services/permissions";

type BrandMcpOutput = z.output<typeof brandOptionsSchema> | z.output<typeof brandStateSchema>;

const toStructuredResult = (output: BrandMcpOutput) => ({
	content: [{ text: JSON.stringify(output), type: "text" as const }],
	structuredContent: output,
});

export const registerBrandMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	server.registerTool(
		"get_brand",
		{
			annotations: { openWorldHint: false, readOnlyHint: true },
			description:
				"Get the active organization's Brand colors, typography, corners, publication state, and revision.",
			inputSchema: z.compile(z.object({})),
			outputSchema: brandStateSchema,
			title: "Get Brand",
		},
		async () => {
			await requireOrganizationPermission({ organizationId, permission: "read", userId });

			return toStructuredResult(await getBrand({ organizationId }));
		}
	);

	server.registerTool(
		"list_brand_options",
		{
			annotations: { openWorldHint: false, readOnlyHint: true },
			description: "List every supported Brand font pairing and corner style.",
			inputSchema: z.compile(z.object({})),
			outputSchema: brandOptionsSchema,
			title: "List Brand Options",
		},
		async () => {
			await requireOrganizationPermission({ organizationId, permission: "read", userId });

			return toStructuredResult(brandOptions);
		}
	);

	server.registerTool(
		"update_brand",
		{
			annotations: { idempotentHint: true, openWorldHint: false },
			description:
				"Update any combination of the active organization's Brand colors, font pairing, and corner style without publishing.",
			inputSchema: brandUpdateMutationSchema,
			outputSchema: brandStateSchema,
			title: "Update Brand",
		},
		async ({ revision, update }) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });

			return toStructuredResult(await updateBrand({ expected: { revision }, organizationId, update }));
		}
	);

	server.registerTool(
		"publish_brand",
		{
			annotations: { idempotentHint: true, openWorldHint: false },
			description:
				"Publish the website draft containing the active organization's Brand and all other draft website changes.",
			inputSchema: brandRevisionExpectationSchema,
			outputSchema: brandStateSchema,
			title: "Publish Brand",
		},
		async (expected) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });

			return toStructuredResult(await publishBrand({ expected, organizationId }));
		}
	);
};
