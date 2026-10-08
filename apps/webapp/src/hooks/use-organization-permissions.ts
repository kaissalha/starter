"use client";

import { useCallback } from "react";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { organizationRoles, type OrganizationAction } from "@starter/server/permissions";

export const useOrganizationPermissions = () => {
	const session = useAuthSession();
	const organizationId = session.data?.session.activeOrganizationId;
	const isLoading = session.isPending;
	const isRefreshing = session.isRefetching;
	const organizationRole = session.data?.organizationRole;

	const role =
		!isLoading &&
		organizationId &&
		(organizationRole === "owner" || organizationRole === "admin" || organizationRole === "member")
			? organizationRole
			: null;

	const can = useCallback(
		(permission: OrganizationAction) => {
			if (!role) {
				return false;
			}

			const [resource, action] = permission.split(".");

			return organizationRoles[role].authorize({ [resource]: [action] }).success;
		},
		[role]
	);

	return {
		can,
		isLoading,
		isRefreshing,
		organizationId,
		role,
		userId: session.data?.user.id,
	};
};
