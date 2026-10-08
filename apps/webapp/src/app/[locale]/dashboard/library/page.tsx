import { Suspense } from "react";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { getTranslations } from "@/lib/i18n";
import { Skeleton } from "@starter/ui/components/skeleton";

import { LibraryPage } from "./library-page";

export const generateMetadata = async () => ({ title: (await getTranslations("library"))("title") });

export default function Page() {
	return (
		<Suspense
			fallback={
				<>
					<Header item={{ labelTx: "library" }} />
					<Skeleton className='m-5 h-10' />
				</>
			}
		>
			<LibraryPage />
		</Suspense>
	);
}
