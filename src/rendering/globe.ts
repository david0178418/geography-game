import { geoGraticule10 } from "d3-geo";
import type { GeoPath } from "d3-geo";
import { countriesFeatureCollection, featureIdToAlpha3 } from "../data/countries.ts";
import type { GlobeContext, GlobeHighlight } from "./types.ts";
import { drawArrows, drawContestedIndicators } from "./arrows.ts";

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

const featureAlpha3Cache = new Map<string | number, string | null>(
	countriesFeatureCollection.features.map((f) => [f.id ?? "", featureIdToAlpha3(f.id)]),
);

function drawCountries(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	config: GlobeContext["config"],
	highlight: GlobeHighlight,
): void {
	countriesFeatureCollection.features.forEach((feature) => {
		const alpha3 = featureAlpha3Cache.get(feature.id ?? "") ?? null;
		const isSelected = alpha3 !== null && alpha3 === highlight.selectedCountryId;
		const isHovered = alpha3 !== null && alpha3 === highlight.hoveredCountryId;
		const factionId = alpha3 !== null ? highlight.factionControlMap.get(alpha3) : undefined;

		const fillColor = isSelected
			? config.selectedColor
			: isHovered
				? config.hoveredColor
				: factionId
					? (config.factionColors[factionId] ?? config.baseColor)
					: config.baseColor;

		ctx.beginPath();
		pathGenerator(feature);
		ctx.fillStyle = fillColor;
		ctx.fill();
		ctx.strokeStyle = config.borderColor;
		ctx.lineWidth = 0.5;
		ctx.stroke();
	});
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

const DEFAULT_HIGHLIGHT: GlobeHighlight = {
	selectedCountryId: null,
	hoveredCountryId: null,
	factionControlMap: new Map(),
	movementArrows: [],
	contestedCoords: [],
};

function renderGlobe(
	globe: GlobeContext,
	pathGenerator: GeoPath,
	highlight: GlobeHighlight = DEFAULT_HIGHLIGHT,
): void {
	const { ctx, state, config } = globe;
	ctx.clearRect(0, 0, state.width, state.height);
	drawOcean(ctx, globe);
	drawCountries(ctx, pathGenerator, config, highlight);
	drawGraticule(ctx, pathGenerator, config);
	drawArrows(ctx, globe, highlight.movementArrows);
	drawContestedIndicators(ctx, globe, highlight.contestedCoords);
}

export { renderGlobe };
export type { GlobeHighlight };
