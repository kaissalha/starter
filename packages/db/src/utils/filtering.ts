import { or, type SQL } from "drizzle-orm";

type DataTableFilterConditions = Record<string, Record<string, SQL>>;

export const addDataTableFilters = ({
	conditions,
	filters,
	whereConditions,
}: {
	conditions: DataTableFilterConditions;
	filters: Record<string, Array<string>>;
	whereConditions: Array<SQL>;
}) => {
	for (const [filterId, values] of Object.entries(filters)) {
		const options = conditions[filterId];

		if (!options) {
			continue;
		}

		const selected = [...new Set(values)].flatMap((value) => {
			const condition = options[value];

			return condition ? [condition] : [];
		});

		const condition = or(...selected);

		if (condition) {
			whereConditions.push(condition);
		}
	}
};
