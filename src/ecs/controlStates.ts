type ControlState = "hostile" | "neutral" | "friendly" | "allied" | "annexed";

const BASE_THRESHOLDS: ReadonlyArray<readonly [number, ControlState]> = [
	[80, "annexed"],
	[60, "allied"],
	[40, "friendly"],
	[20, "neutral"],
] as const;

function getControlState(influenceValue: number, stabilityCurrent: number): ControlState {
	const stabilityFactor = stabilityCurrent / 50;
	const match = BASE_THRESHOLDS.find(([base]) => influenceValue >= base * stabilityFactor);
	return match ? match[1] : "hostile";
}

function getDominantFaction(
	factionInfluence: Readonly<Record<string, number>>,
): { readonly factionId: string; readonly value: number } | null {
	return Object.entries(factionInfluence)
		.filter(([, v]) => v > 0)
		.reduce<{ readonly factionId: string; readonly value: number } | null>(
			(best, [factionId, value]) => {
				if (best === null || value > best.value) return { factionId, value };
				return best;
			},
			null,
		);
}

function getControlStateForCountry(
	factionInfluence: Readonly<Record<string, number>>,
	stabilityCurrent: number,
): { readonly dominantFactionId: string | null; readonly state: ControlState; readonly value: number } {
	const dominant = getDominantFaction(factionInfluence);
	if (!dominant) return { dominantFactionId: null, state: "hostile", value: 0 };
	return {
		dominantFactionId: dominant.factionId,
		state: getControlState(dominant.value, stabilityCurrent),
		value: dominant.value,
	};
}

export { getControlState, getDominantFaction, getControlStateForCountry };
export type { ControlState };
