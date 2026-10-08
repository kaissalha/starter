import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import type { Database } from "@starter/db";

type MutableReference<Value> = { value: Value };

const postgresContainerReference: MutableReference<StartedPostgreSqlContainer | undefined> = { value: undefined };

const poolReference: MutableReference<Pool | undefined> = { value: undefined };

const dbReference: MutableReference<Database | undefined> = { value: undefined };

const postgresImage =
	process.env.TEST_POSTGRES_IMAGE ??
	"pgvector/pgvector@sha256:212765b63c1462883de295c4c415edcd22191b8d8d46853e86ad05d4b577a4cb";

const migrationsFolder = fileURLToPath(new URL("./packages/db/src/db/migrations", import.meta.url));

const closePool = async () => {
	const activePool = poolReference.value;
	poolReference.value = undefined;
	dbReference.value = undefined;
	await activePool?.end();
};

const stopPostgresContainer = async () => {
	const activeContainer = postgresContainerReference.value;
	postgresContainerReference.value = undefined;
	await activeContainer?.stop();
};

const cleanup = async (task: () => Promise<void>) => {
	try {
		await task();
	} catch (error) {
		console.error(error);
	}
};

export const setup = async () => {
	try {
		postgresContainerReference.value = await new PostgreSqlContainer(postgresImage)
			.withDatabase("startertest")
			.withUsername("test")
			.withPassword("test")
			.start();

		process.env.DATABASE_URL = postgresContainerReference.value.getConnectionUri();
		const { relations } = await import("@starter/db");
		const { initializeMastraStorage } = await import("@starter/db/mastra");

		poolReference.value = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		dbReference.value = drizzle({ client: poolReference.value, relations });
		await initializeMastraStorage({ connectionString: process.env.DATABASE_URL });
		await migrate(dbReference.value, { migrationsFolder });
	} catch (error) {
		await cleanup(closePool);
		await cleanup(stopPostgresContainer);

		throw error;
	}
};

export const teardown = async () => {
	const results = await Promise.allSettled([closePool(), stopPostgresContainer()]);
	const failure = results.find((result) => result.status === "rejected");

	if (failure?.status === "rejected") {
		console.error("Error during test teardown:", failure.reason);
		throw failure.reason;
	}
};
