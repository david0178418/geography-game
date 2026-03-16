import { geoGraticule10 } from "d3-geo";
import type { GeoPath } from "d3-geo";
import { countriesFeatureCollection, featureIdToAlpha3 } from "../data/countries.ts";
import type { GlobeContext, GlobeHighlight } from "./types.ts";
import { SECONDARY_HIGHLIGHT_COLOR } from "./types.ts";
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

function countryFillColor(
	alpha3: string | null,
	config: GlobeContext["config"],
	highlight: GlobeHighlight,
): string {
	if (alpha3 === null) return config.baseColor;
	if (alpha3 === highlight.secondaryFocusedCountryId) return highlight.validTargetColor ?? SECONDARY_HIGHLIGHT_COLOR;
	if (alpha3 === highlight.selectedCountryId) return config.selectedColor;
	if (alpha3 === highlight.hoveredCountryId) return config.hoveredColor;
	const factionId = highlight.factionControlMap.get(alpha3);
	return factionId ? (config.factionColors[factionId] ?? config.baseColor) : config.baseColor;
}

function drawCountries(
	ctx: CanvasRenderingContext2D,
	pathGenerator: GeoPath,
	config: GlobeContext["config"],
	highlight: GlobeHighlight,
): void {
	countriesFeatureCollection.features.forEach((feature) => {
		const alpha3 = featureAlpha3Cache.get(feature.id ?? "") ?? null;
		const isValidTarget = alpha3 !== null && (highlight.validTargets?.has(alpha3) ?? false);
		const isSecondaryFocused = alpha3 !== null && alpha3 === highlight.secondaryFocusedCountryId;

		ctx.beginPath();
		pathGenerator(feature);
		ctx.fillStyle = countryFillColor(alpha3, config, highlight);
		ctx.fill();

		// Valid targets get a highlighted border to stand out
		if (isValidTarget && !isSecondaryFocused) {
			ctx.strokeStyle = highlight.validTargetColor ?? SECONDARY_HIGHLIGHT_COLOR;
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}

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

function drawCenterMarker(ctx: CanvasRenderingContext2D, globe: GlobeContext): void {
	const cx = globe.state.width / 2;
	const cy = globe.state.height / 2;
	const size = 10;
	const gap = 4;
	const color = "rgba(255, 255, 255, 0.8)";

	// Crosshair lines (single path)
	ctx.beginPath();
	ctx.moveTo(cx - size, cy);
	ctx.lineTo(cx - gap, cy);
	ctx.moveTo(cx + gap, cy);
	ctx.lineTo(cx + size, cy);
	ctx.moveTo(cx, cy - size);
	ctx.lineTo(cx, cy - gap);
	ctx.moveTo(cx, cy + gap);
	ctx.lineTo(cx, cy + size);
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Center dot
	ctx.beginPath();
	ctx.arc(cx, cy, 1.5, 0, 2 * Math.PI);
	ctx.fillStyle = color;
	ctx.fill();
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
	if (highlight.showCenterMarker) {
		drawCenterMarker(ctx, globe);
	}
}

export { renderGlobe };
export type { GlobeHighlight };
