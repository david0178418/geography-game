# D-Pad Diamond Amount Selector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mouse-centric range slider with a controller-friendly diamond d-pad widget for selecting troop/influence amounts.

**Architecture:** New `DPadSelector` presentation component renders the diamond visual and handles pointer auto-repeat. ControlBar owns all keyboard/gamepad input routing via existing `useInputAction` hooks, repurposing `NAVIGATE_*` actions for amount adjustment in `settingAmount` mode. Old slider/stepper markup and CSS removed.

**Tech Stack:** React 19, TypeScript, vanilla CSS

**Spec:** `docs/superpowers/specs/2026-03-15-dpad-amount-selector-design.md`

---

## Chunk 1: Core Implementation

### Task 1: Create `DPadSelector` component

**Files:**
- Create: `src/components/DPadSelector.tsx`
- Modify: `src/App.css` (add d-pad CSS, remove old `.amount-stepper` rules)

- [ ] **Step 1: Remove old CSS rules and add d-pad CSS to `App.css`**

Delete these blocks from `src/App.css`:

```css
.amount-stepper {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.amount-stepper button {
	padding: 0.3rem 0.6rem;
	background: rgba(255, 255, 255, 0.1);
	color: white;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 3px;
	cursor: pointer;
	font-size: 0.85rem;
}

.amount-stepper button:hover {
	background: rgba(255, 255, 255, 0.2);
}

.amount-value {
	min-width: 2rem;
	text-align: center;
}
```

And inside the `@media (pointer: coarse)` block, delete:

```css
	.amount-stepper button {
		min-width: 44px;
		min-height: 44px;
		font-size: 1.1rem;
	}
```

Then append before the `/* Touch-friendly sizing */` media query comment:

```css
/* D-Pad Amount Selector */
.dpad-selector {
	position: relative;
	width: 120px;
	height: 120px;
	flex-shrink: 0;
}

.dpad-diamond {
	position: absolute;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	transform: rotate(45deg);
	cursor: pointer;
	color: #e0e0e0;
	font-size: 0.7rem;
	padding: 0;
	line-height: 1;
	transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.dpad-diamond-content {
	transform: rotate(-45deg);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1px;
	font-size: 0.65rem;
	pointer-events: none;
}

.dpad-diamond-content .dpad-arrow {
	font-size: 0.8rem;
}

.dpad-diamond:hover {
	background: rgba(255, 255, 255, 0.2);
}

.dpad-diamond.active {
	border-color: rgba(34, 211, 238, 0.6);
	background: rgba(34, 211, 238, 0.15);
	box-shadow: 0 0 8px rgba(34, 211, 238, 0.3);
}

.dpad-diamond.disabled {
	opacity: 0.3;
	cursor: default;
	pointer-events: none;
}

.dpad-diamond.up {
	top: 0;
	left: 50%;
	transform: translateX(-50%) rotate(45deg);
}

.dpad-diamond.down {
	bottom: 0;
	left: 50%;
	transform: translateX(-50%) rotate(45deg);
}

.dpad-diamond.left {
	left: 0;
	top: 50%;
	transform: translateY(-50%) rotate(45deg);
}

.dpad-diamond.right {
	right: 0;
	top: 50%;
	transform: translateY(-50%) rotate(45deg);
}

.dpad-center {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 48px;
	height: 48px;
	background: rgba(0, 0, 0, 0.8);
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.4rem;
	font-weight: bold;
	color: #e0e0e0;
}
```

And inside the existing `@media (pointer: coarse)` block, add:

```css
	.dpad-diamond {
		width: 44px;
		height: 44px;
	}

	.dpad-selector {
		width: 140px;
		height: 140px;
	}

	.dpad-center {
		width: 52px;
		height: 52px;
	}
```

- [ ] **Step 2: Create `DPadSelector.tsx`**

Write `src/components/DPadSelector.tsx`:

