const hash = ({ offset, seed }: { offset: number; seed: string }) => {
	const value = [...seed].reduce(
		(current, character) => Math.imul(current ^ character.codePointAt(0)!, 16_777_619),
		offset
	);

	return (value >>> 0).toString(16).padStart(8, "0");
};

export const entityIdFromSeed = ({ seed }: { seed: string }) => {
	const hexadecimal = [
		hash({ offset: 2_166_136_261, seed }),
		hash({ offset: 2_166_136_261 ^ 0x9e_37_79_b9, seed }),
		hash({ offset: 2_166_136_261 ^ 0x85_eb_ca_6b, seed }),
		hash({ offset: 2_166_136_261 ^ 0xc2_b2_ae_35, seed }),
	].join("");

	const versioned = `${hexadecimal.slice(0, 12)}5${hexadecimal.slice(13)}`;
	const variant = ((Number.parseInt(versioned[16]!, 16) & 0x3) | 0x8).toString(16);
	const value = `${versioned.slice(0, 16)}${variant}${versioned.slice(17)}`;

	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};
