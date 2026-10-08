export const getReadableTextColor = ({ color }: { color: string }) => {
	const red = Number.parseInt(color.slice(1, 3), 16);
	const green = Number.parseInt(color.slice(3, 5), 16);
	const blue = Number.parseInt(color.slice(5, 7), 16);

	return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#17191f" : "#ffffff";
};
