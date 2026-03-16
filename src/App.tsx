import { useEffect, useRef, useState } from "react";
import { initGlobe } from "./rendering/index.ts";
import type { GlobeHandle } from "./rendering/index.ts";
import type { MovementArrow } from "./rendering/types.ts";
import { SECONDARY_HIGHLIGHT_COLOR } from "./rendering/types.ts";
import { createGlobeController } from "./rendering/globe-controller.ts";
import type { GlobeControllerHandle } from "./rendering/globe-controller.ts";
import { createWorld } from "./ecs/world.ts";
import type { GameWorld } from "./ecs/world.ts";
import { spawnCountries } from "./ecs/spawnCountries.ts";
import { registerTurnSystems } from "./ecs/turnLoop.ts";
import { focusCountry, focusSecondaryOptionByCountryId } from "./ecs/interaction-state.ts";
import { adjacency } from "./data/adjacency.ts";
import { capitals } from "./data/capitals.ts";
import { GameContext } from "./contexts/GameContext.ts";
import { FactionSummaryBar } from "./components/FactionSummaryBar.tsx";
import { CountryInfoPanel } from "./components/CountryInfoPanel.tsx";
import { ControlBar } from "./components/ControlBar.tsx";
import { InputMethodTracker } from "./components/InputMethodTracker.tsx";
import { GlobeInputHandler } from "./components/GlobeInputHandler.tsx";
import "./App.css";

const capitalCoords = new Map(
	Object.entries(capitals).map(([id, cap]) => [id, cap.coordinates as readonly [number, number]])
);

function buildFactionControlMap(world: GameWorld): Map<string, string> {
	const entities = world.getEntitiesWithQuery(["country", "control"]);
	return entities.reduce((map, entity) => {
		const { country, control } = entity.components;
		if (control.factionId !== null) {
			map.set(country.countryId, control.factionId);
		}
		return map;
	}, new Map<string, string>());
}

function buildFactionColorMap(world: GameWorld): Record<string, string> {
	const factions = world.getResource("factions");
	return Object.fromEntries(factions.map((f) => [f.id, f.color]));
}

function buildMovementArrows(
	world: GameWorld,
	factionColors: Record<string, string>,
): ReadonlyArray<MovementArrow> {
	const pendingOrders = world.getResource("pendingOrders");
	const entities = world.getEntitiesWithQuery(["country"]);

	const coords = new Map<string, readonly [number, number]>(
		entities.map((e) => [e.components.country.countryId, e.components.country.capitalCoordinates]),
	);

	return [...pendingOrders.values()]
		.filter((order) => order.type === "move")
		.flatMap((order) => {
			const from = coords.get(order.sourceCountryId);
			const to = coords.get(order.targetCountryId);
			if (!from || !to) return [];
			return [{
				from,
				to,
				amount: order.amount,
				color: factionColors[order.factionId] ?? "#ffffff",
			}];
		});
}

function buildContestedCoords(world: GameWorld): ReadonlyArray<readonly [number, number]> {
	const entities = world.getEntitiesWithQuery(["country", "troops"]);
	return entities
		.filter((e) => Object.keys(e.components.troops.contestedTroops).length > 0)
		.map((e) => e.components.country.capitalCoordinates);
}


