"use client";

import { useEffect, useState } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

const debounceMs = 600;

const maxAvailable = 8;

const leadingUnavailable = 2;

export type DomainSearchItem = {
	available: boolean;
	domain: string;
	price: { purchasePrice: number; renewalPrice: number } | null;
};

const selectDisplayed = (results: Array<{ available: boolean; domain: string }>) =>
	results.reduce<Array<{ available: boolean; domain: string }>>((shown, result, index) => {
		if (result.available) {
			return shown.filter((item) => item.available).length < maxAvailable ? [...shown, result] : shown;
		}

		return index < leadingUnavailable ? [...shown, result] : shown;
	}, []);

export const useDomainSearch = ({ initialQuery }: { initialQuery: string }) => {
	const [query, setQuery] = useState(initialQuery);
	const [submitted, setSubmitted] = useState(initialQuery.trim());
	useEffect(() => {
		const timer = setTimeout(() => setSubmitted(query.trim()), debounceMs);

		return () => clearTimeout(timer);
	}, [query]);

	const suggestions = useQuery(
		apiClient.domains.suggest.queryOptions({
			enabled: submitted.length > 0,
			input: { query: submitted },
			retry: false,
			staleTime: 5 * 60_000,
		})
	);

	const candidates = suggestions.data?.domains ?? [];

	const availability = useQuery(
		apiClient.domains.availability.queryOptions({
			enabled: candidates.length > 0,
			input: { domains: candidates },
			retry: false,
			staleTime: 60_000,
		})
	);

	const displayed = selectDisplayed(availability.data ?? []);
	const priceable = displayed.filter((item) => item.available).map((item) => item.domain);

	const prices = useQuery(
		apiClient.domains.prices.queryOptions({
			enabled: priceable.length > 0,
			input: { domains: priceable },
			placeholderData: keepPreviousData,
			retry: false,
			staleTime: 5 * 60_000,
		})
	);

	const items = displayed.map((item): DomainSearchItem => ({
		...item,
		price: prices.data?.find((price) => price.domain === item.domain) ?? null,
	}));

	return {
		error: suggestions.error ?? availability.error,
		isError: suggestions.isError || availability.isError,
		isLoading: submitted.length > 0 && (suggestions.isPending || (candidates.length > 0 && availability.isPending)),
		isPriceLoading: prices.isFetching,
		items,
		query,
		retry: () => (suggestions.isError ? suggestions.refetch() : availability.refetch()),
		searched: submitted.length > 0,
		setQuery,
		submit: () => setSubmitted(query.trim()),
		unsupportedSuffix: suggestions.data?.unsupportedSuffix ?? null,
	};
};
