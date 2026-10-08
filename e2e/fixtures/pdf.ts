const pdfObjects = (text: string) => {
	const stream = `BT /F1 24 Tf 40 160 Td (${text}) Tj ET`;

	return [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 320] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
};

export const createSamplePdf = (text: string) => {
	const header = "%PDF-1.4\n";
	const bodies = pdfObjects(text).map((body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`);
	const offsets = bodies.map((_, index) => header.length + bodies.slice(0, index).join("").length);
	const xrefStart = header.length + bodies.join("").length;

	const xref = [
		`xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`,
		...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
		`trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
	].join("");

	return Buffer.from(`${header}${bodies.join("")}${xref}`, "latin1");
};
