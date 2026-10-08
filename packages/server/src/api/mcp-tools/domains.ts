import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { requireOrganizationPermission } from "../../services/permissions";
import {
	dnsRecordDeleteInputSchema,
	domainAutoRenewInputSchema,
	domainConnectInputSchema,
	domainIdInputSchema,
	domainListInputSchema,
	domainMethodInputSchema,
	domainQuoteInputSchema,
	domainSuggestInputSchema,
	websiteSubdomainInputSchema,
} from "../../services/websites/domain-input";
import {
	domainPurchaseInputSchema,
	prepareDomainPurchase,
	quoteDomain,
	setDomainRegistrationAutoRenew,
} from "../../services/websites/domain-registrations";
import { suggestDomains } from "../../services/websites/domain-search";
import {
	changeWebsiteDomainMethod,
	connectWebsiteDomain,
	deleteDomainDnsRecord,
	disconnectWebsiteDomain,
	dnsRecordSaveInputSchema,
	listDomainDnsRecords,
	listWebsiteDomains,
	reconcileWebsiteDomain,
	requireDomainScope,
	saveDomainDnsRecord,
	setPrimaryWebsiteDomain,
	updateWebsiteSubdomain,
} from "../../services/websites/domains";
import { checkDomainAvailability, priceRegistrationDomains } from "../../services/websites/vercel-domains";
import { startDomainRegistration } from "../../workflows/start";

const toResult = <Output>(output: Output) => ({ content: [{ text: JSON.stringify(output), type: "text" as const }] });

