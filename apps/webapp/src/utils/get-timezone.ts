import { headers } from "next/headers";

export const getTimezone = async () => (await headers()).get("x-vercel-ip-timezone") || "America/New_York";
