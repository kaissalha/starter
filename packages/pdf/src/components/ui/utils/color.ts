export const resolvePdfColor = (value: string, colors: Record<string, string>) => colors[value] ?? value;
