// frontend/src/main.ts
import { startPongGame, setCanvas, stopPongGame } from "./pong.js";
import { DesktopWindow } from "./DesktopWindow.js";
import { checkSignedIn, setupSignupForm } from "./sign_up.js";
import { initGoogleSignIn } from "./google_auth.js";
import { setupLogoutForm } from "./logout.js";
import { setupSigninForm } from "./sign_in.js";
import { setupSettingForm } from "./setting.js";
import { setupInfoWindow } from "./infowindow.ts";
import { settingUserProfile, settingUserSetting } from "./profile.ts";
import { setupAIWindow } from "./aiassistant.ts";
import { setupSpotifySearch } from './music.ts';
import { initializeChatSystem, resetChatSystem, sendPongPlayerInput, sendPongPlayerReady } from "./chatClient.js";
import {
  initMultiplayerPong,
  updateMultiplayerGameState,
  handleMultiplayerGameOver,
  cleanupMultiplayerPong
} from './multiplayer_pong.js';


// For Solo AI Pong
import { 
    startPongGame as startAIPong, 
    setCanvas as setAIPongCanvas, 
    stopPongGame as stopAIPong 
} from "./pong.js";

// For Remote Multiplayer Server Sided Pong 
import { 
    startPongGame as startMultiplayerPong, 
    setCanvas as setMultiplayerPongCanvas, 
    stopPongGame as stopMultiplayerPong 
} from "./client_pong.ts";

// For Local multiplayer Pong
import {
    startPongGame as startLocalMultiplayerPong,
    setCanvas as setLocalMultiplayerPongCanvas,
    stopPongGame as stopLocalMultiplayerPong
} from "./localmultipong.js";

let signinWindow: DesktopWindow;
let signupWindow: DesktopWindow;
let logoutWindow: DesktopWindow;
let profileWindow: DesktopWindow;
let settingWindow: DesktopWindow;
let pongWindow: DesktopWindow;
let multiplayerPongWindow: DesktopWindow;
let chatWindow: DesktopWindow;
let statsWindow: DesktopWindow;
let infoWindow: DesktopWindow;
let weatherWindow: DesktopWindow;
let grafanaWindow: DesktopWindow;
let commandWindow: DesktopWindow;
let aboutWindow: DesktopWindow;
let aiWindow: DesktopWindow;
let musicWindow: DesktopWindow;

let activePongMode: 'solo' | 'multiplayer' | 'localMultiplayer' | null = null;
let currentPongStopFunction: (() => void) | null = null;

// Utility functions
function assignOpenTrigger(windowInstance: DesktopWindow, triggerId: string, onOpenCallback?: () => void) {
  const trigger = document.getElementById(triggerId);
  if (trigger) {
    trigger.addEventListener("click", () => {
      windowInstance.open();
      if (typeof onOpenCallback === 'function') {
        onOpenCallback();
      }
    });
    trigger.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
    trigger.classList.add("hover-important", "cursor-default");
  }
}

function disableTrigger(triggerId: string) {
  const el = document.getElementById(triggerId);
  if (el) {
    el.classList.add("opacity-50", "cursor-not-allowed", "select-none");
    el.classList.remove("hover-important", "cursor-default");
    const clone = el.cloneNode(true);
    el.parentNode?.replaceChild(clone, el);
  }
}


function playPongSolo() {
  const gameContainer = document.getElementById("gameContainer")!;
  const clickMeBtn = document.getElementById("clickMeBtn")!;
  const soloPongCanvasElement = document.getElementById("pongCanvas") as HTMLCanvasElement;

  if (clickMeBtn && gameContainer && soloPongCanvasElement) {
    clickMeBtn.addEventListener("click", () => {
      if (multiplayerPongWindow && multiplayerPongWindow.isVisible()) {
        multiplayerPongWindow.close();
      }
      cleanupMultiplayerPong();
      if (pongWindow && pongWindow.isVisible()) {
        return;
      } else if (pongWindow && !pongWindow.isVisible()) {
        pongWindow.open();
        setCanvas(soloPongCanvasElement);
        startPongGame();
      } else {
        setCanvas(soloPongCanvasElement);
        startPongGame();
      }
    });
  } else {
    console.error("One or more elements for SOLO Pong game setup are missing.");
  }
}


