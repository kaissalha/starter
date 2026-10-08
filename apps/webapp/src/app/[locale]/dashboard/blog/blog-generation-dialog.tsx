"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@starter/ui/components/dialog";
import { Input } from "@starter/ui/components/input";
import { Textarea } from "@starter/ui/components/textarea";

export const BlogGenerationDialog = ({
	busy,
	error,
	initialTopic = "",
	onGenerate,
	onOpenChange,
	open,
}: {
	busy: boolean;
	error?: string | null;
	initialTopic?: string;
	onGenerate: (input: { instructions: string; topic: string }) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) => {
	const t = useTranslations("blog");
	const tCommon = useTranslations("common");
	const [topic, setTopic] = useState(initialTopic);
	const [instructions, setInstructions] = useState("");

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent closeLabel={tCommon("close")}>
				<DialogHeader>
					<DialogTitle>{t("generate")}</DialogTitle>
					<DialogDescription>
						{t(initialTopic ? "replaceDescription" : "generateDescription")}
					</DialogDescription>
				</DialogHeader>
				<label className='grid gap-2 text-sm'>
					{t("topic")}
					<Input maxLength={500} onChange={(event) => setTopic(event.target.value)} value={topic} />
				</label>
				<label className='grid gap-2 text-sm'>
					{t("instructions")}
					<Textarea
						maxLength={2000}
						onChange={(event) => setInstructions(event.target.value)}
						value={instructions}
					/>
				</label>
				<DialogFooter>
					<Button
						disabled={busy || !topic.trim()}
						loading={busy}
						onClick={() => onGenerate({ instructions, topic })}
					>
						{t(busy ? "creating" : "generate")}
					</Button>
				</DialogFooter>
				{error && (
					<p className='text-sm text-destructive' role='alert'>
						{error}
					</p>
				)}
			</DialogContent>
		</Dialog>
	);
};
