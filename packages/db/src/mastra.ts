import type { RetentionConfig } from "@mastra/core/storage";
import { PgVector, PostgresStore } from "@mastra/pg";
import { Client, type Pool } from "pg";

export const mastraSchemaName = "mastra";

export const mastraStorageId = "starter-mastra-storage";

export const knowledgeVectorId = "starter-knowledge";

export const knowledgeIndexName = "knowledge";

export const knowledgeEmbeddingDimensions = 1536;

type KnowledgeIndexOptions = Parameters<InstanceType<typeof PgVector>["createIndex"]>[0];

export const knowledgeIndexOptions = {
	dimension: knowledgeEmbeddingDimensions,
	indexConfig: { type: "hnsw" },
	indexName: knowledgeIndexName,
	metadataIndexes: ["organizationId", "fileId", "chunkIndex"],
	metric: "cosine",
} satisfies KnowledgeIndexOptions;

const mastraStorageIndexes = [
	{
		columns: ["resourceId", "updatedAt DESC"],
		name: "mastra_threads_resourceid_updatedat_idx",
		table: "mastra_threads",
	},
];

type MastraStoreConnection = { connectionString: string; max?: number } | { pool: Pool };

export const createMastraStore = (connection: MastraStoreConnection) => {
	const base = {
		id: mastraStorageId,
		indexes: mastraStorageIndexes,
		retention: {
			observability: { spans: { maxAge: "1d" } },
			scores: { scorers: { maxAge: "1d" } },
		} satisfies RetentionConfig,
		schemaName: mastraSchemaName,
	};

	return "pool" in connection
		? new PostgresStore({ ...base, pool: connection.pool })
		: new PostgresStore({ ...base, connectionString: connection.connectionString, max: connection.max });
};

export const createKnowledgeVector = ({
	connectionString,
	max,
	schemaName = mastraSchemaName,
}: {
	connectionString: string;
	max?: number;
	schemaName?: string;
}) => new PgVector({ connectionString, id: knowledgeVectorId, max, schemaName });

const ensureVectorExtension = async (connectionString: string) => {
	const client = new Client({ connectionString });
	await client.connect();

	try {
		await client.query("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public");
	} finally {
		await client.end();
	}
};

export const initializeMastraStorage = async ({
	connectionString,
	schemaName = mastraSchemaName,
}: {
	connectionString: string;
	schemaName?: string;
}) => {
	await ensureVectorExtension(connectionString);

	const store = new PostgresStore({
		connectionString,
		id: mastraStorageId,
		indexes: mastraStorageIndexes,
		max: 2,
		schemaName,
	});

	const vector = createKnowledgeVector({ connectionString, max: 2, schemaName });

	try {
		await store.init();
		await vector.createIndex(knowledgeIndexOptions);
	} finally {
		await Promise.allSettled([store.close(), vector.disconnect()]);
	}
};
