"use client";

import * as React from "react";

export const useCopyToClipboard = ({ onCopy, timeout = 2000 }: { onCopy?: () => void; timeout?: number } = {}) => {
	const [isCopied, setIsCopied] = React.useState(false);
	const timeoutIdRef = React.useRef<number | null>(null);

	const copyToClipboard = (value: string): void => {
		const clipboard = globalThis.window?.navigator.clipboard;

		if (!clipboard?.writeText) {
			return;
		}

		if (!value) {
			return;
		}

		(async () => {
			try {
				await clipboard.writeText(value);

				if (timeoutIdRef.current) {
					clearTimeout(timeoutIdRef.current);
				}

				setIsCopied(true);

				if (onCopy) {
					onCopy();
				}

				if (timeout !== 0) {
					timeoutIdRef.current = window.setTimeout(() => {
						setIsCopied(false);
						timeoutIdRef.current = null;
					}, timeout);
				}
			} catch (error) {
				console.error("Failed to copy text to clipboard", error);
			}
		})();
	};

	React.useEffect(() => {
		return () => {
			if (timeoutIdRef.current) {
				clearTimeout(timeoutIdRef.current);
			}
		};
	}, []);

	return { copyToClipboard, isCopied };
};
