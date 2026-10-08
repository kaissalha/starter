import { Button } from "@starter/ui/components/button";

type OnboardingErrorStateProps = {
	actionLabel: string;
	description: string;
	onAction: () => void;
	title: string;
};

export const OnboardingErrorState = ({ actionLabel, description, onAction, title }: OnboardingErrorStateProps) => {
	return (
		<div className='rounded-xl border border-border bg-muted/35 p-5 sm:p-6'>
			<div className='space-y-2'>
				<h2 className='text-base font-semibold'>{title}</h2>
				<p className='text-sm text-muted-foreground'>{description}</p>
			</div>
			<div className='mt-5'>
				<Button className='w-full' onClick={onAction} size='lg' type='button'>
					{actionLabel}
				</Button>
			</div>
		</div>
	);
};
