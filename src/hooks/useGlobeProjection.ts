import { useEffect, useRef, useState } from "react";
import { applyState } from "@/rendering/projection.ts";
import type { GlobeHandle } from "@/rendering/index.ts";

interface ProjectionOptions {
	readonly cardWidth: number;
	readonly margin: number;
	readonly offsetX: number;
	readonly offsetY: number;
}

interface CardPosition {
	readonly x: number;
	readonly y: number;
	readonly visible: boolean;
}

const HIDDEN: CardPosition = { x: 0, y: 0, visible: false };

function useGlobeProjection(
	globeHandle: GlobeHandle | null,
	capitalCoords: readonly [number, number] | null,
	options: ProjectionOptions,
): CardPosition {
	const [pos, setPos] = useState<CardPosition>(HIDDEN);
	const prevRef = useRef<CardPosition>(HIDDEN);

	useEffect(() => {
		if (!globeHandle || !capitalCoords) {
			if (prevRef.current.visible) {
				prevRef.current = HIDDEN;
				setPos(HIDDEN);
			}
			return;
		}

		let frameId: number;

		function tick() {
			const { projection, state } = globeHandle!.globe;
			applyState(projection, state);
			const projected = projection([capitalCoords![0], capitalCoords![1]]);

			if (!projected) {
				if (prevRef.current.visible) {
					prevRef.current = HIDDEN;
					setPos(HIDDEN);
				}
			} else {
				const viewportWidth = state.width;
				const rawX = projected[0] + options.offsetX;
				const x = rawX + options.cardWidth > viewportWidth - options.margin
					? projected[0] - options.cardWidth - options.offsetX
					: rawX;
				const y = projected[1] + options.offsetY;

				if (prevRef.current.x !== x || prevRef.current.y !== y || !prevRef.current.visible) {
					const next: CardPosition = { x, y, visible: true };
					prevRef.current = next;
					setPos(next);
				}
			}

			frameId = requestAnimationFrame(tick);
		}

		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	}, [globeHandle, capitalCoords, options.cardWidth, options.margin, options.offsetX, options.offsetY]);

	return pos;
}

export { useGlobeProjection };
export type { CardPosition };
