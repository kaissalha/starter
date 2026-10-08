"use client";

import { useState } from "react";

import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";

export const EditorSuggestionField = ({
	namespace,
	onSubmit,
	pending,
}: {
	namespace: "website.customize" | "website.layout";
	onSubmit: (request: string) => void;
	pending: boolean;
}) => {
	const t = useTranslations(namespace);
	const [value, setValue] = useState("");
	const request = value.trim();

	return (
		<form
			className='flex items-center gap-2'
			onSubmit={(event) => {
				event.preventDefault();

				if (request && !pending) {
					onSubmit(request);
				}
			}}
		>
			<Input
				aria-label={t("suggest.label")}
				className='min-w-0 flex-1'
				disabled={pending}
				maxLength={2000}
				onChange={(event) => setValue(event.currentTarget.value)}
				placeholder={t("suggest.placeholder")}
				value={value}
			/>
			<Button disabled={!request || pending} loading={pending} type='submit' variant='secondary'>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={AiMagicIcon} strokeWidth={1.75} />
				{t("suggest.action")}
			</Button>
		</form>
	);
};
