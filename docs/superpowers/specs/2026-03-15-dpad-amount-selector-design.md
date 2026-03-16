# D-Pad Diamond Amount Selector

## Problem

The current amount selector in `settingAmount` mode uses an HTML range slider and ±1 stepper buttons. The slider is unusable with a controller (no way to drag it with a stick), and the steppers only move by 1, making large adjustments tedious. The whole interaction needs to feel native to a console controller.

## Solution

Replace the slider + stepper with a diamond-shaped d-pad visual where the value sits in the center and four directional indicators show available adjustments. D-pad/arrow directions map to different step sizes: left/right for ±1, up/down for ±10.

## Visual Design

Diamond layout with rotated square indicators at the four cardinal positions surrounding a circular center value:

- **Top diamond:** ▲ +10
- **Bottom diamond:** ▼ -10
- **Left diamond:** ◀ -1
- **Right diamond:** ▶ +1
- **Center circle:** Current value (large, bold)

Styling matches the existing control bar aesthetic: semi-transparent dark backgrounds (`rgba(30, 30, 50, 0.95)`), blue accent borders (`rgba(100, 180, 255, 0.6)`), and `#e0e0e0` text. On direction press, the corresponding diamond briefly pulses/glows to give feedback.

The component sits inline within the `.control-bar-actions` row alongside the Confirm and Back buttons. The action type label ("Move Troops" / "Spend Influence") remains above or beside it.

## Input Mapping

| Input | Action | Step |
|---|---|---|
| D-pad Up / Arrow Up | Increase | +10 |
| D-pad Down / Arrow Down | Decrease | -10 |
| D-pad Left / Arrow Left | Decrease | -1 |
| D-pad Right / Arrow Right | Increase | +1 |
| RB / `+`/`=` key | Increase | +1 |
| LB / `-` key | Decrease | -1 |

Value always clamped to `[1, maxAmount]`.

### Auto-Repeat

When a direction is held:
- **Initial delay:** 400ms before repeat begins
- **Repeat interval:** 100ms between subsequent adjustments
- These values are extracted as constants for easy tuning

### Input Action Changes

Currently, `NAVIGATE_UP`/`DOWN`/`LEFT`/`RIGHT` are used for menu and secondary selection navigation. In `settingAmount` mode, these same actions are repurposed:

- `NAVIGATE_UP` → +10
- `NAVIGATE_DOWN` → -10
- `NAVIGATE_LEFT` → -1
- `NAVIGATE_RIGHT` → +1

This requires no new `InputAction` values. The ControlBar already dispatches based on `interactionState.mode`, so the `NAVIGATE_*` handlers just need a `settingAmount` branch that calls `adjustAmount` with the appropriate delta.

`INCREMENT`/`DECREMENT` (bumpers, +/- keys) continue to map to ±1 as they do today.

## What Changes

### Removed
- `<input type="range">` slider from `settingAmount` render block
- `+`/`-` stepper buttons and `.amount-stepper` container
- `.amount-stepper` CSS rules (`.amount-stepper`, `.amount-stepper button`, `.amount-stepper button:hover`, `.amount-value`, touch media query for `.amount-stepper button`)
- `setAmount` import from ControlBar (no longer needed without the slider)

### New Component: `DPadSelector`

**File:** `src/components/DPadSelector.tsx`

```typescript
interface DPadSelectorProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onAdjust: (delta: number) => void;
}
```

Responsibilities:
- Renders the diamond visual (four directional indicators + center value)
- Handles mouse click on each diamond direction (calls `onAdjust` with appropriate delta)
- Manages auto-repeat timer: on pointerdown, starts a timeout (400ms), then an interval (100ms), both calling `onAdjust`; clears on pointerup/pointerleave
- Shows a brief CSS animation (glow/pulse) on the active direction when triggered by any input source
- Dims directional indicators when the value is at min or max in that direction (e.g., if value === max, dim the +1 and +10 diamonds)

The component does NOT handle keyboard/gamepad input directly. That stays in ControlBar via the existing `useInputAction` hooks, which call `onAdjust` through the parent.

To animate on keyboard/gamepad input, the parent passes an optional `activeDirection` prop (e.g., `'up' | 'down' | 'left' | 'right' | null`) derived from the most recent input action, cleared after a short timeout (~150ms).

### New CSS

**File:** `src/App.css` (appended to the control bar section)

- `.dpad-selector` — relative container, sized to hold the diamond layout
- `.dpad-diamond` — each directional indicator (rotated 45deg square)
- `.dpad-diamond.active` — glow animation on press
- `.dpad-diamond.disabled` — dimmed when at boundary
- `.dpad-center` — circular center value display
- Touch media query: increase diamond tap targets to 44px minimum

### ControlBar Changes

**File:** `src/components/ControlBar.tsx`

1. Replace the `settingAmount` render block (lines 364-384) with:
   - Action type label (unchanged)
   - `<DPadSelector value={amount} min={1} max={maxAmount} onAdjust={handleAdjust} activeDirection={activeDir} />`
   - Confirm button (unchanged)
   - Back button (unchanged)

2. Add `handleNavigateLeft` and `handleNavigateRight` callbacks, plus expand `handleNavigateUp`/`handleNavigateDown` to handle `settingAmount` mode:
   - `handleNavigateUp`: if `settingAmount`, call `adjustAmount(state, 10, 1, maxAmount)`
   - `handleNavigateDown`: if `settingAmount`, call `adjustAmount(state, -10, 1, maxAmount)`
   - `handleNavigateLeft`: if `settingAmount`, call `adjustAmount(state, -1, 1, maxAmount)`
   - `handleNavigateRight`: if `settingAmount`, call `adjustAmount(state, 1, 1, maxAmount)`

3. Register `useInputAction('NAVIGATE_LEFT', handleNavigateLeft)` and `useInputAction('NAVIGATE_RIGHT', handleNavigateRight)`.

4. Track `activeDirection` state for visual feedback: set on input action, clear after 150ms timeout.

5. Remove `setAmount` import (no longer needed).

## What Stays Unchanged

- `InteractionState` types and `adjustAmount`/`setAmount` functions in `interaction-state.ts`
- `InputAction` enum — no new actions needed
- Controller mappings — no changes needed
- All other interaction modes (idle, focusing, actionMenu, secondarySelection)
- Button prompts system
- Country selection mechanism

## Mouse/Touch Fallback

Mouse users can click the diamond directions directly. The pointerdown/up auto-repeat behavior gives them the same hold-to-adjust experience. The diamonds are large enough tap targets on touch (44px minimum via media query).
