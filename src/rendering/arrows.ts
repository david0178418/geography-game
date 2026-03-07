import type { GlobeContext, MovementArrow } from "./types.ts";

function drawArrows(
	ctx: CanvasRenderingContext2D,
	globe: GlobeContext,
	arrows: ReadonlyArray<MovementArrow>,
): void {
	arrows.forEach((arrow) => {
		const from = globe.projection([arrow.from[0], arrow.from[1]]);
		const to = globe.projection([arrow.to[0], arrow.to[1]]);
		if (!from || !to) return;

		const [x1, y1] = from;
		const [x2, y2] = to;

		const thickness = Math.max(1, Math.min(3, arrow.amount / 3));

		// Draw line
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.strokeStyle = arrow.color;
		ctx.lineWidth = thickness;
		ctx.globalAlpha = 0.8;
		ctx.stroke();

		// Draw arrowhead
		const angle = Math.atan2(y2 - y1, x2 - x1);
		const headLen = 6 + thickness * 2;

		ctx.beginPath();
		ctx.moveTo(x2, y2);
		ctx.lineTo(
			x2 - headLen * Math.cos(angle - Math.PI / 6),
			y2 - headLen * Math.sin(angle - Math.PI / 6),
		);
		ctx.lineTo(
			x2 - headLen * Math.cos(angle + Math.PI / 6),
			y2 - headLen * Math.sin(angle + Math.PI / 6),
		);
		ctx.closePath();
		ctx.fillStyle = arrow.color;
		ctx.fill();

		ctx.globalAlpha = 1.0;
	});
}

function drawContestedIndicators(
	ctx: CanvasRenderingContext2D,
	globe: GlobeContext,
	contestedCoords: ReadonlyArray<readonly [number, number]>,
): void {
	contestedCoords.forEach((coord) => {
		const projected = globe.projection([coord[0], coord[1]]);
		if (!projected) return;

		const [x, y] = projected;
		const radius = 4;

		// Draw a pulsing contested marker
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, 2 * Math.PI);
		ctx.fillStyle = "rgba(255, 50, 50, 0.7)";
		ctx.fill();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 1;
		ctx.stroke();

		// Draw crossed swords icon (simple X)
		ctx.beginPath();
		ctx.moveTo(x - 3, y - 3);
		ctx.lineTo(x + 3, y + 3);
		ctx.moveTo(x + 3, y - 3);
		ctx.lineTo(x - 3, y + 3);
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 1.5;
		ctx.stroke();
	});
}

export { drawArrows, drawContestedIndicators };
