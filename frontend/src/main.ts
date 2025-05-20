// THIS IS ONE THE FRONT JS FILE
// Eventually we will have multiple of these (the game, the 3D scene etc)


//It is automatically transpiled into a .js by typescript when building the container (in Dockerfile.nginx, npx tsc)


// main.ts
// src/main.ts
import { startPongGame, setCanvas } from "./pong.js";

window.addEventListener("DOMContentLoaded", () => {
  const gameContainer = document.getElementById("gameContainer")!;
  const clickBtn = document.getElementById("clickMeBtn")!;
  const backBtn = document.getElementById("backBtn")!;
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;
  
  const menuShortcut = document.getElementById("menuShortcut")!;
  const menuContainer = document.getElementById("menu")!; 
  const closeMenuBtn = document.getElementById('closeMenuBtn')!;

  const showClasses = ['opacity-100', 'scale-100', 'visible', 'pointer-events-auto'];
  const hideClasses = ['opacity-0', 'scale-10', 'invisible', 'pointer-events-none'];

  const initialDraggableWindowStyle = {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)'
  };

  if (menuShortcut && menuContainer) {
    menuShortcut.addEventListener('click', () => {
      menuContainer.classList.remove(...hideClasses);
      menuContainer.classList.add(...showClasses);
    });
  } else {
    if (!menuShortcut) console.error("Menu shortcut element not found!");
    if (!menuContainer) console.error("Menu container (id='menu') element not found!");
  }

  if (closeMenuBtn && menuContainer) {
    closeMenuBtn.addEventListener('click', () => {
      menuContainer.classList.remove(...showClasses);
      menuContainer.classList.add(...hideClasses);

      const windowToReset = document.getElementById('dragWindow');
      if (windowToReset) {
        windowToReset.style.left = initialDraggableWindowStyle.left;
        windowToReset.style.top = initialDraggableWindowStyle.top;
        windowToReset.style.transform = initialDraggableWindowStyle.transform;
      }
    });
  } else {
     if (menuContainer && !closeMenuBtn) console.warn("Close menu button not found inside the menu window.");
  }

  // Drag Logic
  const draggableWindow = document.getElementById('dragWindow')!; 
  const dragHandle = document.getElementById('dragHandle')!; 

  if (!draggableWindow || !dragHandle || !menuContainer) {
    if (!draggableWindow) console.error('Draggable window (id="dragWindow") not found.');
    if (!dragHandle) console.error('Drag handle (id="dragHandle") not found.');
    if (!menuContainer) console.error('Menu container (id="menu") for drag calculations not found.');
    return;
  }

  let isDragging = false;
  let initialMouseX: number; 
  let initialMouseY: number; 
  let startWindowX: number;
  let startWindowY: number;

  function dragMove(event: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    event.preventDefault(); 

    let currentMouseX, currentMouseY;
    if (event instanceof MouseEvent) {
      currentMouseX = event.clientX;
      currentMouseY = event.clientY;
    } else {
      currentMouseX = event.touches[0].clientX;
      currentMouseY = event.touches[0].clientY;
    }

    const deltaX = currentMouseX - initialMouseX;
    const deltaY = currentMouseY - initialMouseY;

    draggableWindow.style.left = `${startWindowX + deltaX}px`;
    draggableWindow.style.top = `${startWindowY + deltaY}px`;
  }

  const dragStart = (event: MouseEvent | TouchEvent) => {
    const windowRect = draggableWindow.getBoundingClientRect();
    const parentRect = menuContainer.getBoundingClientRect();

    const initialLeftRelativeToParent = windowRect.left - parentRect.left;
    const initialTopRelativeToParent = windowRect.top - parentRect.top;

    draggableWindow.style.transform = 'translate(0, 0)'; 
    draggableWindow.style.left = `${initialLeftRelativeToParent}px`;
    draggableWindow.style.top = `${initialTopRelativeToParent}px`;

    startWindowX = initialLeftRelativeToParent;
    startWindowY = initialTopRelativeToParent;

    if (event instanceof MouseEvent) {
      initialMouseX = event.clientX;
      initialMouseY = event.clientY;
    } else {
      initialMouseX = event.touches[0].clientX;
      initialMouseY = event.touches[0].clientY;
    }
    
    isDragging = true;
    dragHandle.style.cursor = 'grabbing';
    draggableWindow.style.willChange = 'left, top'; 

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  };

  const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    dragHandle.style.cursor = 'grab';
    draggableWindow.style.willChange = 'auto';

    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);
  };

  dragHandle.addEventListener('mousedown', dragStart);
  dragHandle.addEventListener('touchstart', dragStart, { passive: false });

  // -------------------------- Play Pong
  if (clickBtn && menuContainer && gameContainer && canvas) {
    clickBtn.addEventListener("click", () => {
      menuContainer.classList.remove(...showClasses);
      menuContainer.classList.add(...hideClasses);
      
      gameContainer.classList.remove("hidden");
      setCanvas(canvas);
      startPongGame();
    });
  } else {
    console.error("One or more elements for Pong game setup are missing.");
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      location.reload(); 
    });
  }
});
