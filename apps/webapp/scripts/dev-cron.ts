import vercel from "../vercel.json";

const secret = process.env.CRON_SECRET;

const origin = process.env.WEBAPP_URL ?? "http://localhost:3000";

const everyMinute = vercel.crons
	.filter(({ schedule }) => schedule === "* * * * *")
	.map(({ path }) => new URL(path, origin));

const runCrons = () =>
	Promise.allSettled(everyMinute.map((url) => fetch(url, { headers: { authorization: `Bearer ${secret}` } })));

if (secret) {
	setInterval(runCrons, 60_000);
}
