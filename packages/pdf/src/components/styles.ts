import { Font, StyleSheet } from "@react-pdf/renderer";

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

export const baseStyles = StyleSheet.create({
	footer: {
		bottom: 20,
		color: "#707070",
		fontSize: 9,
		left: 40,
		position: "absolute",
		right: 40,
		textAlign: "center",
	},
	page: {
		backgroundColor: "#FFFFFF",
		color: "#121212",
		fontFamily: "Geist",
		fontSize: 10,
		padding: 40,
	},
});
