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
};

export type GlobeContext = {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	readonly projection: GeoProjection;
	readonly config: GlobeConfig;
	state: GlobeState;
};

export const DEFAULT_CONFIG: GlobeConfig = {
	minScale: 100,
	maxScale: 1000,
	baseColor: "#4a7c59",
	borderColor: "#2d4a35",
	oceanColor: "#1a3a5c",
	graticuleColor: "rgba(255, 255, 255, 0.15)",
} as const;
