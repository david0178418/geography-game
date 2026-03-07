import { geoContains } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { countriesFeatureCollection, featureIdToAlpha3 } from "@/data/countries.ts";

function screenToCountryId(
	projection: GeoProjection,
	screenX: number,
	screenY: number,
): string | null {
	const coords = projection.invert?.([screenX, screenY]);
	if (!coords) return null;

	const feature = countriesFeatureCollection.features.find((f) =>
		geoContains(f, coords),
	);
	if (!feature) return null;

	return featureIdToAlpha3(feature.id);
}

export { screenToCountryId };
