import type { LinkPageLinkDesign } from "./contracts";

type LinkDesign = {
	decoration?: "arrow" | "browser" | "dots" | "overlay";
	image: string;
	imageless?: { item: string; text: string };
	item: string;
	list: string;
	pager?: true;
	studio?: true;
	text: string;
};

const studioText = "w-full px-[13.75px] py-[16.5px] text-center";

export const linkPageDesignClasses = {
	"advanced-01": {
		decoration: "browser",
		image: "mx-auto my-8 aspect-square w-[74%] rounded-full",
		item: "flex-col p-4 pt-7",
		list: "flex flex-col gap-5",
		text: "w-full pb-2 text-start",
	},
	"advanced-02": {
		image: "mx-auto my-5 aspect-square w-[76%]",
		item: "flex-col rounded-none! p-5",
		list: "flex flex-col gap-5",
		text: "order-first w-full text-center",
	},
	"advanced-03": {
		decoration: "arrow",
		image: "mx-auto my-8 aspect-square w-[74%] rounded-full",
		item: "flex-col rounded-sm! p-4",
		list: "flex flex-col gap-5",
		text: "w-full pb-2 pe-8 text-start",
	},
	"advanced-04": {
		decoration: "browser",
		image: "aspect-[3/4] w-full",
		imageless: { item: "flex-col p-0", text: "w-full p-5 pt-9 text-start" },
		item: "flex-col p-0",
		list: "flex flex-col gap-5",
		text: "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-5 pt-16 text-start text-white",
	},
	"advanced-05": {
		image: "size-16 shrink-0 border-e border-dashed border-current/30",
		imageless: { item: "flex-row rounded-none! p-0", text: "flex-1 p-4 text-start" },
		item: "flex-row gap-4 rounded-none! p-0",
		list: "flex flex-col gap-4",
		text: "flex-1 py-4 pe-4 text-start",
	},
	"advanced-06": {
		image: "aspect-[3/4] w-full",
		item: "flex-col rounded-none! p-0",
		list: "grid grid-cols-2 items-start gap-2 [&>*:nth-child(3n+2)]:row-span-2 [&>*:nth-child(3n+2)_img]:aspect-[3/5]",
		text: "w-full p-3 text-start text-xs",
	},
	"advanced-07": {
		image: "aspect-[3/4] w-full",
		item: "flex-col rounded-none! border-0! bg-transparent! p-0 text-[var(--foreground-primary)]! shadow-none!",
		list: "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&>*]:w-[36%] [&>*]:shrink-0 [&>*]:snap-start",
		text: "w-full pt-3 text-center text-xs",
	},
	"advanced-08": {
		image: "aspect-[4/3] w-full",
		imageless: { item: "flex-col rounded-none! p-0", text: "w-full p-4 text-start" },
		item: "flex-col rounded-none! p-0",
		list: "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start",
		text: "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-4 pt-10 text-start text-white",
	},
	"buttons-01": {
		image: "size-11 shrink-0",
		imageless: { item: "min-h-16 flex-row rounded-none! p-2", text: "flex-1 px-4 py-2 text-center" },
		item: "min-h-16 flex-row gap-4 rounded-none! p-2",
		list: "flex flex-col gap-3",
		text: "flex-1 py-2 pe-4 text-start",
	},
	"buttons-02": {
		image: "size-11 shrink-0 rounded-full",
		imageless: { item: "min-h-16 flex-row rounded-full! p-2", text: "flex-1 px-5 py-2 text-center" },
		item: "min-h-16 flex-row gap-4 rounded-full! p-2",
		list: "flex flex-col gap-3",
		text: "flex-1 py-2 pe-5 text-start",
	},
	"buttons-03": {
		image: "size-20 shrink-0",
		imageless: { item: "min-h-16 flex-row rounded-none! p-2", text: "flex-1 px-4 py-3 text-center" },
		item: "min-h-24 flex-row gap-5 rounded-none! p-2",
		list: "flex flex-col gap-3",
		text: "flex-1 py-3 pe-3 text-start",
	},
	"buttons-04": {
		image: "size-10 shrink-0 rounded-full",
		imageless: { item: "min-h-14 flex-row rounded-full! p-2", text: "flex-1 px-4 py-2 text-center" },
		item: "min-h-14 flex-row gap-3 rounded-full! p-2",
		list: "flex flex-col items-center gap-3 [&>*]:w-[85%] [&>*:nth-child(3n+1)]:self-end [&>*:nth-child(3n+2)]:self-start",
		text: "flex-1 py-2 pe-4 text-center",
	},
	"buttons-05": {
		decoration: "dots",
		image: "size-10 shrink-0 rounded-full",
		item: "min-h-16 flex-row gap-3 rounded-none! border-0! border-b! border-current/20! bg-transparent! px-0 py-3 text-[var(--foreground-primary)]! shadow-none!",
		list: "flex flex-col",
		text: "flex-1 text-start",
	},
	"buttons-06": {
		decoration: "arrow",
		image: "size-10 shrink-0",
		item: "min-h-16 flex-row gap-3 rounded-none! border-0! border-b! border-current/20! bg-transparent! px-0 py-3 text-[var(--foreground-primary)]! shadow-none!",
		list: "flex flex-col",
		text: "flex-1 text-start",
	},
	"buttons-07": {
		image: "size-10 shrink-0 rounded-full",
		item: "min-h-16 flex-row gap-3 rounded-none! border-0! bg-transparent! px-0 py-3 text-[var(--foreground-primary)]! shadow-none!",
		list: "flex flex-col gap-1",
		text: "flex-1 text-start",
	},
	"buttons-08": {
		decoration: "arrow",
		image: "aspect-[16/9] w-full",
		item: "flex-col rounded-none! p-0",
		list: "flex flex-col gap-5",
		text: "w-full p-4 pe-10 text-start",
	},
	"buttons-09": {
		image: "w-24 shrink-0 self-stretch",
		imageless: { item: "min-h-14 flex-row p-0", text: "flex-1 self-center px-5 py-4 text-center" },
		item: "min-h-24 flex-row gap-4 p-0",
		list: "flex flex-col gap-3",
		text: "flex-1 self-center py-3 pe-4 text-start",
	},
	"buttons-10": {
		image: "aspect-square w-[32%] shrink-0",
		imageless: { item: "flex-row p-0", text: studioText },
		item: "flex-row items-stretch p-0",
		list: "flex flex-col gap-[var(--lp-gap,12px)]",
		studio: true,
		text: "flex flex-1 flex-col justify-center px-[13.75px] py-2 text-start",
	},
	"cards-01": {
		image: "aspect-square w-full",
		item: "flex-col p-3",
		list: "flex flex-col gap-4",
		text: "w-full px-1 pb-1 pt-3 text-start",
	},
	"cards-02": {
		image: "aspect-[4/3] w-full",
		item: "flex-col rounded-none! p-3",
		list: "flex flex-col gap-4",
		text: "order-first w-full px-1 pb-3 pt-1 text-start",
	},
	"cards-03": {
		image: "aspect-square w-full",
		imageless: { item: "flex-col rounded-none! p-0", text: "w-full p-3 text-start" },
		item: "flex-col rounded-none! p-0",
		list: "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&>*]:w-[42%] [&>*]:shrink-0 [&>*]:snap-start",
		text: "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-start text-white",
	},
	"cards-04": {
		image: "aspect-[3/4] w-full",
		item: "flex-col rounded-none! border-0! bg-transparent! p-0 text-[var(--foreground-primary)]! shadow-none!",
		list: "grid grid-cols-3 gap-3",
		text: "w-full pt-2 text-start text-xs",
	},
	"cards-05": {
		image: "aspect-square w-full",
		imageless: { item: "flex-col rounded-none! p-0", text: "w-full p-5 text-center text-lg" },
		item: "flex-col rounded-none! p-0",
		list: "flex flex-col gap-4",
		text: "absolute inset-0 flex flex-col items-center justify-center bg-black/25 p-5 text-center text-lg text-white",
	},
	"cards-06": {
		image: "aspect-[4/5] w-full",
		item: "flex-col rounded-none! p-4",
		list: "flex flex-col gap-5",
		text: "w-full pb-1 pt-5 text-center",
	},
	"cards-07": {
		image: "aspect-square w-full",
		item: "flex-col rounded-lg! p-2",
		list: "grid grid-cols-2 gap-3",
		text: "w-full px-1 pb-1 pt-2 text-start text-xs",
	},
	"cards-08": {
		image: "aspect-[3/4] w-full",
		item: "flex-col rounded-none! p-0",
		list: "grid grid-cols-2 items-start gap-3 [&>*:nth-child(even)]:mt-10",
		text: "w-full p-3 text-start",
	},
	"cards-09": {
		image: "block h-auto w-full",
		item: "flex-col p-0",
		list: "flex flex-col gap-[var(--lp-gap,12px)]",
		studio: true,
		text: studioText,
	},
	"cards-10": {
		decoration: "overlay",
		image: "absolute inset-0 size-full",
		item: "min-h-[105px] flex-col justify-center p-0",
		list: "flex flex-col gap-[var(--lp-gap,12px)]",
		studio: true,
		text: `relative z-10 ${studioText}`,
	},
	"cards-11": {
		image: "aspect-square w-full",
		item: "flex-col p-0",
		list: "grid grid-cols-2 gap-[var(--lp-gap,12px)]",
		studio: true,
		text: "w-full px-[11px] py-[11px] text-center",
	},
	"cards-12": {
		image: "block h-auto w-full",
		item: "flex-col p-0",
		list: "-mx-[16.5px] flex snap-x snap-mandatory gap-[var(--lp-gap,12px)] overflow-x-auto px-[16.5px] [scrollbar-width:none] [&>*]:w-[80%] [&>*]:shrink-0 [&>*]:snap-start",
		pager: true,
		studio: true,
		text: studioText,
	},
	"cards-13": {
		image: "aspect-square w-full",
		item: "flex-col p-0",
		list: "grid grid-cols-3 gap-[var(--lp-gap,12px)]",
		studio: true,
		text: "w-full px-[8px] py-[8px] text-center text-[0.8em]",
	},
} satisfies Record<LinkPageLinkDesign, LinkDesign>;