```typescript
import { useRef, useCallback, useEffect } from "react";

type Direction = 'up' | 'down' | 'left' | 'right';

interface DPadSelectorProps {
	readonly value: number;
	readonly min: number;
	readonly max: number;
	readonly onAdjust: (delta: number) => void;
	readonly activeDirection: Direction | null;
}

const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 100;

const directionConfig = [
	{ direction: 'up' as const, delta: 10, arrow: '▲', label: '+10', ariaLabel: 'Increase by 10' },
	{ direction: 'down' as const, delta: -10, arrow: '▼', label: '-10', ariaLabel: 'Decrease by 10' },
	{ direction: 'left' as const, delta: -1, arrow: '◀', label: '-1', ariaLabel: 'Decrease by 1' },
	{ direction: 'right' as const, delta: 1, arrow: '▶', label: '+1', ariaLabel: 'Increase by 1' },
] as const;

function isDiamondDisabled(direction: Direction, value: number, min: number, max: number): boolean {
	return (direction === 'up' || direction === 'right')
		? value >= max
		: value <= min;
}

function DPadSelector({ value, min, max, onAdjust, activeDirection }: DPadSelectorProps) {
	const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clearRepeat = useCallback(() => {
		if (repeatTimerRef.current !== null) {
			clearTimeout(repeatTimerRef.current);
			repeatTimerRef.current = null;
		}
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	// Clean up timers on unmount
	useEffect(() => clearRepeat, [clearRepeat]);

	const startRepeat = useCallback((delta: number) => {
		clearRepeat();
		onAdjust(delta);
		repeatTimerRef.current = setTimeout(() => {
			intervalRef.current = setInterval(() => {
				onAdjust(delta);
			}, REPEAT_INTERVAL);
		}, REPEAT_DELAY);
	}, [onAdjust, clearRepeat]);

	return (
		<div className="dpad-selector">
			{directionConfig.map(({ direction, delta, arrow, label, ariaLabel }) => {
				const disabled = isDiamondDisabled(direction, value, min, max);
				const active = activeDirection === direction;
				const classNames = [
					'dpad-diamond',
					direction,
					active ? 'active' : '',
					disabled ? 'disabled' : '',
				].filter(Boolean).join(' ');

				return (
					<button
						key={direction}
						className={classNames}
						aria-label={ariaLabel}
						disabled={disabled}
						onPointerDown={() => {
							if (!disabled) startRepeat(delta);
						}}
						onPointerUp={clearRepeat}
						onPointerLeave={clearRepeat}
					>
						<span className="dpad-diamond-content">
							{direction === 'down' || direction === 'right' ? (
								<>
									<span>{label}</span>
									<span className="dpad-arrow">{arrow}</span>
								</>
							) : (
								<>
									<span className="dpad-arrow">{arrow}</span>
									<span>{label}</span>
								</>
							)}
						</span>
					</button>
				);
			})}
			<div className="dpad-center">{value}</div>
		</div>
	);
}

export { DPadSelector };
export type { Direction };
```

- [ ] **Step 3: Verify types**

Run: `bun run check:types`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/DPadSelector.tsx src/App.css
git commit -m "Add DPadSelector component and CSS"
```

---

### Task 2: Wire up ControlBar — replace slider with DPadSelector

**Files:**
- Modify: `src/components/ControlBar.tsx`
- Modify: `src/ecs/interaction-state.ts` (remove `setAmount`)

- [ ] **Step 1: Update imports in ControlBar**

In `src/components/ControlBar.tsx`, update the React import to include `useRef` and `useState`:

```typescript
import { useCallback, useMemo, useRef, useState } from "react";
```

Remove `setAmount` from the interaction-state import:

Change:
```typescript
import {
	selectForAction,
	chooseAction,
	navigateActionMenu,
	adjustAmount,
	setAmount,
	confirmAmount,
	navigateSecondarySelection,
	confirmSecondarySelection,
	goBack,
} from "@/ecs/interaction-state.ts";
```

To:
```typescript
import {
	selectForAction,
	chooseAction,
	navigateActionMenu,
	adjustAmount,
	confirmAmount,
	navigateSecondarySelection,
	confirmSecondarySelection,
	goBack,
} from "@/ecs/interaction-state.ts";
```

Add the DPadSelector import:

```typescript
import { DPadSelector } from "@/components/DPadSelector.tsx";
import type { Direction } from "@/components/DPadSelector.tsx";
```

- [ ] **Step 2: Add activeDirection state and flash helper**

Inside the `ControlBar` function, after the existing `const playerFaction = ...` line, add:

```typescript
	const activeDirTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [activeDir, setActiveDir] = useState<Direction | null>(null);

	const flashDirection = useCallback((dir: Direction) => {
		if (activeDirTimerRef.current !== null) clearTimeout(activeDirTimerRef.current);
		setActiveDir(dir);
		activeDirTimerRef.current = setTimeout(() => {
			setActiveDir(null);
		}, 150);
	}, []);
```

- [ ] **Step 3: Add navigate left/right handlers, expand up/down, consolidate increment/decrement**

Replace the existing `handleNavigateUp` callback:

```typescript
	const handleNavigateUp = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, 10, 1, maxAmount));
			flashDirection('up');
			return;
		}
		if (interactionState.mode === 'actionMenu') {
			world.setResource("interactionState", navigateActionMenu(interactionState, -1));
			return;
		}
		if (interactionState.mode === 'secondarySelection') {
			world.setResource("interactionState", navigateSecondarySelection(interactionState, -1));
		}
	}, [world, interactionState, maxAmount, flashDirection]);
```

Replace the existing `handleNavigateDown` callback:

```typescript
	const handleNavigateDown = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, -10, 1, maxAmount));
			flashDirection('down');
			return;
		}
		if (interactionState.mode === 'actionMenu') {
			world.setResource("interactionState", navigateActionMenu(interactionState, 1));
			return;
		}
		if (interactionState.mode === 'secondarySelection') {
			world.setResource("interactionState", navigateSecondarySelection(interactionState, 1));
		}
	}, [world, interactionState, maxAmount, flashDirection]);
