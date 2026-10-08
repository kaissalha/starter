import { useCallback } from "react";

import { usePathname } from "@/i18n/navigation";

export const useIsMenuItemActive = () => {
	const pathname = usePathname();

	const isMenuItemActive = useCallback(
		(itemUrl: string, exactMatch = false) =>
			pathname === itemUrl || (!exactMatch && pathname.startsWith(`${itemUrl}/`)),
		[pathname]
	);

	return {
		isMenuItemActive,
	};
};
