import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const organizationAccessControl = createAccessControl({
	...defaultStatements,
	workspace: ["read", "write", "delete"],
} as const);

export const organizationRoles = {
	admin: organizationAccessControl.newRole({
		ac: ["read"],
		invitation: ["create"],
		member: ["create", "update"],
		organization: ["update"],
		team: ["create", "update"],
		workspace: ["read", "write"],
	}),
	member: organizationAccessControl.newRole({ ac: ["read"], workspace: ["read"] }),
	owner: organizationAccessControl.newRole(organizationAccessControl.statements),
};

type OrganizationStatements = typeof organizationAccessControl.statements;

export type OrganizationAction = {
	[Resource in keyof OrganizationStatements]: `${Resource}.${OrganizationStatements[Resource][number]}`;
}[keyof OrganizationStatements];

export type OrganizationRole = keyof typeof organizationRoles;

export type OrganizationPermission = (typeof organizationAccessControl.statements.workspace)[number];

export const hasOrganizationPermission = ({
	permission,
	role,
}: {
	permission: OrganizationPermission;
	role: string | null | undefined;
}) =>
	(role === "owner" || role === "admin" || role === "member") &&
	organizationRoles[role].authorize({ workspace: [permission] }).success;
