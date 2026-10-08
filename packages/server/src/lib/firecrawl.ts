import { Firecrawl } from "firecrawl";

export const firecrawl = new Firecrawl({
	apiKey: process.env.FIRECRAWL_API_KEY,
	timeoutMs: 20_000,
});
