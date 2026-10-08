"use client";

import { ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ORPCError } from "@orpc/client";
import { useFormatter, useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@starter/ui/components/input-group";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

import { useDomainSearch, type DomainSearchItem } from "./use-domain-search";
import type { useWebsiteDomainsController } from "./use-website-domains-controller";

type Controller = ReturnType<typeof useWebsiteDomainsController>;

const skeletonKeys = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

const rowClassName = "flex min-h-18 w-full items-center justify-between gap-4 rounded-2xl bg-muted p-3 ps-5";

const PriceSkeleton = () => <Skeleton className='h-5 w-28' />;

const DomainRowSkeleton = () => (
	<div className={rowClassName}>
		<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
			<Skeleton className='h-5 w-40' />
			<PriceSkeleton />
		</div>
		<Skeleton className='size-7 shrink-0' />
	</div>
);

const DomainRowPrice = ({ isPriceLoading, item }: { isPriceLoading: boolean; item: DomainSearchItem }) => {
	const t = useTranslations("website.domains");
	const format = useFormatter();

	if (item.available && item.price) {
		return (
			<span className='text-sm tabular-nums text-muted-foreground'>
				{t("perYear", {
					price: format.number(item.price.purchasePrice, { currency: "USD", style: "currency" }),
				})}
			</span>
		);
	}

	if (item.available && isPriceLoading) {
		return <PriceSkeleton />;
	}

	return <span className='text-sm text-muted-foreground'>{t("taken")}</span>;
};

const DomainRow = ({
	controller,
	isPriceLoading,
	item,
}: {
	controller: Controller;
	isPriceLoading: boolean;
	item: DomainSearchItem;
}) => {
	const { can } = useOrganizationPermissions();
	const { price } = item;

	const content = (
		<>
			<span className='flex min-w-0 flex-1 flex-col gap-0.5 text-start'>
				<span
					className={cn("truncate text-sm font-medium", !item.available && "text-muted-foreground")}
					dir='ltr'
				>
					{item.domain}
				</span>
				<DomainRowPrice isPriceLoading={isPriceLoading} item={item} />
			</span>
			{item.available && (
				<span className='flex size-7 shrink-0 items-center justify-center text-muted-foreground'>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={ArrowRight01Icon}
						strokeWidth={1.75}
					/>
				</span>
			)}
		</>
	);

	if (!item.available || !price || !can("workspace.write")) {
		return <div className={rowClassName}>{content}</div>;
	}

	return (
		<button
			className={cn(
				rowClassName,
				"cursor-pointer outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
			)}
			onClick={() => controller.setView({ name: "checkout", offer: { domain: item.domain, ...price } })}
			type='button'
		>
			{content}
		</button>
	);
};

const SearchResults = ({
	controller,
	search,
}: {
	controller: Controller;
	search: ReturnType<typeof useDomainSearch>;
}) => {
	const t = useTranslations("website.domains");

	if (search.isLoading) {
		return (
			<div aria-busy='true' className='grid gap-2 sm:grid-cols-2' role='status'>
				<span className='sr-only'>{t("checking")}</span>
				{skeletonKeys.map((key) => (
					<DomainRowSkeleton key={key} />
				))}
			</div>
		);
	}

	if (search.isError) {
		return (
			<div className='flex flex-col items-center gap-3 p-8 text-center'>
				<p className='font-medium' role='alert'>
					{t(
						search.error instanceof ORPCError && search.error.code === "RATE_LIMITED"
							? "rateLimited"
							: "searchError"
					)}
				</p>
				<Button onClick={search.retry} size='sm' variant='outline'>
					{t("retry")}
				</Button>
			</div>
		);
	}

	if (search.searched && search.items.length === 0) {
		return <p className='p-8 text-center font-medium'>{t("noResults")}</p>;
	}

	return (
		<div aria-live='polite' className='space-y-3'>
			{search.unsupportedSuffix && (
				<p className='text-sm text-muted-foreground'>
					{t("unsupportedSuffix", { suffix: `.${search.unsupportedSuffix}` })}
				</p>
			)}
			<div className='grid gap-2 sm:grid-cols-2'>
				{search.items.map((item) => (
					<DomainRow
						controller={controller}
						isPriceLoading={search.isPriceLoading}
						item={item}
						key={item.domain}
					/>
				))}
			</div>
		</div>
	);
};

export const WebsiteDomainSearch = ({ controller, initialQuery }: { controller: Controller; initialQuery: string }) => {
	const t = useTranslations("website.domains");
	const search = useDomainSearch({ initialQuery });

	return (
		<div className='space-y-4'>
			<InputGroup>
				<InputGroupAddon>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110 text-muted-foreground'
						icon={Search01Icon}
						strokeWidth={1.75}
					/>
				</InputGroupAddon>
				<InputGroupInput
					aria-label={t("searchLabel")}
					autoCapitalize='none'
					autoComplete='off'
					dir='ltr'
					maxLength={80}
					onChange={(event) => search.setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							search.submit();
						}
					}}
					placeholder={t("searchPlaceholder")}
					size='lg'
					spellCheck={false}
					value={search.query}
				/>
			</InputGroup>
			<SearchResults controller={controller} search={search} />
		</div>
	);
};
