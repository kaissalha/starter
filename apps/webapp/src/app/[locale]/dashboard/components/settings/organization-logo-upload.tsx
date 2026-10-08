"use client";

import { useQuery } from "@tanstack/react-query";

import { BusinessLogoField, useBusinessLogo } from "@/components/business-logo-field";
import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { brandLogoScale } from "@starter/infinite-brand";

type OrganizationLogoUploadProps = {
	canEdit: boolean;
	organization: {
		logo?: string | null;
		name: string;
	};
};

export const OrganizationLogoUpload = ({ canEdit, organization }: OrganizationLogoUploadProps) => {
	const { refetch } = authClient.useActiveOrganization();
	const brand = useQuery(apiClient.brands.get.queryOptions({ retry: false }));

	const businessLogo = useBusinessLogo({
		onSaved: async () => {
			await refetch();
		},
	});

	const logo =
		brand.data?.brand.logo ??
		(organization.logo && !brand.data ? { scale: brandLogoScale.default, src: organization.logo } : undefined);

	return (
		<BusinessLogoField
			disabled={!canEdit || businessLogo.pending}
			logo={logo}
			name={organization.name}
			onChange={businessLogo.change}
		/>
	);
};
