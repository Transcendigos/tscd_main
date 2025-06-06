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
let aiWindow: DesktopWindow;
let musicWindow: DesktopWindow;

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

async function updateUIBasedOnAuth() {
  const isSignedIn = await checkSignedIn();

  if (isSignedIn) {
    assignOpenTrigger(profileWindow, "profileBtn", settingUserProfile);
    assignOpenTrigger(settingWindow, "settingTab", settingUserSetting);
    assignOpenTrigger(logoutWindow, "logoutTab");
    assignOpenTrigger(pongWindow, "clickMeBtn");
    assignOpenTrigger(chatWindow, "chatBtn");
    assignOpenTrigger(infoWindow, "infoTab");
    assignOpenTrigger(statsWindow, "statsTab");
    assignOpenTrigger(aiWindow, "aiBtn");
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
    if (multiplayerPongWindow && multiplayerPongWindow.isVisible()) {
        multiplayerPongWindow.close();
    }
    aiWindow.close();
    musicWindow.close();
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
    setupInfoWindow(weatherWindow);
  }
  catch (error) {
    console.error("Failed to initialize 'weatherWindow':", error);
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
      }
    });
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
    fetch("/ai_prompt.txt")
      .then(res => res.text())
      .then(text => {
        console.log("✅ Loaded system message");
        setupAIWindow(musicWindow, text);
      })
      .catch(err => {
        console.error("❌ Failed to load system message:", err);
        setupAIWindow(musicWindow, "You are a helpful assistant.");
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

