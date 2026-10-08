// oxlint-disable max-lines-per-function
import { defineRelations } from "drizzle-orm";

import { schema } from "./schema.ts";

export const relations = defineRelations(schema, (r) => ({
	accounts: {
		user: r.one.users({
			from: r.accounts.userId,
			to: r.users.id,
		}),
	},

	files: {
		organization: r.one.organizations({
			from: r.files.organizationId,
			to: r.organizations.id,
		}),
		tagAssignments: r.many.fileTagAssignments(),
		uploader: r.one.users({
			from: r.files.uploadedBy,
			optional: true,
			to: r.users.id,
		}),
	},

	fileTagAssignments: {
		file: r.one.files({
			from: r.fileTagAssignments.fileId,
			to: r.files.id,
		}),
		organization: r.one.organizations({
			from: r.fileTagAssignments.organizationId,
			to: r.organizations.id,
		}),
		tag: r.one.fileTags({
			from: r.fileTagAssignments.tagId,
			to: r.fileTags.id,
		}),
	},

	fileTags: {
		assignments: r.many.fileTagAssignments(),
		organization: r.one.organizations({
			from: r.fileTags.organizationId,
			to: r.organizations.id,
		}),
	},

	invitations: {
		inviter: r.one.users({
			from: r.invitations.inviterId,
			to: r.users.id,
		}),
		organization: r.one.organizations({
			from: r.invitations.organizationId,
			to: r.organizations.id,
		}),
	},

	members: {
		organization: r.one.organizations({
			from: r.members.organizationId,
			to: r.organizations.id,
		}),
		user: r.one.users({
			from: r.members.userId,
			to: r.users.id,
		}),
	},

	oauthAccessTokens: {
		client: r.one.oauthClients({
			from: r.oauthAccessTokens.clientId,
			to: r.oauthClients.clientId,
		}),
		refreshToken: r.one.oauthRefreshTokens({
			from: r.oauthAccessTokens.refreshId,
			optional: true,
			to: r.oauthRefreshTokens.id,
		}),
		session: r.one.sessions({
			from: r.oauthAccessTokens.sessionId,
			optional: true,
			to: r.sessions.id,
		}),
		user: r.one.users({
			from: r.oauthAccessTokens.userId,
			optional: true,
			to: r.users.id,
		}),
	},

	oauthClientResources: {
		client: r.one.oauthClients({
			from: r.oauthClientResources.clientId,
			to: r.oauthClients.clientId,
		}),
		resource: r.one.oauthResources({
			from: r.oauthClientResources.resourceId,
			to: r.oauthResources.identifier,
		}),
	},

	oauthClients: {
		accessTokens: r.many.oauthAccessTokens(),
		consents: r.many.oauthConsents(),
		refreshTokens: r.many.oauthRefreshTokens(),
		resources: r.many.oauthClientResources(),
		user: r.one.users({
			from: r.oauthClients.userId,
			optional: true,
			to: r.users.id,
		}),
	},

	oauthConsents: {
		client: r.one.oauthClients({
			from: r.oauthConsents.clientId,
			to: r.oauthClients.clientId,
		}),
		user: r.one.users({
			from: r.oauthConsents.userId,
			optional: true,
			to: r.users.id,
		}),
	},

	oauthRefreshTokens: {
		accessTokens: r.many.oauthAccessTokens(),
		client: r.one.oauthClients({
			from: r.oauthRefreshTokens.clientId,
			to: r.oauthClients.clientId,
		}),
		session: r.one.sessions({
			from: r.oauthRefreshTokens.sessionId,
			optional: true,
			to: r.sessions.id,
		}),
		user: r.one.users({
			from: r.oauthRefreshTokens.userId,
			to: r.users.id,
		}),
	},

	oauthResources: {
		clients: r.many.oauthClientResources(),
	},

	organizations: {
		files: r.many.files(),
		fileTags: r.many.fileTags(),
		invitations: r.many.invitations(),
		members: r.many.members(),
		sessions: r.many.sessions(),
	},

	sessions: {
		activeOrganization: r.one.organizations({
			from: r.sessions.activeOrganizationId,
			optional: true,
			to: r.organizations.id,
		}),
		oauthAccessTokens: r.many.oauthAccessTokens(),
		oauthRefreshTokens: r.many.oauthRefreshTokens(),
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},

	twoFactors: {
		user: r.one.users({
			from: r.twoFactors.userId,
			to: r.users.id,
		}),
	},

	users: {
		accounts: r.many.accounts(),
		invitations: r.many.invitations(),
		members: r.many.members(),
		oauthAccessTokens: r.many.oauthAccessTokens(),
		oauthClients: r.many.oauthClients(),
		oauthConsents: r.many.oauthConsents(),
		oauthRefreshTokens: r.many.oauthRefreshTokens(),
		sessions: r.many.sessions(),
		twoFactors: r.many.twoFactors(),
	},
}));
