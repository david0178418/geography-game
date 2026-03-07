import type { GeoProjection } from "d3-geo";

export type GlobeState = {
	readonly rotation: readonly [number, number];
	readonly scale: number;
	readonly width: number;
	readonly height: number;
};

export type GlobeConfig = {
	readonly minScale: number;
	readonly maxScale: number;
	readonly baseColor: string;
	readonly borderColor: string;
	readonly oceanColor: string;
	readonly graticuleColor: string;
	readonly selectedColor: string;
	readonly hoveredColor: string;
	readonly factionColors: Readonly<Record<string, string>>;
};

export type GlobeContext = {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	readonly projection: GeoProjection;
	config: GlobeConfig;
	state: GlobeState;
};

export type CountryCallback = (countryId: string | null) => void;

export type GlobeHighlight = {
	readonly selectedCountryId: string | null;
	readonly hoveredCountryId: string | null;
	readonly factionControlMap: ReadonlyMap<string, string>; // countryId -> factionId
};

export const DEFAULT_CONFIG: GlobeConfig = {
	minScale: 100,
	maxScale: 1000,
	baseColor: "#4a7c59",
	borderColor: "#2d4a35",
	oceanColor: "#1a3a5c",
	graticuleColor: "rgba(255, 255, 255, 0.15)",
	selectedColor: "#f59e0b",
	hoveredColor: "#6ee7b7",
	factionColors: {},
} as const;