function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [world] = useState(() => {
		const w = createWorld();
		spawnCountries(w);
		registerTurnSystems(w);
		return w;
	});
	const [globeHandle, setGlobeHandle] = useState<GlobeHandle | null>(null);
	const [globeController, setGlobeController] = useState<GlobeControllerHandle | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const factionColors = buildFactionColorMap(world);
		const handle = initGlobe(canvas);

		handle.globe.config = {
			...handle.globe.config,
			factionColors,
		};

		const controller = createGlobeController(handle.globe, () => handle.redraw(), {
			adjacencyMap: adjacency,
			capitalCoords,
		});

		setGlobeHandle(handle);
		setGlobeController(controller);

		let hoveredCountryId: string | null = null;
		let cachedControlMap = buildFactionControlMap(world);
		let cachedArrows = buildMovementArrows(world, factionColors);
		let cachedContestedCoords = buildContestedCoords(world);
		let cachedValidTargets: ReadonlySet<string> = new Set();
		let cachedValidOptionsRef: ReadonlyArray<string> | null = null;

		function redrawWithHighlight() {
			const selectedCountryId = world.getResource("selectedCountryId");
			const interactionState = world.getResource("interactionState");

			const isSecondarySelection = interactionState.mode === 'secondarySelection';

			const baseHighlight = {
				selectedCountryId,
				hoveredCountryId,
				factionControlMap: cachedControlMap,
				movementArrows: cachedArrows,
				contestedCoords: cachedContestedCoords,
				showCenterMarker: interactionState.mode !== 'idle',
			};

			if (!isSecondarySelection) {
				cachedValidOptionsRef = null;
				handle.redraw(baseHighlight);
				return;
			}

			if (interactionState.validOptions !== cachedValidOptionsRef) {
				cachedValidOptionsRef = interactionState.validOptions;
				cachedValidTargets = new Set(interactionState.validOptions);
			}

			handle.redraw({
				...baseHighlight,
				validTargets: cachedValidTargets,
				validTargetColor: SECONDARY_HIGHLIGHT_COLOR,
				secondaryFocusedCountryId: interactionState.validOptions[interactionState.focusedIndex] ?? null,
			});
		}

		function rebuildOverlayCache() {
			cachedArrows = buildMovementArrows(world, factionColors);
			cachedContestedCoords = buildContestedCoords(world);
		}

		handle.onCountryClick((countryId) => {
			const currentState = world.getResource("interactionState");
			if (currentState.mode === 'secondarySelection') {
				if (countryId) {
					const next = focusSecondaryOptionByCountryId(currentState, countryId);
					if (next !== currentState) world.setResource("interactionState", next);
				}
				return;
			}
			if (countryId) {
				focusCountry(world, countryId);
			} else {
				world.setResource("selectedCountryId", null);
				world.setResource("interactionState", { mode: 'idle' as const });
			}
			world.eventBus.publish("countryClicked", { countryId });
			redrawWithHighlight();
		});

		handle.onCountryHover((countryId) => {
			hoveredCountryId = countryId;
			redrawWithHighlight();
		});

		const unsubTurnResolved = world.on("turnResolved", () => {
			cachedControlMap = buildFactionControlMap(world);
			rebuildOverlayCache();
			redrawWithHighlight();
		});

		const unsubOrderSubmitted = world.on("orderSubmitted", () => {
			rebuildOverlayCache();
			redrawWithHighlight();
		});

		let lastCenteredOption: string | null = null;
		const unsubInteractionState = world.onResourceChange("interactionState", () => {
			const state = world.getResource("interactionState");
			if (state.mode === 'secondarySelection') {
				const focusedId = state.validOptions[state.focusedIndex];
				if (focusedId && focusedId !== lastCenteredOption) {
					lastCenteredOption = focusedId;
					controller.centerOnCountryById(focusedId);
				}
			} else {
				lastCenteredOption = null;
			}
			redrawWithHighlight();
		});

		redrawWithHighlight();

		return () => {
			handle.cleanup();
			controller.cleanup();
			unsubTurnResolved();
			unsubOrderSubmitted();
			unsubInteractionState();
			setGlobeHandle(null);
			setGlobeController(null);
		};
	}, [world]);

	return (
		<GameContext.Provider value={world}>
			<canvas ref={canvasRef} className="globe-canvas" />
			<InputMethodTracker />
			<GlobeInputHandler globeHandle={globeHandle} globeController={globeController} />
			<FactionSummaryBar />
			<CountryInfoPanel />
			<ControlBar />
		</GameContext.Provider>
	);
}

export default App;
