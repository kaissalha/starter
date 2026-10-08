export const getWebsiteUrl = ({
	pathname = "",
	publicUrl,
	websiteId,
}: {
	pathname?: string;
	publicUrl?: string;
	websiteId?: string;
}) => {
	if (process.env.NODE_ENV === "development") {
		return websiteId ? `http://${websiteId}.localhost:3001${pathname}` : undefined;
	}

	return publicUrl;
};
