"use client";

import { useState } from "react";

import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

import type { DomainOffer, useWebsiteDomainsController } from "./use-website-domains-controller";

type Controller = ReturnType<typeof useWebsiteDomainsController>;

export type RegistrantRequirement = Awaited<ReturnType<typeof apiClient.domains.quote.call>>["requirements"][number];

const invalidFieldsSchema = z.object({ fields: z.array(z.string()) });

export const registrantFields = [
	"firstName",
	"lastName",
	"email",
	"phone",
	"companyName",
	"address1",
	"address2",
	"city",
	"state",
	"zip",
	"country",
] as const;

export type RegistrantField = (typeof registrantFields)[number];

export const useDomainCheckoutForm = ({ controller, offer }: { controller: Controller; offer: DomainOffer }) => {
	const [values, setValues] = useState<Record<string, string>>({});
	const [autoRenew, setAutoRenew] = useState(true);
	const quote = useQuery(apiClient.domains.quote.queryOptions({ input: { domain: offer.domain }, retry: false }));
	const purchasePrice = quote.data?.purchasePrice ?? offer.purchasePrice;
	const { error } = controller.purchase;
	const requirements = quote.data?.requirements ?? [];

	return {
		additional: requirements.filter((field) => !registrantFields.some((name) => name === field.key)),
		autoRenew,
		invalid:
			error instanceof ORPCError && error.code === "REGISTRANT_INVALID"
				? (invalidFieldsSchema.safeParse(error.data).data?.fields ?? [])
				: [],
		purchasePrice,
		quote,
		renewalPrice: quote.data?.renewalPrice ?? offer.renewalPrice,
		requirement: (key: string) => requirements.find((field) => field.key === key),
		setAutoRenew,
		setValue: (key: string, value: string) => setValues((current) => ({ ...current, [key]: value })),
		submit: () =>
			controller.purchase.mutate({
				autoRenew,
				domain: offer.domain,
				expectedPrice: purchasePrice,
				registrant: values,
			}),
		values,
	};
};
