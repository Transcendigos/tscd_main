import { SceneManager } from "./pong3D/sceneManager";

// This script runs as soon as the page loads
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    if (canvas) {
        // Immediately create and run the 3D scene
        SceneManager.create(canvas);
        console.log("3D development scene started.");
    }
});