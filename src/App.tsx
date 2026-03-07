import { useEffect, useRef, useState } from "react";
import { initGlobe } from "./rendering/index.ts";
import type { GlobeHighlight, MovementArrow } from "./rendering/types.ts";
import { createWorld } from "./ecs/world.ts";
import type { GameWorld } from "./ecs/world.ts";
import { spawnCountries } from "./ecs/spawnCountries.ts";
import { registerTurnSystems } from "./ecs/turnLoop.ts";
import { GameContext } from "./contexts/GameContext.ts";
import { TurnControls } from "./components/TurnControls.tsx";
import { FactionSummaryBar } from "./components/FactionSummaryBar.tsx";
import { CountryInfoPanel } from "./components/CountryInfoPanel.tsx";
import { ActionPanel } from "./components/ActionPanel.tsx";
import "./App.css";

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

	const capitalCoords = new Map<string, readonly [number, number]>(
		entities.map((e) => [e.components.country.countryId, e.components.country.capitalCoordinates]),
	);

	return [...pendingOrders.values()]
		.filter((order) => order.type === "move")
		.flatMap((order) => {
			const from = capitalCoords.get(order.sourceCountryId);
			const to = capitalCoords.get(order.targetCountryId);
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

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const factionColors = buildFactionColorMap(world);
		const handle = initGlobe(canvas);

		handle.globe.config = {
			...handle.globe.config,
			factionColors,
		};

		let hoveredCountryId: string | null = null;
		let cachedControlMap = buildFactionControlMap(world);
		let cachedArrows = buildMovementArrows(world, factionColors);
		let cachedContestedCoords = buildContestedCoords(world);

		function redrawWithHighlight() {
			const selectedCountryId = world.getResource("selectedCountryId");
			const highlight: GlobeHighlight = {
				selectedCountryId,
				hoveredCountryId,
				factionControlMap: cachedControlMap,
				movementArrows: cachedArrows,
				contestedCoords: cachedContestedCoords,
			};
			handle.redraw(highlight);
		}

		function rebuildOverlayCache() {
			cachedArrows = buildMovementArrows(world, factionColors);
			cachedContestedCoords = buildContestedCoords(world);
		}

		handle.onCountryClick((countryId) => {
			world.setResource("selectedCountryId", countryId);
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

		redrawWithHighlight();

		return () => {
			handle.cleanup();
			unsubTurnResolved();
			unsubOrderSubmitted();
		};
	}, [world]);

	return (
		<GameContext.Provider value={world}>
			<canvas ref={canvasRef} className="globe-canvas" />
			<FactionSummaryBar />
			<CountryInfoPanel />
			<ActionPanel />
			<TurnControls />
		</GameContext.Provider>
	);
}

export default App;
