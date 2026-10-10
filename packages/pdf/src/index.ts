import "./components/styles";

export { renderToBuffer } from "@react-pdf/renderer";

export { Footer } from "./components/footer";

export { Logo } from "./components/logo";

export { MarkdownDocument } from "./documents/markdown-document";

export type { Locale } from "./locales";

export { getI18n } from "./locales";

export { Alert, type AlertVariant, type AlertProps } from "./components/ui/alert";

export { Badge, type BadgeVariant, type BadgeSize, type BadgeProps } from "./components/ui/badge";

export { Card, type CardVariant, type CardProps } from "./components/ui/card";

export { DataTable } from "./components/ui/data-table";

export {
	Divider,
	type DividerVariant,
	type DividerThickness,
	type DividerSpacing,
	type DividerProps,
} from "./components/ui/divider";

export { Form } from "./components/ui/form";

export { Graph } from "./components/ui/graph";

export { Heading, type HeadingWeight, type HeadingTracking, type HeadingProps } from "./components/ui/heading";

export {
	KeyValue,
	type KeyValueDirection,
	type KeyValueSize,
	type KeyValueEntry,
	type KeyValueProps,
} from "./components/ui/key-value";

export { Link, type LinkVariant, type LinkUnderline, type LinkProps } from "./components/ui/link";

export { List } from "./components/ui/list";

export { KeepTogether, PageBreak, type KeepTogetherProps, type PageBreakProps } from "./components/ui/page-break";

export { PageFooter, type PageFooterVariant, type PageFooterProps } from "./components/ui/page-footer";

export { PageHeader, type PageHeaderVariant, type PageHeaderProps } from "./components/ui/page-header";

export {
	PageNumber,
	type PageNumberAlign,
	type PageNumberSize,
	type PageNumberProps,
} from "./components/ui/page-number";

export {
	PdfImage,
	type PdfImageHTTPMethod,
	type PdfImageSrc,
	type PdfImageFit,
	type PdfImageVariant,
	type PdfImageProps,
} from "./components/ui/pdf-image";

export { QRCode, type QRCodeErrorLevel, type QRCodeProps } from "./components/ui/qrcode";

export {
	Section,
	type SectionSpacing,
	type SectionPadding,
	type SectionVariant,
	type SectionProps,
} from "./components/ui/section";

export { Signature, type SignatureVariant, type SignatureSigner, type SignatureProps } from "./components/ui/signature";

export {
	Stack,
	type StackGap,
	type StackDirection,
	type StackAlign,
	type StackJustify,
	type StackProps,
} from "./components/ui/stack";

export { TableHeader, TableBody, TableFooter, Table, TableRow, TableCell } from "./components/ui/table";

export { Text, type TextVariant, type TextWeight, type TextDecoration, type TextProps } from "./components/ui/text";

export { Watermark, type WatermarkPosition, type WatermarkProps } from "./components/ui/watermark";

export type {
	DataTableSize,
	DataTableValue,
	DataTableRow,
	DataTableColumn,
	DataTableProps,
} from "./components/ui/data-table";

export type { FormVariant, FormLayout, FormLabelPosition, FormField, FormGroup, FormProps } from "./components/ui/form";

export type { GraphVariant, GraphLegendPosition, GraphProps } from "./components/ui/graph";

export type { GraphWidthOptions, GraphDataPoint, GraphSeries, ChartLayout } from "./components/ui/graph-utils";

export type { ListVariant, ListItem, ListProps } from "./components/ui/list";

export type { TableVariant, TableProps, TableSectionProps, TableRowProps, TableCellProps } from "./components/ui/table";
