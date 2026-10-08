import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

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
	DomainPriceChangedError,
	DomainPurchaseDisabledError,
	DomainRegistrantError,
	domainPurchaseInputSchema,
	getDomainRegistrationTransferCode,
	prepareDomainPurchase,
	quoteDomain,
	setDomainRegistrationAutoRenew,
} from "../../services/websites/domain-registrations";
import { DomainSearchRateLimitError, suggestDomains } from "../../services/websites/domain-search";
import {
	changeWebsiteDomainMethod,
	connectWebsiteDomain,
	deleteDomainDnsRecord,
	disconnectWebsiteDomain,
	dnsRecordSaveInputSchema,
	DomainConflictError,
	DomainLimitError,
	getDomainScope,
	DomainNotFoundError,
	listDomainDnsRecords,
	listWebsiteDomains,
	reconcileWebsiteDomain,
	saveDomainDnsRecord,
	setPrimaryWebsiteDomain,
	updateWebsiteSubdomain,
} from "../../services/websites/domains";
import { checkDomainAvailability, priceRegistrationDomains } from "../../services/websites/vercel-domains";
import { startDomainRegistration } from "../../workflows/start";
import { authedWithOrganization, organizationPermission, publicApi } from "../base";

const domainProcedure = authedWithOrganization
	.meta(publicApi(true))
	.errors({
		CONFLICT: { message: "This domain is unavailable or is not ready for this operation." },
		LIMIT_REACHED: { message: "Too many domains are waiting for verification. Disconnect one and try again." },
		NOT_FOUND: { message: "Website or domain not found." },
		PRICE_CHANGED: { message: "The domain price changed. Review the new price and try again." },
		PROVIDER_UNAVAILABLE: {
			message: "Domain provider could not complete this request. Retry to check its status.",
		},
		PURCHASES_DISABLED: { message: "Domain purchases are not available yet." },
		RATE_LIMITED: { message: "Too many domain searches. Wait a moment and try again." },
		REGISTRANT_INVALID: {
			data: z.object({ fields: z.array(z.string()) }),
			message: "Some owner details are missing or invalid for this domain extension.",
		},
	})
	.use(async ({ errors, next }) => {
		try {
			return await next();
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}

			if (error instanceof DomainNotFoundError) {
				throw errors.NOT_FOUND();
			}

			if (error instanceof DomainConflictError) {
				throw errors.CONFLICT();
			}

			if (error instanceof DomainPurchaseDisabledError) {
				throw errors.PURCHASES_DISABLED();
			}

			if (error instanceof DomainRegistrantError) {
				throw errors.REGISTRANT_INVALID({ data: { fields: error.fields } });
			}

			if (error instanceof DomainPriceChangedError) {
				throw errors.PRICE_CHANGED();
			}

			if (error instanceof DomainSearchRateLimitError) {
				throw errors.RATE_LIMITED();
			}

			if (error instanceof DomainLimitError) {
				throw errors.LIMIT_REACHED();
			}

			throw errors.PROVIDER_UNAVAILABLE({ cause: error });
		}
	});

const withDomainScope = domainProcedure.middleware(async ({ context, next }) =>
	next({ context: { domainScope: await getDomainScope({ organizationId: context.organizationId }) } })
);

const writeProcedure = domainProcedure.use(organizationPermission("write"));

const scopedProcedure = domainProcedure.use(withDomainScope);

const scopedWriteProcedure = writeProcedure.use(withDomainScope);

const scopedDeleteProcedure = domainProcedure.use(organizationPermission("delete")).use(withDomainScope);

const registrationInput = z.strictObject({ registrationId: z.uuid() });

const route = ({
	method,
	operationId,
	path,
	summary,
}: {
	method: "DELETE" | "GET" | "POST" | "PUT";
	operationId: string;
	path: `/${string}`;
	summary: string;
}) => openapi({ method, operationId, path, summary, tags: ["domains"] });

const list = scopedProcedure
	.meta(route({ method: "GET", operationId: "listDomains", path: "/domains", summary: "List website domains" }))
	.handler(({ context }) => listWebsiteDomains(context.domainScope));

const connect = scopedWriteProcedure
	.meta(route({ method: "POST", operationId: "connectDomain", path: "/domains", summary: "Connect a domain" }))
	.input(domainConnectInputSchema)
	.handler(({ context, input }) => connectWebsiteDomain({ ...context.domainScope, ...input }));

const verify = scopedWriteProcedure
	.meta(
		route({
			method: "POST",
			operationId: "verifyDomain",
			path: "/domains/{domainId}/verify",
			summary: "Check a domain's ownership, DNS and certificate",
		})
	)
	.input(domainIdInputSchema)
	.handler(({ context, input }) => reconcileWebsiteDomain({ ...context.domainScope, ...input }));

const changeMethod = scopedWriteProcedure
	.meta(
		route({
			method: "PUT",
			operationId: "changeDomainMethod",
			path: "/domains/{domainId}/method",
			summary: "Switch a domain between DNS records and nameservers",
		})
	)
	.input(domainMethodInputSchema)
	.handler(({ context, input }) => changeWebsiteDomainMethod({ ...context.domainScope, ...input }));

