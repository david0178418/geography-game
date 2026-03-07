import { geoOrthographic, geoPath } from "d3-geo";
import type { GeoProjection, GeoPath } from "d3-geo";
import type { GlobeState } from "./types.ts";

export function applyState(projection: GeoProjection, state: GlobeState): void {
	projection
		.scale(state.scale)
		.translate([state.width / 2, state.height / 2])
		.rotate([state.rotation[0], state.rotation[1]]);
}

export function createProjection(state: GlobeState): GeoProjection {
	const projection = geoOrthographic().clipAngle(90);
	applyState(projection, state);
	return projection;
}

export function createPathGenerator(
	projection: GeoProjection,
	ctx: CanvasRenderingContext2D,
): GeoPath {
	return geoPath(projection).context(ctx);
}
