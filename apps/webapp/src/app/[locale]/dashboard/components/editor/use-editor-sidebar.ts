"use client";

import { usePathname } from "@/i18n/navigation";

export const useEditorSidebar = (editorPath: string) => {
	const pathname = usePathname();

	return { "data-dashboard-editor": pathname === editorPath ? "" : undefined };
};