const disconnect = scopedDeleteProcedure
	.meta(
		route({
			method: "DELETE",
			operationId: "disconnectDomain",
			path: "/domains/{domainId}",
			summary: "Disconnect a domain",
		})
	)
	.input(domainIdInputSchema)
	.handler(({ context, input }) => disconnectWebsiteDomain({ ...context.domainScope, ...input }));

const setPrimary = scopedWriteProcedure
	.meta(
		route({
			method: "POST",
			operationId: "setPrimaryDomain",
			path: "/domains/{domainId}/primary",
			summary: "Make a connected domain primary",
		})
	)
	.input(domainIdInputSchema)
	.handler(({ context, input }) => setPrimaryWebsiteDomain({ ...context.domainScope, ...input }));

const updateSubdomain = scopedWriteProcedure
	.meta(
		route({
			method: "PUT",
			operationId: "updateWebsiteSubdomain",
			path: "/domains/subdomain",
			summary: "Change the free website address",
		})
	)
	.input(websiteSubdomainInputSchema)
	.handler(({ context, input }) => updateWebsiteSubdomain({ ...context.domainScope, ...input }));

const suggest = scopedWriteProcedure
	.meta(
		route({
			method: "GET",
			operationId: "suggestDomains",
			path: "/domains/suggestions",
			summary: "Suggest registrable domains",
		})
	)
	.input(domainSuggestInputSchema)
	.handler(({ context, input }) => suggestDomains({ ...context.domainScope, ...input }));

const availability = writeProcedure
	.meta(
		route({
			method: "POST",
			operationId: "checkDomainAvailability",
			path: "/domains/availability",
			summary: "Check domain availability",
		})
	)
	.input(domainListInputSchema)
	.handler(({ input }) => checkDomainAvailability(input.domains));

const prices = writeProcedure
	.meta(
		route({
			method: "POST",
			operationId: "priceDomains",
			path: "/domains/prices",
			summary: "Price registrable domains",
		})
	)
	.input(domainListInputSchema)
	.handler(({ input }) => priceRegistrationDomains(input.domains));

const quote = writeProcedure
	.meta(
		route({
			method: "GET",
			operationId: "quoteDomain",
			path: "/domains/quote",
			summary: "Quote a domain and its owner requirements",
		})
	)
	.input(domainQuoteInputSchema)
	.handler(({ input }) => quoteDomain(input));

const purchase = scopedWriteProcedure
	.meta(
		route({
			method: "POST",
			operationId: "purchaseDomain",
			path: "/domains/registrations",
			summary: "Buy a domain for the website",
		})
	)
	.input(domainPurchaseInputSchema)
	.handler(async ({ context, input }) => {
		const registration = await prepareDomainPurchase({ ...context.domainScope, ...input });
		await startDomainRegistration(registration.id);

		return listWebsiteDomains(context.domainScope);
	});

const setAutoRenew = writeProcedure
	.meta(
		route({
			method: "PUT",
			operationId: "setDomainAutoRenew",
			path: "/domains/registrations/{registrationId}/auto-renew",
			summary: "Turn domain auto-renew on or off",
		})
	)
	.input(domainAutoRenewInputSchema)
	.handler(({ context, input }) =>
		setDomainRegistrationAutoRenew({ organizationId: context.organizationId, ...input })
	);

const transferCode = domainProcedure
	.meta(publicApi(false))
	.use(organizationPermission("delete"))
	.meta(
		route({
			method: "POST",
			operationId: "getDomainTransferCode",
			path: "/domains/registrations/{registrationId}/transfer-code",
			summary: "Reveal a registered domain's transfer code",
		})
	)
	.input(registrationInput)
	.handler(({ context, input }) =>
		getDomainRegistrationTransferCode({ organizationId: context.organizationId, ...input })
	);

const records = scopedProcedure
	.meta(
		route({
			method: "GET",
			operationId: "listDomainDnsRecords",
			path: "/domains/{domainId}/dns-records",
			summary: "List a managed domain's DNS records",
		})
	)
	.input(domainIdInputSchema)
	.handler(({ context, input }) => listDomainDnsRecords({ ...context.domainScope, ...input }));

const saveRecord = scopedWriteProcedure
	.meta(
		route({
			method: "POST",
			operationId: "saveDomainDnsRecord",
			path: "/domains/{domainId}/dns-records",
			summary: "Create a DNS record, or update one by recordId",
		})
	)
	.input(dnsRecordSaveInputSchema)
	.handler(({ context, input }) => saveDomainDnsRecord({ ...context.domainScope, ...input }));

const deleteRecord = scopedDeleteProcedure
	.meta(
		route({
			method: "DELETE",
			operationId: "deleteDomainDnsRecord",
			path: "/domains/{domainId}/dns-records/{recordId}",
			summary: "Delete a DNS record",
		})
	)
	.input(dnsRecordDeleteInputSchema)
	.handler(({ context, input }) => deleteDomainDnsRecord({ ...context.domainScope, ...input }));

export const domains = {
	availability,
	changeMethod,
	connect,
	deleteRecord,
	disconnect,
	list,
	prices,
	purchase,
	quote,
	records,
	saveRecord,
	setAutoRenew,
	setPrimary,
	suggest,
	transferCode,
	updateSubdomain,
	verify,
};
