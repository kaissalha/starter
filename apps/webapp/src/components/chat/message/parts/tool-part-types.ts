export type ToolState =
	| "approval-requested"
	| "approval-responded"
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-denied"
	| "output-error";

export type ToolApproval = {
	approved?: boolean;
	id: string;
	isAutomatic?: boolean;
	reason?: string;
};
