import { accounts } from "./schema/auth/accounts.ts";
import { apikeys } from "./schema/auth/api-keys.ts";
import { invitations } from "./schema/auth/invitations.ts";
import { jwks } from "./schema/auth/jwks.ts";
import { members } from "./schema/auth/members.ts";
import {
	oauthAccessTokens,
	oauthClientAssertions,
	oauthClientResources,
	oauthClients,
	oauthConsents,
	oauthRefreshTokens,
	oauthResources,
} from "./schema/auth/oauth.ts";
import { organizations } from "./schema/auth/organizations.ts";
import { sessions } from "./schema/auth/sessions.ts";
import { twoFactors } from "./schema/auth/two-factors.ts";
import { users } from "./schema/auth/users.ts";
import { verifications } from "./schema/auth/verifications.ts";
import { blogPosts } from "./schema/blog-posts/blog-posts.ts";
import { contactMessages } from "./schema/contacts/contact-messages.ts";
import { contacts } from "./schema/contacts/contacts.ts";
import { eventDispatches } from "./schema/events/event-dispatches.ts";
import { eventExecutions } from "./schema/events/event-executions.ts";
import { events } from "./schema/events/events.ts";
import {
	fileAccess,
	fileAccessValues,
	fileKind,
	fileKindValues,
	fileRagStatus,
	fileRagStatusValues,
	files,
	fileSourceType,
	fileSourceTypeValues,
} from "./schema/files/files.ts";
import { fileTagAssignments, fileTags } from "./schema/files/tags.ts";
import {
	oauthConnectionStatusEnum,
	oauthConnections,
	oauthProviderEnum,
} from "./schema/integrations/oauth-connections.ts";
import { termsAcceptances } from "./schema/legal/terms-acceptances.ts";
import { linkPages } from "./schema/link-pages/link-pages.ts";
import { notificationInboxes } from "./schema/notifications/notification-inboxes.ts";
import { notificationPreferences } from "./schema/notifications/notification-preferences.ts";
import { notifications } from "./schema/notifications/notifications.ts";
import { organizationPurges } from "./schema/organizations/organization-purges.ts";
import { seoAnswerRuns, seoQuestions } from "./schema/seo/ai-questions.ts";
import { domainRegistrations } from "./schema/websites/domain-registrations.ts";
import { websiteDomains } from "./schema/websites/website-domains.ts";
import { websiteVersions } from "./schema/websites/website-versions.ts";
import { websites, websiteSubdomainHistory } from "./schema/websites/websites.ts";

export const schema = {
	accounts,
	apikeys,
	blogPosts,
	contactMessages,
	contacts,
	domainRegistrations,
	eventDispatches,
	eventExecutions,
	events,
	fileAccess,
	fileAccessValues,
	fileKind,
	fileKindValues,
	fileRagStatus,
	fileRagStatusValues,
	files,
	fileSourceType,
	fileSourceTypeValues,
	fileTagAssignments,
	fileTags,
	invitations,
	jwks,
	linkPages,
	members,
	notificationInboxes,
	notificationPreferences,
	notifications,
	oauthAccessTokens,
	oauthClientAssertions,
	oauthClientResources,
	oauthClients,
	oauthConnections,
	oauthConnectionStatusEnum,
	oauthConsents,
	oauthProviderEnum,
	oauthRefreshTokens,
	oauthResources,
	organizationPurges,
	organizations,
	seoAnswerRuns,
	seoQuestions,
	sessions,
	termsAcceptances,
	twoFactors,
	users,
	verifications,
	websiteDomains,
	websites,
	websiteSubdomainHistory,
	websiteVersions,
};
