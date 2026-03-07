import { useSyncExternalStore, useCallback } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import type { GameResources } from "@/types/ecs.ts";

function useEcsResource<K extends keyof GameResources>(key: K): GameResources[K] {
	const world = useGameWorld();

	const subscribe = useCallback(
		(onStoreChange: () => void) => world.onResourceChange(key, onStoreChange),
		[world, key],
	);

	const getSnapshot = useCallback(
		() => world.getResource(key),
		[world, key],
	);

	return useSyncExternalStore(subscribe, getSnapshot);
}

export { useEcsResource };
