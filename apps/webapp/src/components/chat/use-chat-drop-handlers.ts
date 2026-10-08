"use client";

import { useCallback, useState } from "react";

type UseChatDropHandlersOptions = {
	disabled?: boolean;
	onFiles: (files: Array<File>) => void;
};

const hasDraggedFiles = (event: React.DragEvent<HTMLElement>) =>
	Array.from(event.dataTransfer.items).some((item) => item.kind === "file");

export const useChatDropHandlers = ({ disabled = false, onFiles }: UseChatDropHandlersOptions) => {
	const [isDraggingOver, setIsDraggingOver] = useState(false);

	const handleDragEnter = useCallback(
		(event: React.DragEvent<HTMLElement>) => {
			if (disabled || !hasDraggedFiles(event)) {
				return;
			}

			event.preventDefault();
			setIsDraggingOver(true);
		},
		[disabled]
	);

	const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
		if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
			return;
		}

		setIsDraggingOver(false);
	}, []);

	const handleDragOver = useCallback(
		(event: React.DragEvent<HTMLElement>) => {
			if (disabled) {
				return;
			}

			if (hasDraggedFiles(event)) {
				event.preventDefault();
			}
		},
		[disabled]
	);

	const handleDrop = useCallback(
		(event: React.DragEvent<HTMLElement>) => {
			setIsDraggingOver(false);

			if (disabled) {
				return;
			}

			const files = Array.from(event.dataTransfer.files);

			if (files.length === 0) {
				return;
			}

			event.preventDefault();
			onFiles(files);
		},
		[disabled, onFiles]
	);

	return { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, isDraggingOver };
};
