import { geoGraticule10 } from "d3-geo";
import type { GeoPath } from "d3-geo";
import { countriesFeatureCollection } from "../data/countries.ts";
import type { GlobeContext } from "./types.ts";

const graticule = geoGraticule10();

function drawOcean(ctx: CanvasRenderingContext2D, globe: GlobeContext): void {
	ctx.beginPath();
	ctx.arc(
		globe.state.width / 2,
		globe.state.height / 2,
		globe.projection.scale(),
		0,
		2 * Math.PI,
	);
	ctx.fillStyle = globe.config.oceanColor;
	ctx.fill();
}

function drawCountries(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	config: GlobeContext["config"],
): void {
	ctx.beginPath();
	pathGenerator(countriesFeatureCollection);
	ctx.fillStyle = config.baseColor;
	ctx.fill();
	ctx.strokeStyle = config.borderColor;
	ctx.lineWidth = 0.5;
	ctx.stroke();
}

function drawGraticule(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	config: GlobeContext["config"],
): void {
	ctx.beginPath();
	pathGenerator(graticule);
	ctx.strokeStyle = config.graticuleColor;
	ctx.lineWidth = 0.4;
	ctx.stroke();
}

export function renderGlobe(globe: GlobeContext, pathGenerator: GeoPath): void {
	const { ctx, state, config } = globe;
	ctx.clearRect(0, 0, state.width, state.height);
	drawOcean(ctx, globe);
	drawCountries(ctx, pathGenerator, config);
	drawGraticule(ctx, pathGenerator, config);
}
