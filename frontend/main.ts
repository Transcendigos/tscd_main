// THIS IS ONE THE FRONT JS FILE
// Eventually we will have multiple of these (the game, the 3D scene etc)


//It is automatically transpiled into a .js by typescript when building the container (in Dockerfile.nginx, npx tsc)


// main.ts
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("clickMeBtn");
  const output = document.getElementById("output");

  btn?.addEventListener("click", () => {
    if (output) {
      output.textContent = "TypeScript is working!";
    }
  });
});
