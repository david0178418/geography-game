import { useEffect, useRef, useState } from "react";
import { initGlobe } from "./rendering/index.ts";
import type { GlobeHighlight } from "./rendering/types.ts";
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
	const entities = world.getEntitiesWithQuery(["country", "control"] as const);
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

		function redrawWithHighlight() {
			const selectedCountryId = world.getResource("selectedCountryId");
			const highlight: GlobeHighlight = {
				selectedCountryId,
				hoveredCountryId,
				factionControlMap: cachedControlMap,
			};
			handle.redraw(highlight);
		}

		handle.onCountryClick((countryId) => {
			world.updateResource("selectedCountryId", () => countryId);
			world.eventBus.publish("countryClicked", { countryId });
			redrawWithHighlight();
		});

		handle.onCountryHover((countryId) => {
			hoveredCountryId = countryId;
			redrawWithHighlight();
		});

		const unsubTurnResolved = world.on("turnResolved", () => {
			cachedControlMap = buildFactionControlMap(world);
			redrawWithHighlight();
		});

		redrawWithHighlight();

		return () => {
			handle.cleanup();
			unsubTurnResolved();
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
