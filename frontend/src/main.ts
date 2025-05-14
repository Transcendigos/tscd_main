// THIS IS ONE THE FRONT JS FILE
// Eventually we will have multiple of these (the game, the 3D scene etc)


//It is automatically transpiled into a .js by typescript when building the container (in Dockerfile.nginx, npx tsc)


// main.ts
import { startPongGame, setCanvas } from "./pong.js";

window.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("menu")!;
  const gameContainer = document.getElementById("gameContainer")!;
  const clickBtn = document.getElementById("clickMeBtn")!;
  const backBtn = document.getElementById("backBtn")!;
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;

  clickBtn.addEventListener("click", () => {
    menu.classList.add("hidden");
    gameContainer.classList.remove("hidden");
    setCanvas(canvas); // give your game the canvas
    startPongGame();   // and launch it
  });

  backBtn.addEventListener("click", () => {
    location.reload(); // simplest way to stop the game and reset everything
  });
});