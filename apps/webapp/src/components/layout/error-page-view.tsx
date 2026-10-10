"use client";

import { ComputerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type ErrorPageViewProps = {
	description: string;
	retryControl: React.ReactNode;
	title: string;
};

export const ErrorPageView = ({ description, retryControl, title }: ErrorPageViewProps) => {
	return (
		<div className='flex min-h-screen flex-col items-center justify-center p-8'>
			<div className='flex w-full max-w-100 flex-col items-center gap-4'>
				<div className='flex w-full flex-col items-center gap-4'>
					<div className='flex w-full flex-col items-center gap-2'>
						<div className='flex h-16 w-16 items-center justify-center'>
							<HugeiconsIcon
								aria-hidden='true'
								className='h-16 w-16 text-foreground scale-110'
								icon={ComputerIcon}
								strokeWidth={1.75}
							/>
						</div>

						<h1 className='text-center font-semibold text-foreground'>{title}</h1>

						<p className='text-center font-medium leading-snug text-muted-foreground'>{description}</p>
					</div>

					{retryControl}
				</div>
			</div>
		</div>
	);
};
