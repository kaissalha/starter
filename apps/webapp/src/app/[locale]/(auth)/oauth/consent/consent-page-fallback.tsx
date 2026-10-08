import { Card, CardHeader, CardPanel } from "@starter/ui/components/card";
import { Skeleton } from "@starter/ui/components/skeleton";

export const ConsentPageFallback = () => {
	return (
		<main aria-busy='true' className='flex min-h-dvh items-center justify-center bg-background px-4 py-20 sm:px-6'>
			<Card className='w-full max-w-lg overflow-hidden' corners='rounded'>
				<CardHeader>
					<Skeleton className='size-11' corners='rounded' />
					<div className='space-y-2'>
						<Skeleton className='h-7 w-56 max-w-full' />
						<Skeleton className='h-5 w-72 max-w-full' />
					</div>
				</CardHeader>
				<CardPanel spacing='default'>
					<Skeleton className='h-5 w-40' />
					<Skeleton className='h-5 w-full' />
					<Skeleton className='h-5 w-5/6' />
					<Skeleton className='h-5 w-4/6' />
				</CardPanel>
			</Card>
		</main>
	);
};
