declare module "world-atlas/countries-110m.json" {
	const topology: {
		readonly type: "Topology";
		readonly objects: {
			readonly countries: {
				readonly type: "GeometryCollection";
				readonly geometries: ReadonlyArray<{
					readonly type: string;
					readonly id: string;
					readonly arcs: ReadonlyArray<ReadonlyArray<number>>;
				}>;
			};
		};
		readonly arcs: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
		readonly transform: {
			readonly scale: readonly [number, number];
			readonly translate: readonly [number, number];
		};
	};
	export default topology;
}