```

Add new handlers after `handleNavigateDown`:

```typescript
	const handleNavigateLeft = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, -1, 1, maxAmount));
			flashDirection('left');
		}
	}, [world, interactionState, maxAmount, flashDirection]);

	const handleNavigateRight = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, 1, 1, maxAmount));
			flashDirection('right');
		}
	}, [world, interactionState, maxAmount, flashDirection]);
```

Remove the existing `handleIncrement` and `handleDecrement` callbacks entirely (they are now redundant with `handleNavigateRight`/`handleNavigateLeft`).

- [ ] **Step 4: Update input action registrations**

Replace the existing registrations:

```typescript
	useInputAction('NAVIGATE_UP', handleNavigateUp);
	useInputAction('NAVIGATE_DOWN', handleNavigateDown);
	useInputAction('NAVIGATE_LEFT', handleNavigateLeft);
	useInputAction('NAVIGATE_RIGHT', handleNavigateRight);
	useInputAction('INCREMENT', handleNavigateRight);
	useInputAction('DECREMENT', handleNavigateLeft);
	useInputAction('END_TURN', handleEndTurn);
```

- [ ] **Step 5: Add handleAdjust callback and replace the settingAmount render block**

Add a `useCallback`-wrapped `handleAdjust` after the other handlers:

```typescript
	const handleAdjust = useCallback((delta: number) => {
		world.setResource("interactionState", adjustAmount(interactionState, delta, 1, maxAmount));
	}, [world, interactionState, maxAmount]);
```

Replace the entire `{interactionState.mode === 'settingAmount' && (...)}` block with:

```tsx
				{interactionState.mode === 'settingAmount' && (
					<div className="control-bar-actions">
						<span className="action-type-label">
							{interactionState.actionType === 'move' ? 'Move Troops' : 'Spend Influence'}
						</span>
						<DPadSelector
							value={interactionState.amount}
							min={1}
							max={maxAmount}
							onAdjust={handleAdjust}
							activeDirection={activeDir}
						/>
						<button className="control-bar-btn primary" onClick={handleConfirm}>Confirm</button>
						<button className="control-bar-btn" onClick={handleBack}>Back</button>
					</div>
				)}
```

- [ ] **Step 6: Remove `setAmount` from `interaction-state.ts`**

In `src/ecs/interaction-state.ts`, delete the `setAmount` function:

```typescript
function setAmount(state: InteractionState, amount: number, min: number, max: number): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	return { ...state, amount: Math.max(min, Math.min(max, amount)) };
}
```

And remove `setAmount` from the export statement at the bottom.

- [ ] **Step 7: Verify types**

Run: `bun run check:types`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/ControlBar.tsx src/ecs/interaction-state.ts
git commit -m "Replace slider/stepper with DPadSelector in ControlBar"
```

---

### Task 3: Update contextual prompts

**Files:**
- Modify: `src/hooks/useContextualPrompts.ts`

- [ ] **Step 1: Replace `settingAmountPrompts`**

In `src/hooks/useContextualPrompts.ts`, replace:

```typescript
const settingAmountPrompts: ReadonlyArray<Prompt> = [
	{ action: 'INCREMENT', label: 'More' },
	{ action: 'DECREMENT', label: 'Less' },
	{ action: 'CONFIRM', label: 'Confirm' },
	{ action: 'BACK', label: 'Back' },
];
```

With:

```typescript
const settingAmountPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: '+10' },
	{ action: 'NAVIGATE_DOWN', label: '-10' },
	{ action: 'NAVIGATE_LEFT', label: '-1' },
	{ action: 'NAVIGATE_RIGHT', label: '+1' },
	{ action: 'CONFIRM', label: 'Confirm' },
	{ action: 'BACK', label: 'Back' },
];
```

- [ ] **Step 2: Verify types**

Run: `bun run check:types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useContextualPrompts.ts
git commit -m "Update settingAmount prompts for d-pad directions"
```

---

### Task 4: Build and manual verification

- [ ] **Step 1: Run full build**

Run: `bun run build`
Expected: PASS — clean build with no errors or warnings

- [ ] **Step 2: Visual check**

Run: `bun run dev`

Verify in browser:
1. Enter a country's action menu, choose Move Troops or Influence
2. Diamond d-pad appears with value in center
3. Arrow keys ←/→ adjust by ±1, ↑/↓ adjust by ±10
4. Clicking diamond directions works with mouse
5. Holding a diamond repeats after delay
6. Diamonds at boundary are dimmed
7. Direction diamonds flash on press
8. Confirm/Back buttons still work
9. Controller button prompts show d-pad directions instead of old LB/RB labels

- [ ] **Step 3: Final commit if any tweaks needed**
