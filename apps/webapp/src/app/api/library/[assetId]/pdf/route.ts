import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleGetLibraryDocumentPdf } from "@starter/server/api";

export const GET = withEvlog(
	withErrorHandler(async (request: Request, { params }: { params: Promise<{ assetId: string }> }) => {
		const routeParams = await params;
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ library: { assetId: routeParams.assetId, operation: "document-pdf" } });

		return handleGetLibraryDocumentPdf(request, routeParams);
	})
);
