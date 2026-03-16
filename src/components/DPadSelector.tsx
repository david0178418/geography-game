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
