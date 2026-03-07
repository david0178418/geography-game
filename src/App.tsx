import { useEffect, useRef } from "react";
import { initGlobe } from "./rendering/index.ts";
import "./App.css";

function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const cleanup = initGlobe(canvas);
		return cleanup;
	}, []);

	return <canvas ref={canvasRef} className="globe-canvas" />;
}

export default App;
