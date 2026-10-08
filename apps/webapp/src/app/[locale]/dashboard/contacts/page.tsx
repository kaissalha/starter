import { Suspense } from "react";

import { connection } from "next/server";

import { z } from "zod";

import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import { Skeleton } from "@starter/ui/components/skeleton";

import {
	defaultContactPageSize,
	getContactListInput,
	parseContactFilters,
	parseContactSorting,
} from "./contact-list-input";
import { ContactsPage } from "./contacts-page";

export const instant = false;

const contactIdSchema = z.compile(z.uuid());

const single = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value);

type ContactsRouteProps = {
	searchParams: Promise<{
		contact?: string | Array<string>;
		filters?: string | Array<string>;
		q?: string | Array<string>;
		size?: string | Array<string>;
		sort?: string | Array<string>;
	}>;
};

export const generateMetadata = async () => {
	const t = await getTranslations("contacts");

	return { title: t("title") };
};

const ContactsRouteContent = async ({ searchParams }: ContactsRouteProps) => {
	await connection();
	const params = await searchParams;
	const queryClient = getQueryClient();
	prefetch(
		queryClient.infiniteQuery(
			serverApiClient.contacts.list.infiniteOptions<string | null>({
				getNextPageParam: (page) => page.meta.cursor ?? undefined,
				initialPageParam: null,
				input: (cursor) =>
					getContactListInput({
						cursor,
						filters: parseContactFilters(single(params.filters)),
						pageSize: Number(single(params.size)) || defaultContactPageSize,
						search: single(params.q) ?? "",
						sort: parseContactSorting(single(params.sort)),
					}),
			})
		)
	);
	const contactId = contactIdSchema.safeParse(single(params.contact));

	if (contactId.success) {
		prefetch(
			queryClient.query(serverApiClient.contacts.get.queryOptions({ input: { contactId: contactId.data } }))
		);
	}

	return (
		<HydrateClient>
			<ContactsPage />
		</HydrateClient>
	);
};

export default function Page(props: ContactsRouteProps) {
	return (
		<Suspense
			fallback={
				<div className='flex flex-1 flex-col gap-4 p-5'>
					<Skeleton className='h-10 w-full' />
					<Skeleton className='h-9 w-full' />
					<Skeleton className='h-9 w-full' />
					<Skeleton className='h-9 w-full' />
					<Skeleton className='h-9 w-full' />
				</div>
			}
		>
			<ContactsRouteContent {...props} />
		</Suspense>
	);
}
