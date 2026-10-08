import { Font, StyleSheet } from "@react-pdf/renderer";

const registerFonts = () => {
	const geistLatin400 =
		"https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-400-normal.woff";

	Font.register({
		family: "Geist",
		fonts: [
			{
				fontStyle: "normal",
				fontWeight: 400,
				src: geistLatin400,
			},

			{
				fontStyle: "italic",
				fontWeight: 400,
				src: geistLatin400,
			},
			{
				fontStyle: "normal",
				fontWeight: 500,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-500-normal.woff",
			},
			{
				fontStyle: "normal",
				fontWeight: 600,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-600-normal.woff",
			},
			{
				fontStyle: "normal",
				fontWeight: 700,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-700-normal.woff",
			},
		],
	});

	Font.register({
		family: "Playfair Display",
		fonts: [
			{
				fontStyle: "normal",
				fontWeight: 400,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.8/files/playfair-display-latin-400-normal.woff",
			},
			{
				fontStyle: "normal",
				fontWeight: 500,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.8/files/playfair-display-latin-500-normal.woff",
			},
			{
				fontStyle: "normal",
				fontWeight: 600,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.8/files/playfair-display-latin-600-normal.woff",
			},
			{
				fontStyle: "normal",
				fontWeight: 700,
				src: "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.8/files/playfair-display-latin-700-normal.woff",
			},
		],
	});
};

registerFonts();

export const baseStyles = StyleSheet.create({
	column: {
		flexDirection: "column",
	},
	divider: {
		borderBottomColor: "#E8E7E1",
		borderBottomWidth: 1,
		marginVertical: 15,
	},
	footer: {
		bottom: 20,
		color: "#707070",
		fontSize: 9,
		left: 40,
		position: "absolute",
		right: 40,
		textAlign: "center",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 30,
	},
	page: {
		backgroundColor: "#FFFFFF",
		color: "#121212",
		fontFamily: "Geist",
		fontSize: 10,
		padding: 40,
	},
	row: {
		flexDirection: "row",
	},
	section: {
		marginBottom: 20,
	},
	subtitle: {
		color: "#707070",
		fontSize: 14,
		fontWeight: 500,
	},
	text: {
		fontSize: 10,
		lineHeight: 1.5,
	},
	textBold: {
		fontWeight: 600,
	},
	textMuted: {
		color: "#707070",
		fontSize: 10,
	},
	title: {
		fontSize: 24,
		fontWeight: 700,
		marginBottom: 8,
	},
});
