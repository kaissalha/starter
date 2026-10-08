import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import { AnalyticsFlag } from "@/app/[locale]/dashboard/analytics/analytics-labels";
import { AnalyticsStatCards } from "@/app/[locale]/dashboard/components/analytics-stat-cards";
import messages from "@/i18n/messages/en.json";

vi.unmock("next-intl");

vi.mock("@starter/ui/components/charts/genui-charts", () => ({
	SpectrumChart: ({ labels, series }: { labels: Array<string>; series: Array<{ values: Array<number> }> }) => (
		<output>{JSON.stringify({ labels, series })}</output>
	),
}));

afterEach(cleanup);

it.each([
	{ available: true, expected: "50%", previous: 2 },
	{ available: true, expected: null, previous: 0 },
	{ available: false, expected: null, previous: 2 },
])(
	"renders truthful comparisons with previous=$previous, available=$available",
	({ available, expected, previous }) => {
		const metrics = {
			bounceRate: 0,
			conversionRate: 0,
			conversions: 0,
			duration: 0,
			engagedTime: 0,
			newVisitors: 3,
			pageviews: 23,
			returningVisitors: 0,
			visitors: 3,
			visits: 7,
		};

		const { container } = render(
			<NextIntlClientProvider locale='en' messages={messages} timeZone='UTC'>
				<AnalyticsStatCards
					data={{
						current: metrics,
						from: "2026-09-01",
						interval: "day",
						previous: { ...metrics, visitors: previous },
						previousAvailable: available,
						previousFrom: "2026-08-30",
						previousTo: "2026-08-31",
						series: [
							{ ...metrics, date: "2026-09-01" },
							{ ...metrics, date: "2026-09-02", visitors: 0 },
						],
						to: "2026-09-02",
					}}
					metrics={["visitors"]}
					sparkline
				/>
			</NextIntlClientProvider>
		);

		expect(container.textContent).toContain(expected ?? "");
		expect(screen.queryAllByText(messages.analytics.vsPrevious).length > 0).toBe(expected !== null);
		expect(container.textContent).not.toMatch(/Previous period/);
		expect(screen.getByRole("heading", { name: "Visitors" })).toBeInTheDocument();
		expect(container.querySelector("output")?.textContent).toBe(
			JSON.stringify({ labels: ["2026-09-01", "2026-09-02"], series: [{ category: "Visitors", values: [3, 0] }] })
		);
		expect(container.textContent).not.toMatch(/Infinity|NaN/);
	}
);

it("loads country flags lazily and tolerates unknown countries", async () => {
	const { container } = render(
		<>
			<AnalyticsFlag country='US' />
			<AnalyticsFlag country='ZZ' />
		</>
	);

	const [known, unknown] = container.querySelectorAll("span[aria-hidden]");
	await waitFor(() => expect(known?.querySelector("svg")).not.toBeNull());
	expect(unknown?.querySelector("svg")).toBeNull();
});
