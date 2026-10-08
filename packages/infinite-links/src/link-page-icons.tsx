type ActionIcon = { circles?: ReadonlyArray<{ cx: string; cy: string; r: string }>; paths: ReadonlyArray<string> };

const actionIcons = {
	chevron: { paths: ["m6 9 6 6 6-6"] },
	close: { paths: ["M18 6 6 18", "m6 6 12 12"] },
	contact: {
		circles: [{ cx: "9", cy: "7", r: "4" }],
		paths: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M19 8v6", "M22 11h-6"],
	},
	menu: { paths: ["M4 6h16", "M4 12h16", "M4 18h16"] },
	search: { circles: [{ cx: "11", cy: "11", r: "8" }], paths: ["m21 21-4.34-4.34"] },
	send: { paths: ["m9 18 6-6-6-6"] },
	share: {
		circles: [
			{ cx: "18", cy: "5", r: "3" },
			{ cx: "6", cy: "12", r: "3" },
			{ cx: "18", cy: "19", r: "3" },
		],
		paths: ["M8.59 13.51l6.83 3.98", "M15.41 6.51l-6.82 3.98"],
	},
} satisfies Record<string, ActionIcon>;

export type LinkPageActionIconName = keyof typeof actionIcons;

export const LinkPageActionIcon = ({ className, name }: { className: string; name: LinkPageActionIconName }) => {
	const icon: ActionIcon = actionIcons[name];

	return (
		<svg
			aria-hidden='true'
			className={className}
			fill='none'
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth='2'
			viewBox='0 0 24 24'
		>
			{icon.circles?.map((circle) => (
				<circle key={`${circle.cx}-${circle.cy}`} {...circle} />
			))}
			{icon.paths.map((d) => (
				<path d={d} key={d} />
			))}
		</svg>
	);
};

export const LinkPageVerifiedBadge = ({ className }: { className: string }) => (
	<svg aria-hidden='true' className={className} viewBox='0 0 24 24'>
		<path
			d='M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z'
			fill='#1b97f5'
		/>
	</svg>
);
