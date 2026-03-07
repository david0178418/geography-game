export type { CountryData } from "./types.ts";
export { getCountryFeatures, getCountryNames, getCountryIds, numericToAlpha3, countriesFeatureCollection } from "./countries.ts";
export { capitals } from "./capitals.ts";
export { adjacency } from "./adjacency.ts";
export { blocMemberships, getBlocsForCountry } from "./blocs.ts";

import type { CountryData } from "./types.ts";
import { getCountryFeatures } from "./countries.ts";
import { capitals } from "./capitals.ts";
import { adjacency } from "./adjacency.ts";
import { getBlocsForCountry } from "./blocs.ts";

/**
 * Assembles the full CountryData array by combining:
 * - Country IDs and names from world-atlas TopoJSON
 * - Capital names and coordinates
 * - Adjacency graph
 * - Bloc memberships
 * - Base stability values (randomized deterministically from country code)
 */
function computeStability(id: string): number {
	const hash = id.charCodeAt(0) + id.charCodeAt(1) + id.charCodeAt(2);
	return 30 + (hash % 51); // range 30-80
}

const countryData: ReadonlyArray<CountryData> = getCountryFeatures().map(({ id, name }) => {
	const capital = capitals[id];
	const neighbors = adjacency[id] ?? [];
	const blocs = getBlocsForCountry(id);

	const capitalData = capital
		? { name: capital.name, coordinates: capital.coordinates as [number, number] }
		: { name: "Unknown", coordinates: [0, 0] as [number, number] };

	return {
		id,
		name,
		capital: capitalData,
		stability: computeStability(id),
		blocs: [...blocs],
		adjacency: [...neighbors],
	};
});

function getCountryData(): ReadonlyArray<CountryData> {
	return countryData;
}

export { getCountryData };
