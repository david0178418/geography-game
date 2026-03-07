import type { TurnPhase } from "@/types/ecs.ts";
import type { GameWorld } from "./world.ts";

const phaseTransitions: Readonly<Record<TurnPhase, TurnPhase>> = {
	planning: "resolution",
	resolution: "notification",
	notification: "planning",
} as const;

const resolutionStubs = [
	{ name: "movement", priority: 40 },
	{ name: "combat", priority: 30 },
	{ name: "influence", priority: 20 },
	{ name: "reinforcement", priority: 10 },
] as const;

function registerTurnSystems(world: GameWorld): void {
	resolutionStubs.forEach(({ name, priority }) => {
		world.addSystem(`resolution:${name}`)
			.setPriority(priority)
			.runWhenEmpty()
			.setProcess(({ ecs }) => {
				const phase = ecs.getResource("currentPhase");
				if (phase !== "resolution") return;
			});
	});

	// Phase transition system - runs after all resolution systems
	world.addSystem("phaseTransition")
		.setPriority(0)
		.runWhenEmpty()
		.setProcess(({ ecs }) => {
			const phase = ecs.getResource("currentPhase");
			if (phase === "resolution") {
				advancePhase(ecs);
			}
		});

	// Handle endTurn event: transition from planning to resolution
	world.on("endTurn", () => {
		const phase = world.getResource("currentPhase");
		if (phase !== "planning") return;
		advancePhase(world);
	});

	// Handle notification -> planning transition
	// Guard on "notification" prevents re-entry when this publishes "planning"
	world.on("phaseChanged", ({ phase }) => {
		if (phase !== "notification") return;

		const turnNumber = world.getResource("turnNumber");
		world.eventBus.publish("turnResolved", { turnNumber });

		world.updateResource("turnNumber", (n) => n + 1);
		world.updateResource("currentPhase", () => "planning" as TurnPhase);
		world.updateResource("pendingOrders", () => new Map());
		world.eventBus.publish("phaseChanged", { phase: "planning" });
	});
}

function advancePhase(world: GameWorld): void {
	const current = world.getResource("currentPhase");
	const next = phaseTransitions[current];
	world.updateResource("currentPhase", () => next);
	world.eventBus.publish("phaseChanged", { phase: next });
}

export { registerTurnSystems };
