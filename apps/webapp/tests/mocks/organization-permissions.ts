import { afterEach } from "vitest";

import { organizationRoles, type OrganizationAction, type OrganizationRole } from "@starter/server/permissions";

type PermissionState = { role: OrganizationRole | null };

export const organizationPermissionState: PermissionState = { role: "owner" };

export const mockOrganizationPermissions = () => {
	const role = organizationPermissionState.role;

	return {
		can: (permission: OrganizationAction) => {
			const [resource, action] = permission.split(".");

			return role ? organizationRoles[role].authorize({ [resource]: [action] }).success : false;
		},
		isLoading: role === null,
		organizationId: "organization",
		role,
	};
};

afterEach(() => {
	organizationPermissionState.role = "owner";
});
