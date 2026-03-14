# Interaction Rework Design

Rework the interaction flow from mouse-centric to controller-friendly. Separate country information display from action controls. Move all action UI to a unified bottom control bar. Introduce context-aware auto-skipping of decision steps when only one option exists.

## State Machine

Five interaction modes replace the current four:

| Mode | Description | Globe | Bottom Bar |
|---|---|---|---|
| `idle` | No country focused | Rotates freely | Turn info, End Turn |
| `focusing` | Browsing countries, info panel visible | Rotates freely | Turn info, End Turn, Select (if actionable) |
| `actionMenu` | Choosing which action to take | Locked | Action options (Move / Influence) |
| `settingAmount` | Setting troop/influence count | Locked | Amount stepper |
| `secondarySelection` | Picking target or source country | Locked | Navigation constrained to valid options |

### State Data

```typescript
type InteractionState =
  | { readonly mode: 'idle' }
  | { readonly mode: 'focusing'; readonly countryId: string }
  | {
      readonly mode: 'actionMenu';
      readonly countryId: string;
      readonly availableActions: ReadonlyArray<'move' | 'influence'>;
      readonly focusedIndex: number;
    }
  | {
      readonly mode: 'settingAmount';
      readonly countryId: string;
      readonly actionType: 'move' | 'influence';
      readonly amount: number;
      readonly sourceCountryId: string;
      readonly targetCountryId: string | null;
      readonly skippedActionMenu: boolean;
    }
  | {
      readonly mode: 'secondarySelection';
      readonly countryId: string;
      readonly actionType: 'move' | 'influence';
      readonly amount: number;
      readonly sourceCountryId: string | null;
      readonly targetCountryId: string | null;
      readonly role: 'target' | 'source';
      readonly validOptions: ReadonlyArray<string>;
      readonly focusedIndex: number;
    };
```

**Key fields:**
- `actionMenu.focusedIndex` — tracks which action is highlighted for NAVIGATE_UP/DOWN.
- `settingAmount.sourceCountryId` / `targetCountryId` — resolved eagerly when possible. When the player selects their own country, `sourceCountryId` is set and `targetCountryId` is null (to be resolved). When the player selects an adjacent non-owned country, `targetCountryId` is set; `sourceCountryId` is set if only one player territory is adjacent, otherwise resolved via `secondarySelection`.
- `settingAmount.skippedActionMenu` — tracks whether `actionMenu` was auto-skipped, so `goBack` knows to return to `focusing` instead of `actionMenu`.
- `secondarySelection.sourceCountryId` / `targetCountryId` — one is null (the one being resolved by the selection), the other is already known.

### Back Transitions

| From | Back goes to |
|---|---|
| `idle` | No-op |
| `focusing` (orders exist) | Remove most recent order, stay in `focusing` |
| `focusing` (no orders) | `idle`, deselect country |
| `actionMenu` | `focusing` |
| `settingAmount` | `actionMenu` (or `focusing` if menu was auto-skipped) |
| `secondarySelection` | `settingAmount` |

## Context Awareness & Auto-Skip Logic

The "assume when no choice exists" principle: skip any decision step that has exactly one option.

### Actionability

A country is actionable during `focusing` mode when it has at least one available action. Available actions are determined by:
- **Player-controlled country**: "move" if `availableTroops > 0`, "influence" if `availableBudget > 0` and at least one adjacent non-player country exists.
- **Adjacent to player-controlled country**: "move" (invasion) if any adjacent player country has `availableTroops > 0`, "influence" if `availableBudget > 0`.

If no actions pass these resource checks, the country is not actionable and the Select button does not appear.

### Order type: move vs attack

The existing `Order.type` includes `"attack"`. This is a resolution-time distinction, not a player decision. The player always issues `"move"` orders. When the turn resolves, moves into enemy territory are treated as attacks. The `actionType` in the interaction state is always `'move' | 'influence'`.

### Transition Flow on Select

```
Select pressed on actionable country
  -> Determine available actions
  -> 0 actions: do nothing
  -> 1 action: skip actionMenu, go to settingAmount
  -> 2+ actions: enter actionMenu

Amount confirmed
  -> Determine valid targets/sources
  -> If the selected country is the implied target
     (e.g., adjacent country selected for influence):
       action completes immediately
  -> If 1 other option: auto-select, action completes
  -> If 2+ options: enter secondarySelection
```

### Source vs Target Resolution

