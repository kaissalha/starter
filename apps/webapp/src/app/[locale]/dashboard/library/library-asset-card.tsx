"use client";

import Image from "next/image";

import { Layers01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { client } from "@/lib/api-client";
import { Badge } from "@starter/ui/components/badge";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import { Spinner } from "@starter/ui/components/spinner";
import { cn } from "@starter/ui/lib/utils";

const documentTypes = new Map([
	["application/pdf", { label: "PDF", tone: "bg-destructive" }],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { label: "XLSX", tone: "bg-success" }],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { label: "DOCX", tone: "bg-info" }],
	["text/csv", { label: "CSV", tone: "bg-success" }],
	["text/markdown", { label: "MD", tone: "bg-muted-foreground" }],
	["text/plain", { label: "TXT", tone: "bg-muted-foreground" }],
]);

const pageLines = ["w-full", "w-[92%]", "w-[96%]", "w-[70%]", "w-full", "w-[84%]"];

const pageLineKeys = ["a", "b", "c", "d", "e", "f"];

const sheetCells = Array.from({ length: 18 }, (_, cell) => cell);

type LibraryAsset = Awaited<ReturnType<typeof client.library.list>>["items"][number];

export const LibraryGeneratingPreview = ({ label }: { label: string }) => (
	<div
		className='flex size-full animate-pulse flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground motion-reduce:animate-none'
		role='status'
	>
		<Spinner className='size-5' />
		{label}
	</div>
);

const LibraryAssetPreview = ({ asset }: { asset: LibraryAsset }) => {
	const t = useTranslations("library");

	if (asset.generating) {
		return <LibraryGeneratingPreview label={t("generating")} />;
	}

	if (asset.kind === "image" && asset.url) {
		return (
			<Image
				alt=''
				className='size-full object-cover transition-transform duration-300 ease-out group-hover/asset:scale-[1.03] motion-reduce:transition-none'
				height={400}
				sizes='(min-width:1536px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw'
				src={asset.url}
				width={533}
			/>
		);
	}

	if (asset.kind === "video" && asset.url) {
		return <video className='size-full object-cover' muted playsInline preload='metadata' src={asset.url} />;
	}

	const type = documentTypes.get(asset.contentType) ?? { label: "DOC", tone: "bg-muted-foreground" };

	return (
		<div className='grid size-full place-items-center bg-muted transition-colors group-hover/asset:bg-muted-foreground/10 motion-reduce:transition-none'>
			<div className='relative flex aspect-[3/4] w-[46%] flex-col gap-[7%] rounded-md bg-background p-[10%] smooth-shadow-sm ring-1 ring-foreground/5 transition-transform duration-300 group-hover/asset:-translate-y-1 motion-reduce:transition-none'>
				{type.label === "XLSX" ? (
					<div className='grid flex-1 grid-cols-3 content-start gap-px overflow-hidden rounded-[2px] bg-muted-foreground/20'>
						{sheetCells.map((cell) => (
							<span className={cn("h-2.5", cell < 3 ? "bg-muted" : "bg-background")} key={cell} />
						))}
					</div>
				) : (
					<>
						<span className='h-[6%] w-3/5 rounded-full bg-muted-foreground/30' />
						{pageLines.map((width, line) => (
							<span
								className={cn("h-[3.5%] rounded-full bg-muted-foreground/15", width)}
								key={pageLineKeys[line]}
							/>
						))}
					</>
				)}
				<span
					className={cn(
						"absolute start-[10%] bottom-[8%] rounded px-1 py-px text-[9px] font-semibold tracking-wide text-white",
						type.tone
					)}
				>
					{type.label}
				</span>
			</div>
		</div>
	);
};

export const LibraryAssetCard = ({ asset }: { asset: LibraryAsset }) => {
	const t = useTranslations("library");
	const format = useFormatter();

	return (
		<Link
			className='group/asset min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
			href={`/dashboard/library/${asset.id}`}
			prefetch={true}
		>
			<Frame className='h-full'>
				<FramePanel padding='none'>
					<div className='relative aspect-[4/3] overflow-hidden rounded-[inherit]'>
						<LibraryAssetPreview asset={asset} />
						{asset.versionCount > 1 && (
							<span className='absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-foreground/64 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-background backdrop-blur-sm'>
								<HugeiconsIcon
									aria-hidden
									className='size-3 scale-110'
									icon={Layers01Icon}
									strokeWidth={1.75}
								/>
								{t("versionCount", { count: asset.versionCount })}
							</span>
						)}
					</div>
				</FramePanel>
				<div className='grid gap-1.5 px-3 pt-3 pb-2.5'>
					<p className='truncate text-sm font-medium' dir='auto'>
						{asset.name}
					</p>
					<div className='flex min-w-0 items-center justify-between gap-2'>
						{!asset.generating && (asset.status === "pending" || asset.status === "failed") ? (
							<Badge
								role={asset.status === "pending" ? "status" : undefined}
								variant={asset.status === "failed" ? "critical" : "default"}
							>
								{t(asset.status === "pending" ? "processing" : "failed")}
							</Badge>
						) : (
							<span className='truncate text-xs text-muted-foreground uppercase'>
								{asset.generated ? `${t("generated")} · ` : ""}
								{documentTypes.get(asset.contentType)?.label ?? asset.contentType.split("/").pop()}
							</span>
						)}
						<time
							className='shrink-0 text-xs text-muted-foreground tabular-nums'
							dateTime={asset.createdAt}
						>
							{format.dateTime(new Date(asset.createdAt), { day: "numeric", month: "short" })}
						</time>
					</div>
				</div>
			</Frame>
		</Link>
	);
};
