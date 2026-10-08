"use client";

import { Add01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { SearchableHeader } from "@/app/[locale]/dashboard/components/layout/header/searchable-header";
import { InfiniteDataTable } from "@/components/infinite-data-table";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import type { DataTableColumnDef } from "@starter/ui/components/data-table";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

import { ContactDrawer } from "./contact-drawer";
import { ContactsFilters } from "./contacts-filters";
import { type ContactListRow, useContactsController } from "./use-contacts-controller";

const ContactLatestMessage = ({
	className,
	message,
	onClick,
}: {
	className?: string;
	message: string;
	onClick: () => void;
}) => (
	<button
		className={cn(
			"block max-w-48 cursor-pointer truncate text-start text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
			className
		)}
		onClick={(event) => {
			event.stopPropagation();
			onClick();
		}}
		type='button'
	>
		{message}
	</button>
);

const getContactColumns = ({
	formatDate,
	labels,
	onMessageClick,
}: {
	formatDate: (date: Date) => string;
	labels: { createdAt: string; email: string; latestMessage: string; name: string; phone: string };
	onMessageClick: (row: ContactListRow) => void;
}): Array<DataTableColumnDef<ContactListRow>> => [
	{
		accessorKey: "name",
		cell: ({ row }) => {
			const title = row.original.name || row.original.email || row.original.phone;

			return (
				<>
					<span className='block truncate'>{title}</span>
					<span className='flex min-w-0 gap-3 text-muted-foreground md:hidden'>
						{[row.original.email, row.original.phone].flatMap((value) =>
							value && value !== title
								? [
										<span className='truncate' key={value}>
											{value}
										</span>,
									]
								: []
						)}
					</span>
					{row.original.latestMessage && (
						<ContactLatestMessage
							className='mt-1 max-w-full md:hidden'
							message={row.original.latestMessage.message}
							onClick={() => onMessageClick(row.original)}
						/>
					)}
				</>
			);
		},
		header: labels.name,
	},
	{
		accessorKey: "email",
		cell: ({ row }) => <span className='block truncate text-muted-foreground'>{row.original.email || "—"}</span>,
		header: labels.email,
	},
	{
		accessorKey: "latestMessage",
		cell: ({ row }) =>
			row.original.latestMessage && (
				<ContactLatestMessage
					message={row.original.latestMessage.message}
					onClick={() => onMessageClick(row.original)}
				/>
			),
		header: labels.latestMessage,
	},
	{
		accessorKey: "phone",
		cell: ({ row }) => <span className='block truncate text-muted-foreground'>{row.original.phone || "—"}</span>,
		header: labels.phone,
	},
	{
		accessorKey: "createdAt",
		cell: ({ row }) => (
			<span className='text-muted-foreground'>{formatDate(new Date(row.original.createdAt))}</span>
		),
		header: labels.createdAt,
		sortDescFirst: true,
	},
];

export const ContactsPage = () => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("contacts");
	const format = useFormatter();

	const {
		contact,
		contactTab,
		items,
		messageId,
		open,
		openMessage,
		query,
		select,
		setMessageId,
		setTab,
		tableState,
	} = useContactsController();

	const columns = getContactColumns({
		formatDate: (date) => format.dateTime(date, { dateStyle: "medium" }),
		labels: {
			createdAt: t("createdAt"),
			email: t("email"),
			latestMessage: t("latestMessage"),
			name: t("name"),
			phone: t("phone"),
		},
		onMessageClick: openMessage,
	});

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<SearchableHeader
				actions={
					<>
						<ContactsFilters
							filterCount={tableState.filters.filterCount}
							filters={tableState.filters.filters}
							onClear={tableState.filters.clearFilters}
							onToggle={tableState.filters.toggleFilter}
						/>
						{can("workspace.write") && (
							<Button onClick={() => open("new")}>
								<HugeiconsIcon aria-hidden className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
								<span className='hidden sm:inline'>{t("newContact")}</span>
								<span className='sm:hidden'>{t("new")}</span>
							</Button>
						)}
					</>
				}
				className='flex-nowrap gap-2 px-4 md:px-5'
				item={{ labelTx: "contacts" }}
				leading={
					<>
						<HugeiconsIcon
							aria-hidden
							className='hidden size-4 scale-110 text-muted-foreground sm:block'
							icon={UserCircleIcon}
							strokeWidth={1.75}
						/>
						<h1 className='text-base'>{t("title")}</h1>
					</>
				}
				onSearchChange={(value) => tableState.search.onSearchChange(value)}
				search={tableState.search.search}
				searchPlaceholder={t("search")}
			/>
			<div className='flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain'>
				<InfiniteDataTable
					columnClassNames={{
						createdAt: "hidden md:table-cell",
						email: "hidden md:table-cell",
						latestMessage: "hidden md:table-cell",
						phone: "hidden md:table-cell",
					}}
					columns={columns}
					data={items}
					getRowId={(row) => row.id}
					hasNextPage={query.hasNextPage}
					isFetchingNextPage={query.isFetchingNextPage}
					loadingLabel={t("loading")}
					loadMore={() => query.fetchNextPage()}
					onRowClick={select}
					onSortingChange={tableState.sorting.onSortingChange}
					sorting={tableState.sorting.sorting}
				/>
				{query.isPending && (
					<div aria-label={t("loading")} className='space-y-3 p-5' role='status'>
						<Skeleton className='h-9 w-full' />
						<Skeleton className='h-9 w-full' />
						<Skeleton className='h-9 w-full' />
					</div>
				)}
				{query.isError && (
					<div className='p-8 text-center' role='alert'>
						<p>{t("loadFailed")}</p>
						<Button onClick={() => query.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					</div>
				)}
				{query.isSuccess && items.length === 0 && (
					<div className='flex min-h-64 flex-1 flex-col items-center justify-center px-5 pb-16 text-center'>
						<HugeiconsIcon
							aria-hidden
							className='mb-5 size-7 scale-110'
							icon={UserCircleIcon}
							strokeWidth={1.75}
						/>
						<h2 className='text-lg'>
							{t(tableState.search.search || tableState.filters.filterCount > 0 ? "noResults" : "title")}
						</h2>
						<p className='mt-1 text-sm text-muted-foreground'>
							{t(tableState.search.search || tableState.filters.filterCount > 0 ? "trySearch" : "empty")}
						</p>
						{can("workspace.write") && (
							<Button className='mt-4' onClick={() => open("new")}>
								<HugeiconsIcon aria-hidden className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
								{t("newContact")}
							</Button>
						)}
					</div>
				)}
			</div>
			<ContactDrawer
				contactId={contact}
				contactTab={contactTab}
				messageId={messageId}
				onClose={() => open(null)}
				onMessageChange={setMessageId}
				onSaved={open}
				onTabChange={setTab}
			/>
		</div>
	);
};
