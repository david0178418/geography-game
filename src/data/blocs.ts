/**
 * Regional bloc memberships for each country.
 * Maps ISO 3166-1 alpha-3 codes to arrays of bloc IDs.
 *
 * Blocs included:
 * - EU: European Union
 * - AU: African Union
 * - ASEAN: Association of Southeast Asian Nations
 * - AL: Arab League
 * - MERCOSUR: Southern Common Market (full + associate)
 * - NATO: North Atlantic Treaty Organization
 * - BRICS: Brazil, Russia, India, China, South Africa (+ new members)
 * - CW: Commonwealth of Nations
 * - PIF: Pacific Islands Forum
 * - CARICOM: Caribbean Community
 */

const EU_MEMBERS: ReadonlyArray<string> = [
	"AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
	"DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "NLD", "POL",
	"PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
] as const;

const AU_MEMBERS: ReadonlyArray<string> = [
	"DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CAF", "TCD", "COG",
	"COD", "CIV", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH", "GAB", "GMB",
	"GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "LBY", "MDG", "MWI", "MLI",
	"MRT", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA", "SEN", "SLE", "SOM",
	"ZAF", "SSD", "SDN", "TZA", "TGO", "TUN", "UGA", "ZMB", "ZWE",
] as const;

const ASEAN_MEMBERS: ReadonlyArray<string> = [
	"BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "VNM",
] as const;

const ARAB_LEAGUE_MEMBERS: ReadonlyArray<string> = [
	"DZA", "EGY", "IRQ", "JOR", "KWT", "LBN", "LBY", "MAR", "MRT", "OMN",
	"PSE", "QAT", "SAU", "SOM", "SDN", "SYR", "TUN", "ARE", "YEM", "DJI",
] as const;

const MERCOSUR_MEMBERS: ReadonlyArray<string> = [
	"ARG", "BRA", "PRY", "URY", "VEN", "BOL", "CHL", "COL", "ECU", "PER",
	"GUY", "SUR",
] as const;

const NATO_MEMBERS: ReadonlyArray<string> = [
	"ALB", "BEL", "BGR", "CAN", "HRV", "CZE", "DNK", "EST", "FIN", "FRA",
	"DEU", "GRC", "HUN", "ISL", "ITA", "LVA", "LTU", "LUX", "MNE", "NLD",
	"MKD", "NOR", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE", "TUR",
	"GBR", "USA",
] as const;

const BRICS_MEMBERS: ReadonlyArray<string> = [
	"BRA", "RUS", "IND", "CHN", "ZAF", "EGY", "ETH", "IRN", "SAU", "ARE",
] as const;

const COMMONWEALTH_MEMBERS: ReadonlyArray<string> = [
	"AUS", "BGD", "BWA", "BRN", "CMR", "CAN", "CYP", "FJI", "GMB", "GHA",
	"GUY", "IND", "JAM", "KEN", "LSO", "MWI", "MYS", "MOZ", "NAM", "NZL",
	"NGA", "PAK", "PNG", "RWA", "SGP", "SLB", "ZAF", "LKA", "SWZ", "TZA",
	"TTO", "UGA", "GBR", "VUT", "ZMB",
] as const;

const PIF_MEMBERS: ReadonlyArray<string> = [
	"AUS", "FJI", "NZL", "PNG", "SLB", "VUT", "NCL",
] as const;

const CARICOM_MEMBERS: ReadonlyArray<string> = [
	"BHS", "BLZ", "GUY", "HTI", "JAM", "SUR", "TTO",
] as const;

const blocMemberships: Record<string, ReadonlyArray<string>> = {
	EU: EU_MEMBERS,
	AU: AU_MEMBERS,
	ASEAN: ASEAN_MEMBERS,
	AL: ARAB_LEAGUE_MEMBERS,
	MERCOSUR: MERCOSUR_MEMBERS,
	NATO: NATO_MEMBERS,
	BRICS: BRICS_MEMBERS,
	CW: COMMONWEALTH_MEMBERS,
	PIF: PIF_MEMBERS,
	CARICOM: CARICOM_MEMBERS,
} as const;

/**
 * Pre-built reverse index: country code -> bloc IDs.
 * Computed once at module load for O(1) lookup.
 */
const countryToBlocs: Record<string, ReadonlyArray<string>> = (() => {
	const result: Record<string, string[]> = {};
	Object.entries(blocMemberships).forEach(([blocId, members]) => {
		members.forEach((code) => {
			const existing = result[code];
			if (existing) {
				existing.push(blocId);
			} else {
				result[code] = [blocId];
			}
		});
	});
	return result;
})();

/**
 * Returns the bloc IDs that a given country belongs to.
 */
function getBlocsForCountry(countryCode: string): ReadonlyArray<string> {
	return countryToBlocs[countryCode] ?? [];
}

function hasSharedBloc(countryA: string, countryB: string): boolean {
	const blocsA = getBlocsForCountry(countryA);
	const blocsB = getBlocsForCountry(countryB);
	return blocsA.some((b) => blocsB.includes(b));
}

export { blocMemberships, getBlocsForCountry, hasSharedBloc };
