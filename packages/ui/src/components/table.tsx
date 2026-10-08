"use client";

import type * as React from "react";

import { cn } from "@starter/ui/lib/utils";

const Table = ({ className, ...props }: React.ComponentProps<"table">) => {
	return (
		<div className='max-w-screen no-scrollbar relative w-full shrink-0 overflow-x-auto' data-slot='table-container'>
			<table
				className={cn("w-full table-fixed caption-bottom text-sm", className)}
				data-slot='table'
				{...props}
			/>
		</div>
	);
};

const TableHeader = ({ className, ...props }: React.ComponentProps<"thead">) => {
	return <thead className={cn("[&_tr]:border-b", className)} data-slot='table-header' {...props} />;
};

const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => {
	return <tbody className={cn("[&_tr:last-child]:border-0", className)} data-slot='table-body' {...props} />;
};

const TableFooter = ({ className, ...props }: React.ComponentProps<"tfoot">) => {
	return (
		<tfoot
			className={cn("border-t bg-muted/50 font-medium last:[&>tr]:border-b-0", className)}
			data-slot='table-footer'
			{...props}
		/>
	);
};

const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => {
	return (
		<tr
			className={cn(
				"min-h-10 border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
				className
			)}
			data-slot='table-row'
			{...props}
		/>
	);
};

const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => {
	return (
		<th
			className={cn("p-3 text-start align-middle font-medium text-muted-foreground first:ps-4", className)}
			data-slot='table-head'
			{...props}
		/>
	);
};

const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => {
	return (
		<td
			className={cn("h-10 p-3 align-middle text-foreground first:ps-4", className)}
			data-slot='table-cell'
			{...props}
		/>
	);
};

const TableCaption = ({ className, ...props }: React.ComponentProps<"caption">) => {
	return (
		<caption className={cn("text-muted-foreground mt-4 text-sm", className)} data-slot='table-caption' {...props} />
	);
};

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
