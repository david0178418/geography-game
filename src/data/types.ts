export interface CountryData {
	id: string;           // ISO 3166-1 alpha-3
	name: string;
	capital: {
		name: string;
		coordinates: [number, number]; // [lng, lat]
	};
	stability: number;    // base value, 0-100
	blocs: string[];      // bloc IDs
	adjacency: string[];  // ISO codes of neighbors
}
