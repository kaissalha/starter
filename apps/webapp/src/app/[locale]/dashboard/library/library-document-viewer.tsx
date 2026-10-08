"use client";

import type { ReactNode } from "react";

import { useTheme } from "@wrksz/themes/client";
import { useMessages, useTranslations } from "next-intl";

import {
	DocumentViewerLabelsProvider,
	DocumentViewerToolbarLeadingProvider,
	DocxViewerPreview,
	PDFViewer,
	XlsxViewerPreview,
} from "@starter/documents/viewer";
import { SidebarTrigger } from "@starter/ui/components/sidebar";

export const LibraryDocumentViewer = ({
	actions,
	kind,
	leading,
	name,
	src,
}: {
	actions: ReactNode;
	kind: "docx" | "pdf" | "xlsx";
	leading: ReactNode;
	name: string;
	src: string;
}) => {
	const { resolvedTheme } = useTheme();
	const labels = useMessages().library.viewer;
	const tCommon = useTranslations("common");

	const shared = {
		className: "h-auto min-h-0 flex-1",
		fileName: name,
		showDownload: false,
		showUpload: false,
		src,
		toolbarActions: actions,
	};

	const isDark = resolvedTheme === "dark";

	return (
		<DocumentViewerLabelsProvider value={labels}>
			<DocumentViewerToolbarLeadingProvider
				value={
					<>
						<SidebarTrigger
							aria-label={tCommon("toggleNavigation")}
							className='shrink-0 md:hidden'
							purpose='navigation'
						/>
						{leading}
					</>
				}
			>
				{kind === "pdf" && <PDFViewer {...shared} defaultZoom='fit-width' />}
				{kind === "docx" && <DocxViewerPreview {...shared} defaultZoom='fit-width' isDark={false} />}
				{kind === "xlsx" && <XlsxViewerPreview {...shared} isDark={isDark} />}
			</DocumentViewerToolbarLeadingProvider>
		</DocumentViewerLabelsProvider>
	);
};
