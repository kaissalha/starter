"use client";

import { useState } from "react";

import { ArrowLeft01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@starter/ui/components/input-group";
import { cn } from "@starter/ui/lib/utils";

import { Header, type HeaderProps } from "./header";

type SearchableHeaderProps = HeaderProps & {
	onSearchChange: (value: string) => void;
	search: string;
	searchPlaceholder?: string;
};

export const SearchableHeader = ({
	actions,
	className,
	onSearchChange,
	search,
	searchPlaceholder,
	...headerProps
}: SearchableHeaderProps) => {
	const t = useTranslations("common");
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
	const placeholder = searchPlaceholder ?? t("search");

	const searchIcon = (
		<HugeiconsIcon aria-hidden className='size-3.5 scale-110' icon={Search01Icon} strokeWidth={1.75} />
	);

	if (mobileSearchOpen) {
		return (
			<div
				className={cn(
					"sticky top-0 z-50 flex shrink-0 items-center gap-2 bg-background px-4 pt-4 pb-3 md:px-5",
					className
				)}
			>
				<Button
					aria-label={t("actions.back")}
					className='-ms-1 shrink-0'
					onClick={() => {
						setMobileSearchOpen(false);
						onSearchChange("");
					}}
					size='icon'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden className='scale-110' icon={ArrowLeft01Icon} strokeWidth={1.75} />
				</Button>
				<InputGroup className='min-w-0 flex-1'>
					<InputGroupAddon>{searchIcon}</InputGroupAddon>
					<InputGroupInput
						aria-label={placeholder}
						autoFocus
						maxLength={200}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={placeholder}
						value={search}
					/>
					{search && (
						<InputGroupAddon align='inline-end'>
							<Button
								aria-label={t("close")}
								onClick={() => onSearchChange("")}
								size='icon-xs'
								variant='ghost'
							>
								<HugeiconsIcon
									aria-hidden
									className='scale-110'
									icon={Cancel01Icon}
									strokeWidth={1.75}
								/>
							</Button>
						</InputGroupAddon>
					)}
				</InputGroup>
			</div>
		);
	}

	return (
		<Header
			actions={
				<>
					<InputGroup className='hidden h-8 w-48 md:inline-flex'>
						<InputGroupAddon>{searchIcon}</InputGroupAddon>
						<InputGroupInput
							aria-label={placeholder}
							maxLength={200}
							onChange={(event) => onSearchChange(event.target.value)}
							placeholder={placeholder}
							value={search}
						/>
					</InputGroup>
					<Button
						aria-label={placeholder}
						className='md:hidden'
						onClick={() => setMobileSearchOpen(true)}
						size='icon'
						variant='ghost'
					>
						{searchIcon}
					</Button>
					{actions}
				</>
			}
			className={className}
			{...headerProps}
		/>
	);
};