- **Adjacent non-owned country selected for influence**: target is that country, source is auto-determined (player's adjacent territory). If multiple player territories are adjacent, enter `secondarySelection` with `role: 'source'`.
- **Own country selected to move troops**: source is that country. If multiple adjacent targets exist, enter `secondarySelection` with `role: 'target'`. If only one adjacent, auto-select.

## Component Architecture

### CountryInfoPanel (replaces CountryCard)

Fixed position at top-left corner. Pure information display, no interactions:
- Country name, capital, controller
- Troops, stability
- Influence breakdown
- Regional blocs

Visible whenever a country is focused (any mode except `idle`). No `useGlobeProjection` — fixed position.

### ControlBar (replaces TurnControls + PromptBar)

Single unified bottom bar. Content is mode-aware:

| Mode | Content |
|---|---|
| `idle` | Turn counter, End Turn button, prompts |
| `focusing` | Turn counter, End Turn button, Select button (if actionable), prompts |
| `actionMenu` | Action option buttons (Move Troops, Influence), Back, prompts |
| `settingAmount` | Action type label, amount stepper + slider, Confirm/Back, prompts |
| `secondarySelection` | Label ("Select target"/"Select source"), valid options list with navigation, Confirm/Back, prompts |

Composed of sub-components for each mode's content. Owns all action-related input handling (CONFIRM, BACK, INCREMENT, DECREMENT, NAVIGATE_* for menus/lists).

### Removed Components

- `CountryCard` — replaced by `CountryInfoPanel`
- `TurnControls` — absorbed into `ControlBar`
- `PromptBar` — absorbed into `ControlBar`
- `useGlobeProjection` hook — no longer needed

## Input Handling & Globe Locking

When mode exits `idle` or `focusing`, globe rotation, zoom, and country navigation are disabled.

### Input Routing

| Mode | GlobeInputHandler | ControlBar |
|---|---|---|
| `idle` | Navigation, rotation, zoom, CONFIRM (focus center) | END_TURN |
| `focusing` | Navigation, rotation, zoom | CONFIRM (select), BACK (undo/deselect), END_TURN |
| `actionMenu` | Nothing | NAVIGATE_UP/DOWN, CONFIRM, BACK |
| `settingAmount` | Nothing | INCREMENT/DECREMENT, CONFIRM, BACK |
| `secondarySelection` | Nothing | NAVIGATE_UP/DOWN, CONFIRM, BACK |

### Continuous Polling Guards

The `GlobeInputHandler` rAF loop checks current mode and skips analog rotation, zoom, and keyboard rotation when mode is not `idle` or `focusing`. Edge-triggered ROTATE_*/ZOOM_* actions have the same guard.

## Order Undo Stack

Orders stored in `Map<orderId, Order>` (JavaScript Map preserves insertion order).

Back in `focusing` mode:
1. Get last order globally: `[...pendingOrders.values()].at(-1)`
2. If exists: remove it, stay in `focusing`
3. If no orders: deselect country, return to `idle`

The undo is global (not per-country). The most recently issued order is removed regardless of which country the player is currently viewing. This matches a "undo last action" mental model.

The `CANCEL_ORDER` input action is removed — back in focusing mode replaces it.

A `popLastOrder` helper is added to `orders.ts`.

## File Changes

| File | Change |
|---|---|
| `src/ecs/interaction-state.ts` | Rewrite: 5 modes, new transition functions with auto-skip logic |
| `src/components/CountryCard.tsx` | Replace with `CountryInfoPanel` — pure info, fixed top-left, no input handling |
| `src/components/ControlBar.tsx` | New, replaces `TurnControls` and `PromptBar`. Mode-specific sub-components, all action input handling |
| `src/components/GlobeInputHandler.tsx` | Add globe lock guards for rotation/zoom when not in `idle`/`focusing` |
| `src/components/TurnControls.tsx` | Delete — absorbed into ControlBar |
| `src/components/PromptBar.tsx` | Delete — absorbed into ControlBar |
| `src/hooks/useContextualPrompts.ts` | Update prompts for 5 new modes |
| `src/hooks/useGlobeProjection.ts` | Delete — no longer needed |
| `src/input/input-types.ts` | Remove `CANCEL_ORDER` action |
| `src/input/controller-mappings.ts` | Remove `CANCEL_ORDER` mappings |
| `src/components/button-prompts/button-glyph-map.ts` | Remove `CANCEL_ORDER` glyph entries |
| `src/ecs/orders.ts` | Add `popLastOrder` helper |
| `src/App.tsx` | Replace `CountryCard` + `TurnControls` + `PromptBar` with `CountryInfoPanel` + `ControlBar` |
| `src/App.css` | Replace `.country-card` with `.country-info-panel` (top-left fixed). Add `.control-bar`. Remove old action/target styles |
