import { initializeMastraStorage } from "../src/mastra";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not defined in environment variables");
}

await initializeMastraStorage({ connectionString });
