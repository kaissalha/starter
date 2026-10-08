import { Skeleton } from "@starter/ui/components/skeleton";

export const OnboardingLoadingState = ({ label }: { label: string }) => {
	return (
		<div aria-busy className='space-y-5' role='status'>
			<span className='sr-only'>{label}</span>
			<Skeleton className='h-4 w-3/4' />
			<div className='space-y-2'>
				<Skeleton className='h-4 w-28' />
				<Skeleton className='h-11 w-full' />
			</div>
			<Skeleton className='h-12 w-full' />
			<Skeleton className='h-4 w-2/3' />
		</div>
	);
};
