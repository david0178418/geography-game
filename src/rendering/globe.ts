import { geoGraticule10 } from "d3-geo";
import type { GeoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import topology from "world-atlas/countries-110m.json";
import type { GlobeContext } from "./types.ts";

const countriesFeatureCollection = feature(
	topology as unknown as Topology,
	(topology as unknown as Topology).objects.countries as GeometryCollection,
);

const graticule = geoGraticule10();

function drawOcean(ctx: CanvasRenderingContext2D, globe: GlobeContext): void {
	const [cx, cy] = [globe.state.width / 2, globe.state.height / 2];
	ctx.beginPath();
	ctx.arc(cx, cy, globe.state.scale, 0, 2 * Math.PI);
	ctx.fillStyle = globe.config.oceanColor;
	ctx.fill();
}

function drawCountries(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	baseColor: string,
	borderColor: string,
): void {
	ctx.beginPath();
	pathGenerator(countriesFeatureCollection);
	ctx.fillStyle = baseColor;
	ctx.fill();
	ctx.strokeStyle = borderColor;
	ctx.lineWidth = 0.5;
	ctx.stroke();
}

function drawGraticule(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	graticuleColor: string,
): void {
	ctx.beginPath();
	pathGenerator(graticule);
	ctx.strokeStyle = graticuleColor;
	ctx.lineWidth = 0.4;
	ctx.stroke();
}

export function renderGlobe(globe: GlobeContext, pathGenerator: GeoPath): void {
	const { ctx, state, config } = globe;
	ctx.clearRect(0, 0, state.width, state.height);
	drawOcean(ctx, globe);
	drawCountries(ctx, pathGenerator, config.baseColor, config.borderColor);
	drawGraticule(ctx, pathGenerator, config.graticuleColor);
}
