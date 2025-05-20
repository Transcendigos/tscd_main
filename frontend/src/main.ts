// THIS IS ONE THE FRONT JS FILE
// Eventually we will have multiple of these (the game, the 3D scene etc)


//It is automatically transpiled into a .js by typescript when building the container (in Dockerfile.nginx, npx tsc)


// src/main.ts
import { startPongGame, setCanvas } from "./pong.js"; // Your existing pong imports
import { DesktopWindow } from "./windows.js"; // Import the new class

window.addEventListener("DOMContentLoaded", () => {
  // --- Initialize the Menu Window ---
  try {
    const menuWindow = new DesktopWindow({
      windowId: 'dragWindow',             // The actual window element
      dragHandleId: 'dragHandle',
      resizeHandleId: 'resizeHandleBR',
      boundaryContainerId: 'menu',        // The container that provides bounds for drag/resize
      visibilityToggleId: 'menu',       // The element whose visibility is toggled (main 'menu' container)
      openTriggerId: 'menuShortcut',
      closeButtonId: 'closeMenuBtn',
      // showClasses and hideClasses are default, but can be overridden
      // minWindowWidth and minWindowHeight are default, but can be overridden
    });
    // If menuWindow.open() or .close() is used, it will toggle the '#menu' element.
  } catch (error) {
    console.error("Failed to initialize the menu window:", error);
  }

  // --- Example: Initializing a hypothetical Second Window (Chat) ---
  // First, you would need to add the HTML for this chat window, e.g.:
  // <div id="chatAppContainer" class="...some hide classes...">
  //   <div id="chatWindow" class="...actual window styles...">
  //     <div id="chatDragHandle">Drag Me</div>
  //     ... content ...
  //     <div id="chatResizeHandle"></div>
  //     <button id="closeChatBtn">X</button>
  //   </div>
  // </div>
  // <button id="openChatShortcut">Open Chat</button>

  /*
  try {
    const chatWindow = new DesktopWindow({
      windowId: 'chatWindow',
      dragHandleId: 'chatDragHandle',
      resizeHandleId: 'chatResizeHandle',
      boundaryContainerId: 'chatAppContainer', // Or perhaps 'body' or another global container
      visibilityToggleId: 'chatAppContainer',
      openTriggerId: 'openChatShortcut',
      closeButtonId: 'closeChatBtn',
      initialZIndex: 101 // Example for slightly higher initial z-index
    });
  } catch (error) {
    console.error("Failed to initialize the chat window:", error);
  }
  */


  // --- Pong Game Specific Logic (Remains mostly the same) ---
  const gameContainer = document.getElementById("gameContainer")!;
  const clickBtn = document.getElementById("clickMeBtn")!; // This is inside your 'dragWindow'
  const backBtn = document.getElementById("backBtn")!;
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;
  const menuContainer = document.getElementById("menu")!; // Still needed for pong logic that hides it

  // Default show/hide classes for pong game transition (if different from window)
  const gameShowClasses = ['opacity-100', 'scale-100', 'visible', 'pointer-events-auto'];
  const gameHideClasses = ['opacity-0', 'scale-10', 'invisible', 'pointer-events-none'];


  if (clickBtn && menuContainer && gameContainer && canvas) {
    clickBtn.addEventListener("click", () => {
      // Hide the menu container (which holds the menu window)
      menuContainer.classList.remove(...gameShowClasses); // Or use menuWindow.hideClasses
      menuContainer.classList.add(...gameHideClasses);
      
      gameContainer.classList.remove("hidden"); // Assuming "hidden" is your primary way to hide gameContainer
      setCanvas(canvas);
      startPongGame();
    });
  } else {
    console.error("One or more elements for Pong game setup are missing.");
    if (!clickBtn) console.error("clickMeBtn not found for Pong.");
    // Add more specific checks if needed
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // This logic might need adjustment depending on how you want to "go back"
      // For now, reload is simple.
      // You might want to hide gameContainer and show menuContainer (e.g., using menuWindow.open())
      location.reload(); 
    });
  }
});








