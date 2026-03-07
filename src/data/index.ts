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
function getCountryData(): ReadonlyArray<CountryData> {
	return getCountryFeatures().map(({ id, name }) => {
		const capital = capitals[id];
		const neighbors = adjacency[id] ?? [];
		const blocs = getBlocsForCountry(id);

		// Deterministic base stability derived from the country code's char codes
		const stabilityHash = id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
		const stability = 30 + (stabilityHash % 51); // range 30-80

		const capitalData = capital
			? { name: capital.name, coordinates: [...capital.coordinates] as [number, number] }
			: { name: "Unknown", coordinates: [0, 0] as [number, number] };

		return {
			id,
			name,
			capital: capitalData,
			stability,
			blocs: [...blocs],
			adjacency: [...neighbors],
		};
	});
}

export { getCountryData };
