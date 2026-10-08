"use client";

import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";

export const EditorDraftRecovery = ({
	error,
	hasRecovery,
	onDismiss,
	onDownload,
	onReload,
	onRetry,
	pending,
}: {
	error: "conflict" | "request" | null;
	hasRecovery: boolean;
	onDismiss: () => void;
	onDownload: () => void;
	onReload: () => void;
	onRetry: () => void;
	pending: boolean;
}) => {
	const t = useTranslations("editorRecovery");

	if (!error && !hasRecovery) {
		return null;
	}

	return (
		<div className='flex flex-wrap items-center gap-3 p-4 text-sm' role={error ? "alert" : "status"}>
			<p className={error ? "text-destructive" : "text-muted-foreground"}>{t(error ?? "recovered")}</p>
			{error && (
				<Button
					disabled={pending}
					onClick={error === "conflict" ? onReload : onRetry}
					size='sm'
					variant='outline'
				>
					{t(error === "conflict" ? "loadLatest" : "retry")}
				</Button>
			)}
			<Button onClick={onDownload} size='sm' variant='outline'>
				{t("download")}
			</Button>
			{!error && (
				<Button onClick={onDismiss} size='sm' variant='ghost'>
					{t("dismiss")}
				</Button>
			)}
		</div>
	);
};
