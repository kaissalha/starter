import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
	getNotificationSettings,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../../services/notifications/preferences";
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
import { appContextSchema, toolInput } from "../types";

export const domainsTools = {
	changeDomainMethod: createTool({
		description:
			"Switch one connected domain between DNS records at the current provider and Vercel nameservers, using its exact ID from listDomains.",
		execute: async (input, { requestContext }) =>
			changeWebsiteDomainMethod({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "change-domain-method",
		inputSchema: toolInput(domainMethodInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	checkDomainAvailability: createTool({
		description: "Check whether up to 30 exact domains can be registered.",
		execute: async ({ domains }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return checkDomainAvailability(domains);
		},
		id: "check-domain-availability",
		inputSchema: toolInput(domainListInputSchema),
		requestContextSchema: appContextSchema,
	}),
	connectDomain: createTool({
		description:
			"Connect a domain the business already owns to the website. Every connection first needs the returned TXT ownershipRecord added at the domain's current DNS provider. Method records then adds DNS records there; nameservers moves DNS to Vercel only after ownershipVerified is true. Returns the setup records to show the user.",
		execute: async (input, { requestContext }) =>
			connectWebsiteDomain({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "connect-domain",
		inputSchema: toolInput(domainConnectInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	deleteDomainDnsRecord: createTool({
		description:
			"Permanently delete one editable DNS record by exact domain ID and record ID from listDomainDnsRecords.",
		execute: async (input, { requestContext }) =>
			deleteDomainDnsRecord({
				...(await requireDomainScope({ ...requestContext.all, permission: "delete" })),
				...input,
			}),
		id: "delete-domain-dns-record",
		inputSchema: toolInput(dnsRecordDeleteInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	disconnectDomain: createTool({
		description:
			"Disconnect one domain and its www/apex pair from the website by exact ID. The website stays reachable at its free address.",
		execute: async (input, { requestContext }) =>
			disconnectWebsiteDomain({
				...(await requireDomainScope({ ...requestContext.all, permission: "delete" })),
				...input,
			}),
		id: "disconnect-domain",
		inputSchema: toolInput(domainIdInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	getDomainPrices: createTool({
		description: "Get purchase and renewal prices in USD for up to 30 available domains.",
		execute: async ({ domains }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return priceRegistrationDomains(domains);
		},
		id: "get-domain-prices",
		inputSchema: toolInput(domainListInputSchema),
		requestContextSchema: appContextSchema,
	}),
	getNotificationSettings: createTool({
		description:
			"Read the current member's notification settings, including each type's channels, whether each is on, and whether it is locked on.",
		execute: async (_input, { requestContext }) => getNotificationSettings({ actor: requestContext.all }),
		id: "get-notification-settings",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	listDomainDnsRecords: createTool({
		description:
			"Read DNS records for one domain whose DNS is managed here. Locked records keep the website online and cannot be changed.",
		execute: async (input, { requestContext }) =>
			listDomainDnsRecords({
				...(await requireDomainScope({ ...requestContext.all, permission: "read" })),
				...input,
			}),
		id: "list-domain-dns-records",
		inputSchema: toolInput(domainIdInputSchema),
		requestContextSchema: appContextSchema,
	}),
	listDomains: createTool({
		description:
			"Read the website's free address, connected domains with ownership, DNS, certificate and primary status, required setup records, and registered domains with renewal details.",
		execute: async (_input, { requestContext }) =>
			listWebsiteDomains(await requireDomainScope({ ...requestContext.all, permission: "read" })),
		id: "list-domains",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	purchaseDomain: createTool({
		description:
			"Buy and register one available domain for the website, charged to the business. Call quoteDomain first and pass its exact purchasePrice as expectedPrice and every required owner field in registrant. State the domain, price and renewal before approval.",
		execute: async (input, { requestContext }) => {
			const scope = await requireDomainScope({ ...requestContext.all, permission: "write" });
			const registration = await prepareDomainPurchase({ ...scope, ...input });
			await startDomainRegistration(registration.id);

			return listWebsiteDomains(scope);
		},
		id: "purchase-domain",
		inputSchema: toolInput(domainPurchaseInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	quoteDomain: createTool({
		description:
			"Get the current purchase and renewal price and the owner details required to register one available domain.",
		execute: async (input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return quoteDomain(input);
		},
		id: "quote-domain",
		inputSchema: toolInput(domainQuoteInputSchema),
		requestContextSchema: appContextSchema,
	}),
	saveDomainDnsRecord: createTool({
		description:
			"Create a DNS record on a managed domain, or replace one by exact recordId from listDomainDnsRecords. Locked records cannot be changed.",
		execute: async (input, { requestContext }) =>
			saveDomainDnsRecord({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "save-domain-dns-record",
		inputSchema: toolInput(dnsRecordSaveInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	setDomainAutoRenew: createTool({
		description: "Turn automatic renewal on or off for one registered domain by exact registration ID.",
		execute: async (input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return setDomainRegistrationAutoRenew({ organizationId: requestContext.all.organizationId, ...input });
		},
		id: "set-domain-auto-renew",
		inputSchema: toolInput(domainAutoRenewInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	setPrimaryDomain: createTool({
		description:
			"Make one connected domain the website's primary address by exact ID. Other domains redirect to it.",
		execute: async (input, { requestContext }) =>
			setPrimaryWebsiteDomain({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "set-primary-domain",
		inputSchema: toolInput(domainIdInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	suggestDomains: createTool({
		description: "Suggest registrable domain names for a search phrase, using the business name as context.",
		execute: async (input, { requestContext }) =>
			suggestDomains({ ...(await requireDomainScope({ ...requestContext.all, permission: "write" })), ...input }),
		id: "suggest-domains",
		inputSchema: toolInput(domainSuggestInputSchema),
		requestContextSchema: appContextSchema,
	}),
	updateNotificationSetting: createTool({
		description:
			"Turn one notification channel on or off for the current member, using an exact type and channel from getNotificationSettings. Locked channels cannot be turned off.",
		execute: async (input, { requestContext }) => updateNotificationSetting({ actor: requestContext.all, input }),
		id: "update-notification-setting",
		inputSchema: toolInput(notificationSettingUpdateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	updateWebsiteSubdomain: createTool({
		description: "Change the website's free address subdomain. Returns an error when the address is taken.",
		execute: async (input, { requestContext }) =>
			updateWebsiteSubdomain({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "update-website-subdomain",
		inputSchema: toolInput(websiteSubdomainInputSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	verifyDomain: createTool({
		description:
			"Re-check one connected domain's ownership, DNS and certificate by exact ID and return its updated status.",
		execute: async (input, { requestContext }) =>
			reconcileWebsiteDomain({
				...(await requireDomainScope({ ...requestContext.all, permission: "write" })),
				...input,
			}),
		id: "verify-domain",
		inputSchema: toolInput(domainIdInputSchema),
		requestContextSchema: appContextSchema,
	}),
};
