import { Suspense } from "react";

import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { LoginPageClient } from "./login-page-client";
import { LoginPageSkeleton } from "./login-page-skeleton";

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("account.login");

	return {
		robots: { follow: false, index: false },
		title: t("pageTitle"),
	};
};

export default function LoginPage() {
	return (
		<Suspense fallback={<LoginPageSkeleton />}>
			<LoginPageClient />
		</Suspense>
	);
}
