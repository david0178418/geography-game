/**
 * Pure function that picks the best neighbor in a given direction
 * based on geographic bearing from current capital to each neighbor's capital.
 */

type Direction = 'up' | 'down' | 'left' | 'right';

const directionBearings: Record<Direction, number> = {
	up: 0,
	right: 90,
	down: 180,
	left: 270,
};

function toRadians(deg: number): number {
	return deg * Math.PI / 180;
}

function computeBearing(
	fromCoords: readonly [number, number],
	toCoords: readonly [number, number],
): number {
	const lon1 = toRadians(fromCoords[0]);
	const lat1 = toRadians(fromCoords[1]);
	const lon2 = toRadians(toCoords[0]);
	const lat2 = toRadians(toCoords[1]);

	const dLon = lon2 - lon1;
	const y = Math.sin(dLon) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
	const bearing = Math.atan2(y, x) * 180 / Math.PI;
	return (bearing + 360) % 360;
}

function angularDifference(a: number, b: number): number {
	const diff = Math.abs(a - b) % 360;
	return diff > 180 ? 360 - diff : diff;
}

function findNeighborInDirection(
	currentCountryId: string,
	direction: Direction,
	adjacencyMap: Readonly<Record<string, ReadonlyArray<string>>>,
	capitalCoords: ReadonlyMap<string, readonly [number, number]>,
): string | null {
	const neighbors = adjacencyMap[currentCountryId];
	if (!neighbors || neighbors.length === 0) return null;

	const currentCoords = capitalCoords.get(currentCountryId);
	if (!currentCoords) return null;

	const targetBearing = directionBearings[direction];

	const scored = neighbors
		.map((neighborId) => {
			const coords = capitalCoords.get(neighborId);
			if (!coords) return null;
			const bearing = computeBearing(currentCoords, coords);
			const diff = angularDifference(targetBearing, bearing);
			return { neighborId, diff };
		})
		.filter((entry): entry is { neighborId: string; diff: number } => entry !== null);

	if (scored.length === 0) return null;

	const best = scored.reduce((a, b) => a.diff < b.diff ? a : b);
	return best.neighborId;
}

export { findNeighborInDirection };
export type { Direction };
