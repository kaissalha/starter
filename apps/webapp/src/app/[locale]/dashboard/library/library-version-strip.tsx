"use client";

import Image from "next/image";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { client } from "@/lib/api-client";
import { Spinner } from "@starter/ui/components/spinner";
import { cn } from "@starter/ui/lib/utils";

type LibraryAssetVersion = Awaited<ReturnType<typeof client.library.get>>["versions"][number];

export const LibraryVersionStrip = ({
	currentId,
	versions,
}: {
	currentId: string;
	versions: Array<LibraryAssetVersion>;
}) => {
	const t = useTranslations("library");

	if (versions.length < 2) {
		return null;
	}

	return (
		<nav aria-label={t("versions")} className='flex shrink-0 overflow-x-auto px-4 pb-4 no-scrollbar'>
			<ol className='mx-auto flex items-center gap-2 p-1'>
				{versions.map((version, index) => {
					const current = version.id === currentId;

					return (
						<li key={version.id}>
							<Link
								aria-current={current ? "page" : undefined}
								aria-label={t("version", { number: index + 1 })}
								className={cn(
									"relative flex size-14 items-center justify-center overflow-hidden rounded-lg border bg-muted outline-none transition-[opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
									current
										? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
										: "opacity-64 hover:opacity-100"
								)}
								href={`/dashboard/library/${version.id}`}
								replace
								scroll={false}
							>
								{version.generating || !version.url ? (
									<Spinner className='size-4' />
								) : (
									<Image
										alt=''
										className='size-full object-cover'
										height={56}
										sizes='56px'
										src={version.url}
										width={56}
									/>
								)}
							</Link>
						</li>
					);
				})}
			</ol>
		</nav>
	);
};
