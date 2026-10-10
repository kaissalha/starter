import { and, eq, gte, inArray, isNull, lt, notExists, sql, type SQL } from "drizzle-orm";

import {
	db,
	events,
	oauthAccessTokens,
	oauthClientAssertions,
	oauthClients,
	oauthConsents,
	oauthRefreshTokens,
	sessions,
	verifications,
} from "@starter/db";

import { mastraStorage } from "../ai/memory";

const pruneBatchSize = 500;

const pruneBudgetMs = 20_000;

export const deleteInBatches = async ({
	batchSize,
	budgetMs = 45_000,
	deadline = Date.now() + budgetMs,
	deleteBatch,
	total = 0,
}: {
	batchSize: number;
	budgetMs?: number;
	deadline?: number;
	deleteBatch: () => Promise<number>;
	total?: number;
}): Promise<{ complete: boolean; deleted: number }> => {
	if (Date.now() >= deadline) {
		return { complete: false, deleted: total };
	}

	const deleted = await deleteBatch();

	return deleted < batchSize
		? { complete: true, deleted: total + deleted }
		: deleteInBatches({ batchSize, deadline, deleteBatch, total: total + deleted });
};

export const deleteRowsInBatches = ({
	batchSize = pruneBatchSize,
	budgetMs = pruneBudgetMs,
	table,
	where,
}: {
	batchSize?: number;
	budgetMs?: number;
	table:
		| typeof events
		| typeof oauthAccessTokens
		| typeof oauthClientAssertions
		| typeof oauthClients
		| typeof oauthRefreshTokens
		| typeof sessions
		| typeof verifications;
	where: SQL | undefined;
}) =>
	deleteInBatches({
		batchSize,
		budgetMs,
		deleteBatch: async () => {
			const expired = db.select({ id: table.id }).from(table).where(where).limit(batchSize);
			const deleted = await db.delete(table).where(inArray(table.id, expired)).returning({ id: table.id });

			return deleted.length;
		},
	});

export const pruneExpiredAuthRecords = async () => ({
	oauthAccessTokens: await deleteRowsInBatches({
		table: oauthAccessTokens,
		where: lt(oauthAccessTokens.expiresAt, sql`now()`),
	}),
	oauthClientAssertions: await deleteRowsInBatches({
		table: oauthClientAssertions,
		where: lt(oauthClientAssertions.expiresAt, sql`now()`),
	}),
	oauthRefreshTokens: await deleteRowsInBatches({
		table: oauthRefreshTokens,
		where: and(
			lt(oauthRefreshTokens.expiresAt, sql`now()`),
			notExists(
				db
					.select({ id: oauthAccessTokens.id })
					.from(oauthAccessTokens)
					.where(
						and(
							eq(oauthAccessTokens.refreshId, oauthRefreshTokens.id),
							gte(oauthAccessTokens.expiresAt, sql`now()`)
						)
					)
			)
		),
	}),
	sessions: await deleteRowsInBatches({
		table: sessions,
		where: lt(sessions.expiresAt, sql`now() - interval '1 day'`),
	}),
	verifications: await deleteRowsInBatches({
		table: verifications,
		where: lt(verifications.expiresAt, sql`now() - interval '1 day'`),
	}),
});

export const pruneStaleOAuthClients = () =>
	deleteRowsInBatches({
		table: oauthClients,
		where: and(
			lt(oauthClients.createdAt, sql`now() - interval '1 day'`),
			isNull(oauthClients.userId),
			isNull(oauthClients.referenceId),
			notExists(
				db
					.select({ id: oauthAccessTokens.id })
					.from(oauthAccessTokens)
					.where(eq(oauthAccessTokens.clientId, oauthClients.clientId))
			),
			notExists(
				db
					.select({ id: oauthRefreshTokens.id })
					.from(oauthRefreshTokens)
					.where(eq(oauthRefreshTokens.clientId, oauthClients.clientId))
			),
			notExists(
				db
					.select({ id: oauthConsents.id })
					.from(oauthConsents)
					.where(eq(oauthConsents.clientId, oauthClients.clientId))
			)
		),
	});

export const pruneMastraStorage = async () => {
	const results = await mastraStorage.prune({ maxBatches: 20, pauseMs: 50 });

	return {
		complete: results.every(({ done }) => done),
		deleted: results.reduce((sum, { deleted }) => sum + deleted, 0),
	};
};
