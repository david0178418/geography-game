import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import type { Topology, GeometryCollection } from "topojson-specification";

/**
 * Mapping from ISO 3166-1 numeric codes (as used by Natural Earth / world-atlas)
 * to ISO 3166-1 alpha-3 codes and English short names.
 */
const numericToAlpha3: Record<string, { alpha3: string; name: string }> = {
	"004": { alpha3: "AFG", name: "Afghanistan" },
	"008": { alpha3: "ALB", name: "Albania" },
	"012": { alpha3: "DZA", name: "Algeria" },
	"024": { alpha3: "AGO", name: "Angola" },
	"032": { alpha3: "ARG", name: "Argentina" },
	"051": { alpha3: "ARM", name: "Armenia" },
	"036": { alpha3: "AUS", name: "Australia" },
	"040": { alpha3: "AUT", name: "Austria" },
	"031": { alpha3: "AZE", name: "Azerbaijan" },
	"044": { alpha3: "BHS", name: "Bahamas" },
	"050": { alpha3: "BGD", name: "Bangladesh" },
	"112": { alpha3: "BLR", name: "Belarus" },
	"056": { alpha3: "BEL", name: "Belgium" },
	"084": { alpha3: "BLZ", name: "Belize" },
	"204": { alpha3: "BEN", name: "Benin" },
	"064": { alpha3: "BTN", name: "Bhutan" },
	"068": { alpha3: "BOL", name: "Bolivia" },
	"070": { alpha3: "BIH", name: "Bosnia and Herzegovina" },
	"072": { alpha3: "BWA", name: "Botswana" },
	"076": { alpha3: "BRA", name: "Brazil" },
	"096": { alpha3: "BRN", name: "Brunei" },
	"100": { alpha3: "BGR", name: "Bulgaria" },
	"854": { alpha3: "BFA", name: "Burkina Faso" },
	"108": { alpha3: "BDI", name: "Burundi" },
	"116": { alpha3: "KHM", name: "Cambodia" },
	"120": { alpha3: "CMR", name: "Cameroon" },
	"124": { alpha3: "CAN", name: "Canada" },
	"140": { alpha3: "CAF", name: "Central African Republic" },
	"148": { alpha3: "TCD", name: "Chad" },
	"152": { alpha3: "CHL", name: "Chile" },
	"156": { alpha3: "CHN", name: "China" },
	"170": { alpha3: "COL", name: "Colombia" },
	"178": { alpha3: "COG", name: "Republic of the Congo" },
	"180": { alpha3: "COD", name: "Democratic Republic of the Congo" },
	"188": { alpha3: "CRI", name: "Costa Rica" },
	"384": { alpha3: "CIV", name: "Ivory Coast" },
	"191": { alpha3: "HRV", name: "Croatia" },
	"192": { alpha3: "CUB", name: "Cuba" },
	"-99": { alpha3: "CYP", name: "Cyprus" },
	"203": { alpha3: "CZE", name: "Czechia" },
	"208": { alpha3: "DNK", name: "Denmark" },
	"262": { alpha3: "DJI", name: "Djibouti" },
	"214": { alpha3: "DOM", name: "Dominican Republic" },
	"218": { alpha3: "ECU", name: "Ecuador" },
	"818": { alpha3: "EGY", name: "Egypt" },
	"222": { alpha3: "SLV", name: "El Salvador" },
	"226": { alpha3: "GNQ", name: "Equatorial Guinea" },
	"232": { alpha3: "ERI", name: "Eritrea" },
	"233": { alpha3: "EST", name: "Estonia" },
	"748": { alpha3: "SWZ", name: "Eswatini" },
	"231": { alpha3: "ETH", name: "Ethiopia" },
	"238": { alpha3: "FLK", name: "Falkland Islands" },
	"242": { alpha3: "FJI", name: "Fiji" },
	"246": { alpha3: "FIN", name: "Finland" },
	"250": { alpha3: "FRA", name: "France" },
	"260": { alpha3: "ATF", name: "French Southern Territories" },
	"266": { alpha3: "GAB", name: "Gabon" },
	"270": { alpha3: "GMB", name: "Gambia" },
	"268": { alpha3: "GEO", name: "Georgia" },
	"276": { alpha3: "DEU", name: "Germany" },
	"288": { alpha3: "GHA", name: "Ghana" },
	"300": { alpha3: "GRC", name: "Greece" },
	"304": { alpha3: "GRL", name: "Greenland" },
	"320": { alpha3: "GTM", name: "Guatemala" },
	"324": { alpha3: "GIN", name: "Guinea" },
	"624": { alpha3: "GNB", name: "Guinea-Bissau" },
	"328": { alpha3: "GUY", name: "Guyana" },
	"332": { alpha3: "HTI", name: "Haiti" },
	"340": { alpha3: "HND", name: "Honduras" },
	"348": { alpha3: "HUN", name: "Hungary" },
	"352": { alpha3: "ISL", name: "Iceland" },
	"356": { alpha3: "IND", name: "India" },
	"360": { alpha3: "IDN", name: "Indonesia" },
	"364": { alpha3: "IRN", name: "Iran" },
	"368": { alpha3: "IRQ", name: "Iraq" },
	"372": { alpha3: "IRL", name: "Ireland" },
	"376": { alpha3: "ISR", name: "Israel" },
	"380": { alpha3: "ITA", name: "Italy" },
	"388": { alpha3: "JAM", name: "Jamaica" },
	"392": { alpha3: "JPN", name: "Japan" },
	"400": { alpha3: "JOR", name: "Jordan" },
	"398": { alpha3: "KAZ", name: "Kazakhstan" },
	"404": { alpha3: "KEN", name: "Kenya" },
	"408": { alpha3: "PRK", name: "North Korea" },
	"410": { alpha3: "KOR", name: "South Korea" },
	"414": { alpha3: "KWT", name: "Kuwait" },
	"417": { alpha3: "KGZ", name: "Kyrgyzstan" },
	"418": { alpha3: "LAO", name: "Laos" },
	"428": { alpha3: "LVA", name: "Latvia" },
	"422": { alpha3: "LBN", name: "Lebanon" },
	"426": { alpha3: "LSO", name: "Lesotho" },
	"430": { alpha3: "LBR", name: "Liberia" },
	"434": { alpha3: "LBY", name: "Libya" },
	"440": { alpha3: "LTU", name: "Lithuania" },
	"442": { alpha3: "LUX", name: "Luxembourg" },
	"807": { alpha3: "MKD", name: "North Macedonia" },
	"450": { alpha3: "MDG", name: "Madagascar" },
	"454": { alpha3: "MWI", name: "Malawi" },
	"458": { alpha3: "MYS", name: "Malaysia" },
	"466": { alpha3: "MLI", name: "Mali" },
	"478": { alpha3: "MRT", name: "Mauritania" },
	"484": { alpha3: "MEX", name: "Mexico" },
	"498": { alpha3: "MDA", name: "Moldova" },
	"496": { alpha3: "MNG", name: "Mongolia" },
	"499": { alpha3: "MNE", name: "Montenegro" },
	"504": { alpha3: "MAR", name: "Morocco" },
	"508": { alpha3: "MOZ", name: "Mozambique" },
	"104": { alpha3: "MMR", name: "Myanmar" },
	"516": { alpha3: "NAM", name: "Namibia" },
	"524": { alpha3: "NPL", name: "Nepal" },
	"528": { alpha3: "NLD", name: "Netherlands" },
	"540": { alpha3: "NCL", name: "New Caledonia" },
	"554": { alpha3: "NZL", name: "New Zealand" },
	"558": { alpha3: "NIC", name: "Nicaragua" },
	"562": { alpha3: "NER", name: "Niger" },
	"566": { alpha3: "NGA", name: "Nigeria" },
	"578": { alpha3: "NOR", name: "Norway" },
	"512": { alpha3: "OMN", name: "Oman" },
	"586": { alpha3: "PAK", name: "Pakistan" },
	"275": { alpha3: "PSE", name: "Palestine" },
	"591": { alpha3: "PAN", name: "Panama" },
	"598": { alpha3: "PNG", name: "Papua New Guinea" },
	"600": { alpha3: "PRY", name: "Paraguay" },
	"604": { alpha3: "PER", name: "Peru" },
	"608": { alpha3: "PHL", name: "Philippines" },
	"616": { alpha3: "POL", name: "Poland" },
	"620": { alpha3: "PRT", name: "Portugal" },
	"630": { alpha3: "PRI", name: "Puerto Rico" },
	"634": { alpha3: "QAT", name: "Qatar" },
	"642": { alpha3: "ROU", name: "Romania" },
	"643": { alpha3: "RUS", name: "Russia" },
	"646": { alpha3: "RWA", name: "Rwanda" },
	"682": { alpha3: "SAU", name: "Saudi Arabia" },
	"686": { alpha3: "SEN", name: "Senegal" },
	"688": { alpha3: "SRB", name: "Serbia" },
	"694": { alpha3: "SLE", name: "Sierra Leone" },
	"702": { alpha3: "SGP", name: "Singapore" },
	"703": { alpha3: "SVK", name: "Slovakia" },
	"705": { alpha3: "SVN", name: "Slovenia" },
	"090": { alpha3: "SLB", name: "Solomon Islands" },
	"706": { alpha3: "SOM", name: "Somalia" },
	"710": { alpha3: "ZAF", name: "South Africa" },
	"728": { alpha3: "SSD", name: "South Sudan" },
	"724": { alpha3: "ESP", name: "Spain" },
	"144": { alpha3: "LKA", name: "Sri Lanka" },
	"729": { alpha3: "SDN", name: "Sudan" },
	"740": { alpha3: "SUR", name: "Suriname" },
	"752": { alpha3: "SWE", name: "Sweden" },
	"756": { alpha3: "CHE", name: "Switzerland" },
	"760": { alpha3: "SYR", name: "Syria" },
	"158": { alpha3: "TWN", name: "Taiwan" },
	"762": { alpha3: "TJK", name: "Tajikistan" },
	"834": { alpha3: "TZA", name: "Tanzania" },
	"764": { alpha3: "THA", name: "Thailand" },
	"626": { alpha3: "TLS", name: "Timor-Leste" },
	"768": { alpha3: "TGO", name: "Togo" },
	"780": { alpha3: "TTO", name: "Trinidad and Tobago" },
	"788": { alpha3: "TUN", name: "Tunisia" },
	"792": { alpha3: "TUR", name: "Turkey" },
	"795": { alpha3: "TKM", name: "Turkmenistan" },
	"800": { alpha3: "UGA", name: "Uganda" },
	"804": { alpha3: "UKR", name: "Ukraine" },
	"784": { alpha3: "ARE", name: "United Arab Emirates" },
	"826": { alpha3: "GBR", name: "United Kingdom" },
	"840": { alpha3: "USA", name: "United States" },
	"858": { alpha3: "URY", name: "Uruguay" },
	"860": { alpha3: "UZB", name: "Uzbekistan" },
	"548": { alpha3: "VUT", name: "Vanuatu" },
	"862": { alpha3: "VEN", name: "Venezuela" },
	"704": { alpha3: "VNM", name: "Vietnam" },
	"732": { alpha3: "ESH", name: "Western Sahara" },
	"887": { alpha3: "YEM", name: "Yemen" },
	"894": { alpha3: "ZMB", name: "Zambia" },
	"716": { alpha3: "ZWE", name: "Zimbabwe" },
	"010": { alpha3: "ATA", name: "Antarctica" },
	"196": { alpha3: "CYP", name: "Cyprus" },
	"900": { alpha3: "XKX", name: "Kosovo" },
} as const;

