import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { useContextualPrompts } from "@/hooks/useContextualPrompts.ts";
import { ButtonPromptsBar } from "@/components/button-prompts/index.tsx";
import type { ControllerType } from "@/input/input-types.ts";

function PromptBar() {
	const activeInputMethod = useEcsResource("activeInputMethod");
	const interactionState = useEcsResource("interactionState");
	const prompts = useContextualPrompts(interactionState);

	if (!activeInputMethod || activeInputMethod === 'mouse' || activeInputMethod === 'touch') {
		return null;
	}

	return (
		<div className="prompt-bar">
			<ButtonPromptsBar
				controllerType={activeInputMethod as ControllerType}
				prompts={[...prompts]}
			/>
		</div>
	);
}

export { PromptBar };
