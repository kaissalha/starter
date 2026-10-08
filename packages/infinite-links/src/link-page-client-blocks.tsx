"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import type { LinkPageLink } from "./contracts";
import { LinkPageActionIcon, type LinkPageActionIconName } from "./link-page-icons";

const bounceKeyframes = {
	jello: [
		{ transform: "skewX(0)" },
		{ offset: 0.11, transform: "skewX(-12deg)" },
		{ offset: 0.22, transform: "skewX(6deg)" },
		{ offset: 0.33, transform: "skewX(-3deg)" },
		{ offset: 0.44, transform: "skewX(1.5deg)" },
		{ offset: 0.55, transform: "skewX(0)" },
		{ transform: "skewX(0)" },
	],
	jump: [
		{ transform: "translateY(0)" },
		{ offset: 0.2, transform: "translateY(-12px)" },
		{ offset: 0.4, transform: "translateY(0)" },
		{ transform: "translateY(0)" },
	],
	pulse: [
		{ transform: "scale(1)" },
		{ offset: 0.25, transform: "scale(1.04)" },
		{ offset: 0.5, transform: "scale(1)" },
		{ transform: "scale(1)" },
	],
	rubber: [
		{ transform: "scale(1, 1)" },
		{ offset: 0.15, transform: "scale(1.15, 0.85)" },
		{ offset: 0.3, transform: "scale(0.85, 1.15)" },
		{ offset: 0.45, transform: "scale(1.08, 0.92)" },
		{ offset: 0.6, transform: "scale(1, 1)" },
		{ transform: "scale(1, 1)" },
	],
	shake: [
		{ transform: "translateX(0)" },
		{ offset: 0.1, transform: "translateX(-6px) rotateY(-9deg)" },
		{ offset: 0.2, transform: "translateX(5px) rotateY(7deg)" },
		{ offset: 0.3, transform: "translateX(-3px) rotateY(-5deg)" },
		{ offset: 0.4, transform: "translateX(2px) rotateY(3deg)" },
		{ offset: 0.5, transform: "translateX(0)" },
		{ transform: "translateX(0)" },
	],
	swing: [
		{ transform: "rotate(0)" },
		{ offset: 0.1, transform: "rotate(8deg)" },
		{ offset: 0.2, transform: "rotate(-6deg)" },
		{ offset: 0.3, transform: "rotate(3deg)" },
		{ offset: 0.4, transform: "rotate(-2deg)" },
		{ offset: 0.5, transform: "rotate(0)" },
		{ transform: "rotate(0)" },
	],
	tada: [
		{ transform: "scale(1) rotate(0)" },
		{ offset: 0.1, transform: "scale(0.94) rotate(-3deg)" },
		{ offset: 0.3, transform: "scale(1.08) rotate(3deg)" },
		{ offset: 0.4, transform: "scale(1.08) rotate(-3deg)" },
		{ offset: 0.5, transform: "scale(1) rotate(0)" },
		{ transform: "scale(1) rotate(0)" },
	],
} satisfies Record<NonNullable<LinkPageLink["animation"]>, Array<Keyframe>>;

export const LinkPageBounce = ({
	animation,
	children,
}: {
	animation: NonNullable<LinkPageLink["animation"]>;
	children: ReactNode;
}) => {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = ref.current;

		if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const player = node.animate(bounceKeyframes[animation], { duration: 3000, iterations: Infinity });

		return () => player.cancel();
	}, [animation]);

	return (
		<div className='w-full' ref={ref}>
			{children}
		</div>
	);
};

export const LinkPageMarqueeTrack = ({
	children,
	className,
	speed,
}: {
	children: ReactNode;
	className: string;
	speed: number;
}) => {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = ref.current;

		if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const distance = node.scrollWidth / 2;

		const player = node.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-distance}px)` }], {
			duration: distance / (20 + 80 * speed) / 0.001,
			iterations: Infinity,
		});

		return () => player.cancel();
	}, [speed]);

	return (
		<div className={`flex w-max whitespace-nowrap ${className}`} ref={ref}>
			{children}
			{children}
		</div>
	);
};

const pad = (value: number) => String(value).padStart(2, "0");

const remaining = (endsAt: string) => {
	const total = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));

	return {
		days: Math.floor(total / 86_400),
		hours: pad(Math.floor((total % 86_400) / 3600)),
		minutes: pad(Math.floor((total % 3600) / 60)),
		seconds: pad(total % 60),
		total,
	};
};

export const LinkPageCountdownClock = ({
	endedMessage,
	endsAt,
	labels,
}: {
	endedMessage: string;
	endsAt: string;
	labels: { days: string; hours: string; minutes: string; seconds: string };
}) => {
	const [time, setTime] = useState(() => remaining(endsAt));
	useEffect(() => {
		const timer = window.setInterval(() => setTime(remaining(endsAt)), 1000);

		return () => window.clearInterval(timer);
	}, [endsAt]);

	if (time.total === 0) {
		return <span className='text-[16px] leading-[1.3] font-semibold'>{endedMessage}</span>;
	}

	const units = [
		[time.days, labels.days],
		[time.hours, labels.hours],
		[time.minutes, labels.minutes],
		[time.seconds, labels.seconds],
	] as const;

	return (
		<span className='flex justify-center gap-[16.5px]'>
			{units.map(([value, label]) => (
				<span className='flex min-w-[44px] flex-col items-center' key={label}>
					<span className='text-[24px] leading-[1.1] font-bold tabular-nums'>{value}</span>
					<span className='mt-[4px] text-[11px] leading-[1.2] tracking-[0.08em] uppercase opacity-75'>
						{label}
					</span>
				</span>
			))}
		</span>
	);
};

export const LinkPageDismissible = ({ children, className }: { children: ReactNode; className: string }) => {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) {
		return null;
	}

	return (
		<div className={`relative ${className}`}>
			{children}
			<button
				className='absolute end-[6px] top-[6px] flex size-7 items-center justify-center opacity-70'
				onClick={() => setDismissed(true)}
				type='button'
			>
				<LinkPageActionIcon className='size-4' name='close' />
			</button>
		</div>
	);
};

const actionButtonClassName =
	"flex size-[35px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.4)] text-[var(--foreground-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]";

const escapeVcf = (value: string) => value.replaceAll(/[,;\\]/gu, (match) => `\\${match}`);

const downloadContact = ({ title, url }: { title: string; url: string }) => {
	const card = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVcf(title)}`, `URL:${url}`, "END:VCARD"].join("\r\n");
	const href = URL.createObjectURL(new Blob([card], { type: "text/vcard" }));
	const anchor = document.createElement("a");
	anchor.href = href;
	anchor.download = `${title || "contact"}.vcf`;
	anchor.click();
	URL.revokeObjectURL(href);
};

