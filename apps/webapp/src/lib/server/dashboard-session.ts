import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getServerSession } from "@/lib/server/auth";

export const requireDashboardSession = async () => {
	const [locale, session] = await Promise.all([getLocale(), getServerSession()]);

	if (!session) {
		return redirect({ href: "/login", locale });
	}

	if (!session.session.activeOrganizationId) {
		return redirect({ href: "/onboarding", locale });
	}

	return session;
};
