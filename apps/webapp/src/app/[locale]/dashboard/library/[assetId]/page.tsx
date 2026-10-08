import { Suspense } from "react";

import { notFound } from "next/navigation";

import { z } from "zod";

import { getTranslations } from "@/lib/i18n";
import { Skeleton } from "@starter/ui/components/skeleton";

import { LibraryAssetPage } from "../library-asset-page";

export const generateMetadata = async () => ({ title: (await getTranslations("library"))("title") });

const LibraryAssetRouteContent = async ({ params }: { params: Promise<{ assetId: string }> }) => {
	const { assetId } = await params;

	if (!z.uuid().safeParse(assetId).success) {
		notFound();
	}

	return <LibraryAssetPage assetId={assetId} />;
};

export default function Page(props: { params: Promise<{ assetId: string }> }) {
	return (
		<Suspense fallback={<Skeleton className='m-5 h-10' />}>
			<LibraryAssetRouteContent {...props} />
		</Suspense>
	);
}