const countriesFeatureCollection = feature(
	topology as unknown as Topology,
	(topology as unknown as Topology).objects.countries as GeometryCollection,
);

/**
 * Country features extracted from the world-atlas 110m TopoJSON,
 * mapped to ISO alpha-3 codes and names. Computed once at module load.
 */
const countryFeatures: ReadonlyArray<{
	id: string;
	name: string;
}> = (() => {
	const seen = new Set<string>();
	return countriesFeatureCollection.features
		.map((f) => {
			const numericId = String(f.id ?? "");
			const paddedId = numericId.padStart(3, "0");
			const entry = numericToAlpha3[paddedId] ?? numericToAlpha3[numericId];

			if (!entry || seen.has(entry.alpha3)) {
				return null;
			}
			seen.add(entry.alpha3);

			return {
				id: entry.alpha3,
				name: entry.name,
			};
		})
		.filter(
			(x): x is { id: string; name: string } => x !== null,
		);
})();

/**
 * Returns all country features with ISO alpha-3 code and name.
 */
function getCountryFeatures(): ReadonlyArray<{ id: string; name: string }> {
	return countryFeatures;
}

/**
 * Map of ISO alpha-3 code to country name, derived from the world-atlas dataset.
 */
const countryNames: Record<string, string> = Object.fromEntries(
	countryFeatures.map(({ id, name }) => [id, name]),
);

function getCountryNames(): Record<string, string> {
	return countryNames;
}

/**
 * The set of ISO alpha-3 codes present in the 110m dataset.
 */
const countryIds: ReadonlyArray<string> = countryFeatures.map(({ id }) => id);

function getCountryIds(): ReadonlyArray<string> {
	return countryIds;
}

export { getCountryFeatures, getCountryNames, getCountryIds, numericToAlpha3, countriesFeatureCollection };
