import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleCreateChatStream, handleResumeChatStream } from "@starter/server/chat";

type RouteContext = { params: Promise<{ chatId: string }> };

export const POST = withEvlog(
	withErrorHandler(async (request: Request, { params }: RouteContext) => {
		const routeParams = await params;
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ chat: { id: routeParams.chatId, operation: "create-stream" } });

		return handleCreateChatStream(request, routeParams);
	})
);

export const GET = withEvlog(
	withErrorHandler(async (request: Request, { params }: RouteContext) => {
		const routeParams = await params;
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ chat: { id: routeParams.chatId, operation: "resume-stream" } });

		return handleResumeChatStream(request, routeParams);
	})
);
