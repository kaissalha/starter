export const downloadContent = ({
	content,
	filename,
	type,
}: {
	content: string | Blob;
	filename: string;
	type: string;
}) => {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
};