export const registerDomainMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	const actor = { organizationId, userId };
	const scope = (permission: "delete" | "read" | "write") => requireDomainScope({ ...actor, permission });
	const read = { destructiveHint: false, openWorldHint: false, readOnlyHint: true };
	const lookup = { destructiveHint: false, openWorldHint: true, readOnlyHint: true };
	const change = { destructiveHint: false, idempotentHint: true, openWorldHint: true, readOnlyHint: false };
	const remove = { destructiveHint: true, idempotentHint: false, openWorldHint: true, readOnlyHint: false };
	server.registerTool(
		"list_domains",
		{
			annotations: read,
			description:
				"List the website's free address, connected domains with ownership, DNS, certificate and primary status, required setup records, and registered domains with expiry and auto-renew.",
			inputSchema: z.compile(z.object({})),
			title: "listDomains",
		},
		async () => toResult(await listWebsiteDomains(await scope("read")))
	);
	server.registerTool(
		"connect_domain",
		{
			annotations: { ...change, idempotentHint: false },
			description:
				"Connect a domain the business already owns. Every connection first needs the returned TXT ownershipRecord added at the domain's current DNS provider. Method records then keeps DNS there and returns the records to add; nameservers moves DNS to Vercel only after ownershipVerified is true.",
			inputSchema: domainConnectInputSchema,
			title: "connectDomain",
		},
		async (input) => toResult(await connectWebsiteDomain({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"verify_domain",
		{
			annotations: change,
			description:
				"Re-check one connected domain's ownership, DNS and certificate by exact ID from list_domains. Propagation can take hours.",
			inputSchema: domainIdInputSchema,
			title: "verifyDomain",
		},
		async (input) => toResult(await reconcileWebsiteDomain({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"change_domain_method",
		{
			annotations: change,
			description: "Switch one connected domain between DNS records and Vercel nameservers by exact ID.",
			inputSchema: domainMethodInputSchema,
			title: "changeDomainMethod",
		},
		async (input) => toResult(await changeWebsiteDomainMethod({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"set_primary_domain",
		{
			annotations: change,
			description:
				"Make one connected domain the website's primary address by exact ID. Other domains redirect to it.",
			inputSchema: domainIdInputSchema,
			title: "setPrimaryDomain",
		},
		async (input) => toResult(await setPrimaryWebsiteDomain({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"disconnect_domain",
		{
			annotations: remove,
			description:
				"Disconnect one domain and its www/apex pair from the website by exact ID. The website stays on its free address.",
			inputSchema: domainIdInputSchema,
			title: "disconnectDomain",
		},
		async (input) => toResult(await disconnectWebsiteDomain({ ...(await scope("delete")), ...input }))
	);
	server.registerTool(
		"update_website_subdomain",
		{
			annotations: change,
			description: "Change the website's free address subdomain. Fails when the address is taken or reserved.",
			inputSchema: websiteSubdomainInputSchema,
			title: "updateWebsiteSubdomain",
		},
		async (input) => {
			const domainScope = await scope("write");
			await updateWebsiteSubdomain({ ...domainScope, ...input });

			return toResult(await listWebsiteDomains(domainScope));
		}
	);
	server.registerTool(
		"suggest_domains",
		{
			annotations: lookup,
			description:
				"Suggest registrable domain names for a search phrase using the business as context. Rate limited.",
			inputSchema: domainSuggestInputSchema,
			title: "suggestDomains",
		},
		async (input) => toResult(await suggestDomains({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"check_domain_availability",
		{
			annotations: lookup,
			description: "Check whether up to 30 exact domains can be registered.",
			inputSchema: domainListInputSchema,
			title: "checkDomainAvailability",
		},
		async ({ domains }) => {
			await requireOrganizationPermission({ ...actor, permission: "write" });

			return toResult(await checkDomainAvailability(domains));
		}
	);
	server.registerTool(
		"get_domain_prices",
		{
			annotations: lookup,
			description: "Get one-year purchase and renewal prices in USD for up to 30 available domains.",
			inputSchema: domainListInputSchema,
			title: "getDomainPrices",
		},
		async ({ domains }) => {
			await requireOrganizationPermission({ ...actor, permission: "write" });

			return toResult(await priceRegistrationDomains(domains));
		}
	);
	server.registerTool(
		"quote_domain",
		{
			annotations: lookup,
			description:
				"Get the current purchase and renewal price and the owner details required to register one available domain.",
			inputSchema: domainQuoteInputSchema,
			title: "quoteDomain",
		},
		async (input) => {
			await requireOrganizationPermission({ ...actor, permission: "write" });

			return toResult(await quoteDomain(input));
		}
	);
	server.registerTool(
		"purchase_domain",
		{
			annotations: { ...remove, destructiveHint: false },
			description:
				"Buy and register one domain for the website, charged to the business. Confirm the domain, price and renewal with the user first. Pass the exact purchasePrice from quote_domain as expectedPrice and every required owner field the user supplied.",
			inputSchema: domainPurchaseInputSchema,
			title: "purchaseDomain",
		},
		async (input) => {
			const domainScope = await scope("write");
			const registration = await prepareDomainPurchase({ ...domainScope, ...input });
			await startDomainRegistration(registration.id);

			return toResult(await listWebsiteDomains(domainScope));
		}
	);
	server.registerTool(
		"set_domain_auto_renew",
		{
			annotations: change,
			description: "Turn automatic renewal on or off for one registered domain by exact registration ID.",
			inputSchema: domainAutoRenewInputSchema,
			title: "setDomainAutoRenew",
		},
		async (input) => {
			const domainScope = await scope("write");
			await setDomainRegistrationAutoRenew({ organizationId, ...input });

			return toResult(await listWebsiteDomains(domainScope));
		}
	);
	server.registerTool(
		"list_domain_dns_records",
		{
			annotations: { ...read, openWorldHint: true },
			description:
				"List DNS records for one domain whose DNS is managed here. Locked records keep the website online and cannot change.",
			inputSchema: domainIdInputSchema,
			title: "listDomainDnsRecords",
		},
		async (input) => toResult(await listDomainDnsRecords({ ...(await scope("read")), ...input }))
	);
	server.registerTool(
		"save_domain_dns_record",
		{
			annotations: { ...change, idempotentHint: false },
			description:
				"Create a DNS record on a managed domain, or replace one by exact recordId from list_domain_dns_records.",
			inputSchema: dnsRecordSaveInputSchema,
			title: "saveDomainDnsRecord",
		},
		async (input) => toResult(await saveDomainDnsRecord({ ...(await scope("write")), ...input }))
	);
	server.registerTool(
		"delete_domain_dns_record",
		{
			annotations: remove,
			description: "Permanently delete one editable DNS record by exact domain ID and record ID.",
			inputSchema: dnsRecordDeleteInputSchema,
			title: "deleteDomainDnsRecord",
		},
		async (input) => toResult(await deleteDomainDnsRecord({ ...(await scope("delete")), ...input }))
	);
};
