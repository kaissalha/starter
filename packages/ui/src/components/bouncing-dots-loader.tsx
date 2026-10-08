export const BouncingDotsLoader = () => {
	return (
		<div className='flex items-center justify-center gap-1.5'>
			<div
				className='animate-bouncing-loader h-1 w-1 rounded-full bg-current opacity-100'
				style={{ animationDelay: "0s" }}
			/>
			<div
				className='animate-bouncing-loader h-1 w-1 rounded-full bg-current opacity-100'
				style={{ animationDelay: "0.2s" }}
			/>
			<div
				className='animate-bouncing-loader h-1 w-1 rounded-full bg-current opacity-100'
				style={{ animationDelay: "0.4s" }}
			/>
		</div>
	);
};
