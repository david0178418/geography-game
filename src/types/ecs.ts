// ECS Component Types

export interface CountryComponent {
	readonly countryId: string; // ISO alpha-3
	readonly name: string;
	readonly capitalName: string;
	readonly capitalCoordinates: readonly [number, number];
}

export interface AdjacencyComponent {
	readonly neighbors: ReadonlyArray<string>; // ISO alpha-3 codes
}

export interface ControlComponent {
	readonly factionId: string | null; // null = uncontrolled
	readonly annexed: boolean;
}

export interface TroopsComponent {
	readonly count: number;
}

export interface InfluenceComponent {
	readonly factionInfluence: Readonly<Record<string, number>>; // factionId -> 0-100
}

export interface StabilityComponent {
	readonly base: number;    // 0-100
	readonly current: number; // 0-100
}

// ECS Resource Types

export type TurnPhase = "planning" | "resolution" | "notification";

export interface Order {
	readonly type: "move" | "attack" | "influence";
	readonly sourceCountryId: string;
	readonly targetCountryId: string;
	readonly amount: number;
}

export interface GameResources {
	readonly turnNumber: number;
	readonly currentPhase: TurnPhase;
	readonly factions: ReadonlyArray<Faction>;
	readonly selectedCountryId: string | null;
	readonly pendingOrders: ReadonlyMap<string, Order>;
	readonly countryEntityMap: ReadonlyMap<string, number>; // countryId -> entityId
}

// ECS Event Types

export interface GameEvents {
	readonly endTurn: undefined;
	readonly phaseChanged: { readonly phase: TurnPhase };
	readonly orderSubmitted: { readonly order: Order };
	readonly turnResolved: { readonly turnNumber: number };
}

// ECS Component Map (for ecspresso generic)

export interface GameComponents {
	readonly country: CountryComponent;
	readonly adjacency: AdjacencyComponent;
	readonly control: ControlComponent;
	readonly troops: TroopsComponent;
	readonly influence: InfluenceComponent;
	readonly stability: StabilityComponent;
}

// Faction Types

export interface Faction {
	readonly id: string;
	readonly name: string;
	readonly color: string;
	readonly isPlayer: boolean;
	readonly homeCountryId: string;
}
