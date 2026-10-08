import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The Vitest browser pipeline loads CSS side-effect imports.
import "../../src/globals.css";

import { cleanup, render } from "../browser-render";

const reactGlobal: typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean } = globalThis;

reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const flexAlignByTextAlign = {
	"text-center": "center",
	"text-end": "flex-end",
	"text-start": "flex-start",
} as const;

const Skeleton = ({
	align = "text-start",
	color = "#111827",
	direction = "ltr",
	width,
}: {
	align?: "text-center" | "text-end" | "text-start";
	color?: string;
	direction?: "ltr" | "rtl";
	width: number;
}) => (
	<div data-website-viewport dir={direction} style={{ color, width }}>
		<div
			style={{
				alignItems: flexAlignByTextAlign[align],
				display: "flex",
				flexDirection: "column",
			}}
		>
			<p
				aria-busy='true'
				className={`iw-text ${align}`}
				data-appearance='body-md'
				data-pending=''
				style={{ fontSize: 20 }}
				tabIndex={0}
			>
				<span aria-hidden='true' className='iw-text-skeleton'>
					<span className='iw-text-skeleton-line' />
					<span className='iw-text-skeleton-line' />
					<span className='iw-text-skeleton-line' />
				</span>
			</p>
		</div>
	</div>
);

const InlineSkeleton = () => (
	<div data-website-viewport style={{ alignItems: "flex-start", display: "flex", width: 140 }}>
		<span className='iw-text' data-appearance='body-md' data-pending='' style={{ fontSize: 20 }}>
			<span aria-hidden='true' className='iw-text-skeleton'>
				<span className='iw-text-skeleton-line' />
			</span>
		</span>
	</div>
);

afterEach(cleanup);

describe("website text skeleton in Chromium", () => {
	it("fills start-aligned text elements without overflowing narrow containers", async () => {
		const narrow = await render(<Skeleton width={140} />);
		const wide = await render(<Skeleton width={1200} />);
		const centered = await render(<Skeleton align='text-center' width={576} />);
		const inline = await render(<InlineSkeleton />);
		const narrowSkeleton = narrow.querySelector<HTMLElement>(".iw-text-skeleton");
		const wideSkeleton = wide.querySelector<HTMLElement>(".iw-text-skeleton");
		const centeredSkeleton = centered.querySelector<HTMLElement>(".iw-text-skeleton");
		const inlineSkeleton = inline.querySelector<HTMLElement>(".iw-text-skeleton");

		const pendingText = [
			narrow.querySelector<HTMLElement>(".iw-text"),
			wide.querySelector<HTMLElement>(".iw-text"),
			centered.querySelector<HTMLElement>(".iw-text"),
			inline.querySelector<HTMLElement>(".iw-text"),
		];

		if (
			!narrowSkeleton ||
			!wideSkeleton ||
			!centeredSkeleton ||
			!inlineSkeleton ||
			pendingText.some((text) => !text)
		) {
			throw new Error("Skeleton fixture did not render");
		}

		pendingText.forEach((text) => text?.style.setProperty("--iw-inline-size-base", "auto"));

		expect(narrowSkeleton.getBoundingClientRect().width).toBeLessThanOrEqual(140);
		expect(narrowSkeleton.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(Math.abs(wideSkeleton.getBoundingClientRect().width - 1200)).toBeLessThan(1);
		expect(Math.abs(centeredSkeleton.getBoundingClientRect().width - 576)).toBeLessThan(1);
		expect(inlineSkeleton.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(inlineSkeleton.getBoundingClientRect().width).toBeLessThanOrEqual(140);
	});

	it("keeps the transform shimmer visible across theme colors and focus", async () => {
		const light = await render(<Skeleton color='#111827' width={600} />);
		const dark = await render(<Skeleton color='#f9fafb' width={600} />);
		const lightText = light.querySelector<HTMLElement>(".iw-text");
		const lightLine = light.querySelector<HTMLElement>(".iw-text-skeleton-line");
		const darkLine = dark.querySelector<HTMLElement>(".iw-text-skeleton-line");

		if (!lightText || !lightLine || !darkLine) {
			throw new Error("Skeleton fixture did not render");
		}

		lightText.focus();
		expect(document.activeElement).toBe(lightText);
		expect(getComputedStyle(lightLine).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(darkLine).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(lightLine).backgroundColor).not.toBe(getComputedStyle(darkLine).backgroundColor);
		expect(getComputedStyle(lightLine, "::after").animationName).toBe("website-text-skeleton-shimmer");
		expect(getComputedStyle(lightLine, "::after").backgroundImage).not.toBe("none");
	});

	it("aligns the shortened final line logically in RTL", async () => {
		const start = await render(<Skeleton direction='rtl' width={600} />);
		const end = await render(<Skeleton align='text-end' direction='rtl' width={600} />);
		const startSkeleton = start.querySelector<HTMLElement>(".iw-text-skeleton");
		const startLast = start.querySelector<HTMLElement>(".iw-text-skeleton-line:last-child");
		const endSkeleton = end.querySelector<HTMLElement>(".iw-text-skeleton");
		const endLast = end.querySelector<HTMLElement>(".iw-text-skeleton-line:last-child");

		if (!startSkeleton || !startLast || !endSkeleton || !endLast) {
			throw new Error("Skeleton fixture did not render");
		}

		expect(
			Math.abs(startLast.getBoundingClientRect().right - startSkeleton.getBoundingClientRect().right)
		).toBeLessThan(1);
		expect(Math.abs(endLast.getBoundingClientRect().left - endSkeleton.getBoundingClientRect().left)).toBeLessThan(
			1
		);
	});
});
