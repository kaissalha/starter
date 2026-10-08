"use client";

import { useTranslations } from "next-intl";

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";

export const ConfirmDestructiveEdit = ({
	confirmLabel,
	description,
	onConfirm,
	onOpenChange,
	open,
	title,
}: {
	confirmLabel: string;
	description: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}) => {
	const tCommon = useTranslations("common");

	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<Button onClick={() => onOpenChange(false)} type='button' variant='secondary'>
						{tCommon("cancel")}
					</Button>
					<Button
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
						type='button'
						variant='destructive'
					>
						{confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