const share = async ({ title, url }: { title: string; url: string }) => {
	try {
		if (navigator.share) {
			await navigator.share({ title, url });

			return;
		}

		await navigator.clipboard.writeText(url);
	} catch {
		return;
	}
};

const applySearch = (query: string) => {
	const needle = query.trim().toLowerCase();

	for (const node of document.querySelectorAll<HTMLElement>("[data-links-search]")) {
		node.hidden = needle.length > 0 && !(node.dataset.linksSearch ?? "").includes(needle);
	}
};

const ActionButton = ({
	label,
	name,
	onClick,
}: {
	label: string;
	name: LinkPageActionIconName;
	onClick: () => void;
}) => (
	<button aria-label={label} className={actionButtonClassName} onClick={onClick} title={label} type='button'>
		<LinkPageActionIcon className='size-5' name={name} />
	</button>
);

export const LinkPageActions = ({
	actions,
	labels,
	menu,
	title,
	url,
}: {
	actions: { contact: boolean; search: boolean; share: boolean };
	labels: { contact: string; menu: string; search: string; share: string };
	menu: Array<{ id: string; label: string; url: string }>;
	title: string;
	url: string;
}) => {
	const [searching, setSearching] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuId = useId();
	const pageUrl = () => url || window.location.href;

	const shareButton = (
		<ActionButton label={labels.share} name='share' onClick={() => share({ title, url: pageUrl() })} />
	);

	const rightSide = actions.search || menu.length > 0;

	if (searching) {
		return (
			<div className='absolute inset-x-[17px] top-[17px] z-20 flex items-center gap-[6px]'>
				<input
					aria-label={labels.search}
					autoFocus
					className='h-[35px] flex-1 rounded-full bg-[rgba(255,255,255,0.7)] px-4 text-[14px] text-[#1d1d28] outline-none'
					onChange={(event) => applySearch(event.target.value)}
					placeholder={labels.search}
					type='search'
				/>
				<ActionButton
					label={labels.search}
					name='close'
					onClick={() => {
						applySearch("");
						setSearching(false);
					}}
				/>
			</div>
		);
	}

	return (
		<div className='absolute inset-x-[17px] top-[17px] z-20 flex items-start justify-between'>
			<div className='flex gap-[6px]'>
				{actions.contact && (
					<ActionButton
						label={labels.contact}
						name='contact'
						onClick={() => downloadContact({ title, url: pageUrl() })}
					/>
				)}
				{actions.share && rightSide && shareButton}
			</div>
			<div className='relative flex gap-[6px]'>
				{actions.share && !rightSide && shareButton}
				{actions.search && (
					<ActionButton label={labels.search} name='search' onClick={() => setSearching(true)} />
				)}
				{menu.length > 0 && (
					<>
						<button
							aria-controls={menuId}
							aria-expanded={menuOpen}
							aria-label={labels.menu}
							className={actionButtonClassName}
							onClick={() => setMenuOpen((open) => !open)}
							type='button'
						>
							<LinkPageActionIcon className='size-5' name='menu' />
						</button>
						{menuOpen && (
							<ul
								className='absolute end-0 top-[41px] min-w-[160px] rounded-[12px] bg-white p-2 text-[#1d1d28] shadow-[0_10px_30px_rgba(0,0,0,0.2)]'
								id={menuId}
							>
								{menu.map((item) => (
									<li key={item.id}>
										<a
											className='block rounded-[8px] px-3 py-2 text-[14px] font-semibold'
											href={item.url}
										>
											{item.label}
										</a>
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</div>
		</div>
	);
};