async function updateUIBasedOnAuth() {
  const isSignedIn = await checkSignedIn();

  if (isSignedIn) {
    assignOpenTrigger(profileWindow, "profileBtn", settingUserProfile);
    assignOpenTrigger(settingWindow, "settingTab", settingUserSetting);
    assignOpenTrigger(logoutWindow, "logoutTab");
    assignOpenTrigger(pongWindow, "clickMeBtn", startPongGame);
    assignOpenTrigger(chatWindow, "chatBtn");
    assignOpenTrigger(infoWindow, "infoTab");
    assignOpenTrigger(statsWindow, "statsTab");
    assignOpenTrigger(aiWindow, "aiBtn", commandWindow.open);
    assignOpenTrigger(musicWindow, "musicBtn");
    assignOpenTrigger(weatherWindow, "openWeatherBtn");

    initializeChatSystem();

    disableTrigger("signinTab");
    disableTrigger("signupTab");
  }
  else {
    assignOpenTrigger(signinWindow, "signinTab");
    (window as any).resetSigninForm?.();
    assignOpenTrigger(signupWindow, "signupTab");
    (window as any).resetSignupForm?.();
    disableTrigger("profileBtn");
    disableTrigger("settingTab");
    disableTrigger("logoutTab");
    disableTrigger("clickMeBtn");
    disableTrigger("chatBtn");
    disableTrigger("infoTab");
    disableTrigger("statsTab");
    disableTrigger("aiBtn");
    disableTrigger("musicBtn");
    weatherWindow.close();
    settingWindow.close();
    infoWindow.close();
    profileWindow.close();
    logoutWindow.close();
    statsWindow.close();
    chatWindow.close();
    pongWindow.close();
    aiWindow.close();
    grafanaWindow.close();
    musicWindow.close();
    aboutWindow.close();
    if (multiplayerPongWindow && multiplayerPongWindow.isVisible()) {
      multiplayerPongWindow.close();
    }
    if (typeof resetChatSystem === 'function') {
      resetChatSystem();
    }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const defaultShowClasses = [
    "opacity-100",
    "scale-100",
    "visible",
    "pointer-events-auto",
  ];
  const defaultHideClasses = [
    "opacity-0",
    "scale-95",
    "invisible",
    "pointer-events-none",
  ];

  // --- Menu Window ---

  try {
    const menuWindow = new DesktopWindow({
      windowId: "dragWindow",
      dragHandleId: "dragHandle",
      resizeHandleId: "menuResize",
      boundaryContainerId: "main",
      visibilityToggleId: "dragWindow",
      openTriggerId: "menuShortcut",
      closeButtonId: "closeMenuBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the menu window:", error);
  }


  // --- Sign in Window ---

  try {
    signinWindow = new DesktopWindow({
      windowId: "signinWindow",
      dragHandleId: "signinDragHandle",
      resizeHandleId: "signinResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "signinWindow",
      closeButtonId: "closesigninBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
    setupSigninForm(signinWindow);
  } catch (error) {
    console.error("Failed to initialize the signin window:", error);
  }

  // --- Sign Up Window ---

  try {
    signupWindow = new DesktopWindow({
      windowId: "signupWindow",
      dragHandleId: "signupDragHandle",
      resizeHandleId: "signupResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "signupWindow",
      closeButtonId: "closeSignupBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
    setupSignupForm(signupWindow);
  } catch (error) {
    console.error("Failed to initialize the signup window:", error);
  }

  // --- Log Out Window ---

  try {
    logoutWindow = new DesktopWindow({
      windowId: "logoutWindow",
      dragHandleId: "logoutDragHandle",
      resizeHandleId: "logoutResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "logoutWindow",
      closeButtonId: "closelogoutBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
    setupLogoutForm(logoutWindow);

  } catch (error) {
    console.error("Failed to initialize 'logoutWindow':", error);
  }

  // --- Settings Window ---

  try {
    settingWindow = new DesktopWindow({
      windowId: "settingWindow",
      dragHandleId: "settingDragHandle",
      resizeHandleId: "settingResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "settingWindow",
      closeButtonId: "closesettingBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'settingWindow':", error);
  }


  // --- Profile Window ---

  try {
    profileWindow = new DesktopWindow({
      windowId: "profileWindow",
      dragHandleId: "profileDragHandle",
      resizeHandleId: "profileResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "profileWindow",
      closeButtonId: "closeprofileBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'profileWindow':", error);
  }


  // --- Info Window ---

  try {
    infoWindow = new DesktopWindow({
      windowId: "infoWindow",
      dragHandleId: "infoDragHandle",
      resizeHandleId: "infoResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "infoWindow",
      closeButtonId: "closeinfoBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'infoWindow':", error);
  }


  // --- Weather Window ---

  try {
    weatherWindow = new DesktopWindow({
      windowId: "weatherWindow",
      dragHandleId: "weatherDragHandle",
      resizeHandleId: "weatherResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "weatherWindow",
      closeButtonId: "closeweatherBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  }
  catch (error) {
    console.error("Failed to initialize 'weatherWindow':", error);
  }

  // --- Grafana Window ---

  try {
    grafanaWindow = new DesktopWindow({
      windowId: "grafanaWindow",
      dragHandleId: "grafanaDragHandle",
      resizeHandleId: "grafanaResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "grafanaWindow",
      closeButtonId: "closegrafanaBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  }
  catch (error) {
    console.error("Failed to initialize 'grafanaWindow':", error);
  }

  // --- COMMAND Window ---

  try {
    commandWindow = new DesktopWindow({
      windowId: "commandWindow",
      dragHandleId: "commandDragHandle",
      resizeHandleId: "commandResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "commandWindow",
      closeButtonId: "closecommandBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  }
  catch (error) {
    console.error("Failed to initialize 'commandWindow':", error);
  }

  // --- ABOUT Window ---

  try {
    aboutWindow = new DesktopWindow({
      windowId: "aboutWindow",
      dragHandleId: "aboutDragHandle",
      resizeHandleId: "aboutResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "aboutWindow",
      closeButtonId: "closeaboutBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  }
  catch (error) {
    console.error("Failed to initialize 'aboutWindow':", error);
  }

  // --- Stats Window ---

  try {
    statsWindow = new DesktopWindow({
      windowId: "statsWindow",
      dragHandleId: "statsDragHandle",
      resizeHandleId: "statsResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "statsWindow",
      closeButtonId: "closestatsBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'statsWindow':", error);
  }

  // --- Pong Window ---

  try {
    pongWindow = new DesktopWindow({
      windowId: "pongWindow",
      dragHandleId: "pongDragHandle",
      resizeHandleId: "pongResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "pongWindow",
      closeButtonId: "closepongBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
      onCloseCallback: () => {
        stopPongGame();
      },
    });
    playPongSolo();
  } catch (error) {
    console.error("Failed to initialize the solo pong window:", error);
  }

  // --- Pong Multi Window ---

  try {
    multiplayerPongWindow = new DesktopWindow({
      windowId: "multiplayerPongWindow",
      dragHandleId: "multiplayerPongDragHandle",
      resizeHandleId: "multiplayerPongResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "multiplayerPongWindow",
      closeButtonId: "closeMultiplayerPongBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
      onCloseCallback: () => {
        cleanupMultiplayerPong();
      }
    });
  } catch (error) {
    console.error("Failed to initialize the multiplayer pong window:", error);
  }

  // --- Chat Window ---

  try {
    chatWindow = new DesktopWindow({
      windowId: "chatWindow",
      dragHandleId: "chatDragHandle",
      resizeHandleId: "chatResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "chatWindow",
      closeButtonId: "closeChatBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the chat window:", error);
  }

  // --- AI Window ---

  try {
    aiWindow = new DesktopWindow({
      windowId: "aiWindow",
      dragHandleId: "aiDragHandle",
      resizeHandleId: "aiResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "aiWindow",
      closeButtonId: "closeaiBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the ai window:", error);
  }

  // --- Music Window ---
  try {
    musicWindow = new DesktopWindow({
      windowId: "musicWindow",
      dragHandleId: "musicDragHandle",
      resizeHandleId: "musicResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "musicWindow",
      closeButtonId: "closemusicBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
    setupSpotifySearch();
  } catch (error) {
    console.error("Failed to initialize the music window:", error);
  }

    // --- Pong Game Specific Logic ---
  const gameContainer = document.getElementById("gameContainer")!; // Ensure it exists
  const clickSoloBtn = document.getElementById("clickMeBtn")!; //solo vs IA button
  const clickMultiBtn = document.getElementById("darkBtn"); // remote multi button (server side)
  const clickLocalbtn = document.getElementById("localbutton"); //local multi button 
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;

  if (!gameContainer || !canvas) {
    console.error("Pong gameContainer or canvas element is missing from the DOM.");
    return; // Exit if essential elements are not found
  }


  // Solo AI Pong Button bellow
  if (clickSoloBtn) {
    clickSoloBtn.addEventListener("click", () => {
      console.log("Solo Pong button clicked.");
      if (pongWindow.isVisible() && activePongMode === 'solo') {
        console.log("Solo Pong is already running and window is visible.");
        return; // Already in this mode and window is open
      }

      if (currentPongStopFunction) {
        console.log(`Switching from ${activePongMode} to solo. Stopping previous mode.`);
        currentPongStopFunction(); // Stop any other active pong game
      }
      
      if (!pongWindow.isVisible()) {
        pongWindow.open();
      }
      
      console.log("Setting up and starting AI Pong.");
      setAIPongCanvas(canvas); // Use aliased function for AI Pong
      startAIPong();           // Use aliased function for AI Pong
      
      activePongMode = 'solo';
      currentPongStopFunction = stopAIPong; // Set the correct stop function
    });
  } else {
    console.error("Solo Pong button ('clickMeBtn') not found.");
  }


  // Remote server side multiplayer bellow 
  if (clickMultiBtn) {
    clickMultiBtn.addEventListener("click", () => {
      console.log("Multiplayer Pong button clicked.");
      if (pongWindow.isVisible() && activePongMode === 'multiplayer') {
        console.log("Multiplayer Pong is already running and window is visible.");
        return; // Already in this mode and window is open
      }

      if (currentPongStopFunction) {
        console.log(`Switching from ${activePongMode} to multiplayer. Stopping previous mode.`);
        currentPongStopFunction(); // Stop any other active pong game
      }

      if (!pongWindow.isVisible()) {
        pongWindow.open();
      }
      
      console.log("Setting up and starting Multiplayer Pong.");
      setMultiplayerPongCanvas(canvas); // Use aliased function for Multiplayer Pong
      startMultiplayerPong();           // Use aliased function for Multiplayer Pong (handles connection)
      
      activePongMode = 'multiplayer';
      currentPongStopFunction = stopMultiplayerPong; // Set the correct stop function
    });
  } else {
    console.error("Multiplayer Pong button ('darkBtn') not found.");
  }

  // Local Multiplayer Pong Button
  if (clickLocalbtn) {
    clickLocalbtn.addEventListener("click", () => {
      console.log("Local Multiplayer Pong button clicked.");
      if (activePongMode === 'localMultiplayer' && pongWindow.isVisible()) {
        console.log("Local Multiplayer Pong is already running and window is visible.");
        return;
      }

      if (currentPongStopFunction) {
        console.log(`Switching from ${activePongMode} to local multiplayer. Stopping previous mode.`);
        currentPongStopFunction();
      }

      if (!pongWindow.isVisible()) {
        pongWindow.open();
      }

      console.log("Setting up and starting Local Multiplayer Pong.");
      setLocalMultiplayerPongCanvas(canvas); // Use aliased function for Local Multiplayer Pong
      startLocalMultiplayerPong();           // Use aliased function for Local Multiplayer Pong

      activePongMode = 'localMultiplayer';
      currentPongStopFunction = stopLocalMultiplayerPong; // Set the correct stop function
    });
  } else {
    console.error("Local Multiplayer Pong button ('localbutton') not found.");
  }

  await updateUIBasedOnAuth();
  window.addEventListener("auth:updated", updateUIBasedOnAuth);

  const multiplayerPongCanvasElement = document.getElementById('multiplayerPongCanvas') as HTMLCanvasElement;

  window.addEventListener('pongGameStart', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { gameId, initialState, yourPlayerId, opponentId, opponentUsername } = customEvent.detail;

    if (multiplayerPongCanvasElement && multiplayerPongWindow) {
      if (pongWindow && pongWindow.isVisible()) {
        pongWindow.close();
      }
      stopPongGame();
      multiplayerPongWindow.open();
      initMultiplayerPong(
        gameId,
        initialState,
        yourPlayerId,
        opponentId,
        opponentUsername,
        multiplayerPongCanvasElement,
        sendPongPlayerInput,
        sendPongPlayerReady
      );
    } else {
      console.error("Multiplayer Pong canvas or window not found for game start.");
    }
  });

  window.addEventListener('pongGameStateUpdate', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { gameId, ball, players, status } = customEvent.detail;
    updateMultiplayerGameState(ball, players, status);
  });

  window.addEventListener('pongGameOver', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { gameId, winnerId, scores } = customEvent.detail;
    handleMultiplayerGameOver(winnerId, scores);
  });

  initGoogleSignIn();
  settingUserProfile();
  setupSettingForm(settingWindow);
  setupInfoWindow(weatherWindow, grafanaWindow, commandWindow, aboutWindow);

  fetch("/ai_prompt.txt")
    .then(res => res.text())
    .then(text => {
      console.log("✅ Loaded system message");
      setupAIWindow(musicWindow, text);
    })
    .catch(err => {
      console.error("❌ Failed to load system message:", err);
    });

});


// ----------------WINDOW TEMPLATE----------------

// try {
//   const myNewWindow = new DesktopWindow({
//     windowId: "PREFIXWindow",
//     dragHandleId: "PREFIXDragHandle",
//     resizeHandleId: "PREFIXResizeHandle",
//     boundaryContainerId: "main",
//     visibilityToggleId: "PREFIXWindow",
//     openTriggerId: "spawner",
//     closeButtonId: "closePREFIXBtn",
//   });
// } catch (error) {
//   console.error("Failed to initialize 'PREFIXWindow':", error);
// }



// WEBCAM FUNCTION TO BE TESTED LATER
// const startTestWebcamButton = document.getElementById('startTestWebcamBtn'); // Assuming this ID exists
//   if (startTestWebcamButton) {
//       startTestWebcamButton.addEventListener('click', async () => {
//           console.log("Start Test Webcam button clicked.");
//           // Make sure the 'testWindow' is open and its video elements are in the DOM
//           const stream = await startWebcamFeed('testWebcamVideo', 'testWebcamError');
//           if (stream) {
//               // You might want to associate this stream with the testWindow instance
//               // so you can stop it when the testWindow is closed.
//               // e.g., testWindowInstance.setActiveStream(stream);
//           }
//       });
//     }

