import type { InputAction } from '@/input/input-types.ts';
import type { ControllerType } from '@/input/input-types.ts';
import { ControllerButtonLabels } from '@/input/controller-mappings.ts';
import { ButtonGlyphMap } from './button-glyph-map.ts';

interface ButtonPromptProps {
	readonly action: InputAction;
	readonly controllerType: ControllerType;
	readonly label: string;
}

function ButtonPrompt({ action, controllerType, label }: ButtonPromptProps) {
	const GlyphComponent = ButtonGlyphMap[controllerType]?.[action];
	const buttonLabel = ControllerButtonLabels[controllerType]?.[action] ?? '';

	if (!GlyphComponent) return null;

	return (
		<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
			<GlyphComponent
				width={28}
				height={28}
				viewBox="0 0 64 64"
				aria-label={buttonLabel}
				style={{ display: 'block' }}
			/>
			<span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.8rem' }}>
				{label}
			</span>
		</span>
	);
}

interface ButtonPromptsBarProps {
	readonly controllerType: ControllerType;
	readonly prompts: ReadonlyArray<{ readonly action: InputAction; readonly label: string }>;
}

function ButtonPromptsBar({ controllerType, prompts }: ButtonPromptsBarProps) {
	return (
		<div style={{
			display: 'flex',
			gap: '12px',
			flexWrap: 'wrap',
			padding: '6px 12px',
			background: 'rgba(0, 0, 0, 0.7)',
			backdropFilter: 'blur(4px)',
			borderRadius: '6px',
		}}>
			{prompts.map((prompt) => (
				<ButtonPrompt
					key={prompt.action}
					action={prompt.action}
					controllerType={controllerType}
					label={prompt.label}
				/>
			))}
		</div>
	);
}

export { ButtonPrompt, ButtonPromptsBar };
