import type { ReactNode } from "react";

import { Body, Container, Font, Heading, Html, Preview, Tailwind } from "react-email";

import { getDirection } from "@starter/utils";

import { isSupportedLocale } from "../locales";
import { Footer } from "./footer";

export const EmailLayout = ({
	children,
	locale,
	preview,
	title,
}: {
	children: ReactNode;
	locale: string;
	preview: string;
	title: string;
}) => {
	const contentLocale = isSupportedLocale(locale) ? locale : "en";

	return (
		<Html dir={getDirection(contentLocale)} lang={contentLocale}>
			<Tailwind>
				<head>
					<Font
						fallbackFontFamily='Helvetica'
						fontFamily='Geist'
						fontStyle='normal'
						fontWeight={400}
						webFont={{
							format: "woff2",
							url: "https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-400-normal.woff2",
						}}
					/>

					<Font
						fallbackFontFamily='Helvetica'
						fontFamily='Geist'
						fontStyle='normal'
						fontWeight={500}
						webFont={{
							format: "woff2",
							url: "https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/files/geist-sans-latin-500-normal.woff2",
						}}
					/>
				</head>
				<Preview>{preview}</Preview>

				<Body className='mx-auto my-auto bg-white'>
					<Container
						className='mx-auto my-10 max-w-150 border-transparent p-5 md:border-stone-200'
						style={{ borderStyle: "solid", borderWidth: 1 }}
					>
						<Heading className='mx-0 my-7.5 p-0 text-center text-xl font-normal text-neutral-950'>
							{title}
						</Heading>
						{children}
						<Footer locale={locale} />
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};
