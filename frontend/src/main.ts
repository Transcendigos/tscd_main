// frontend/src/main.ts
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
import { initializeChatSystem, resetChatSystem, sendPongPlayerInput, sendPongPlayerReady, sendPongLeaveGame } from "./chatClient.js";
import {
  initMultiplayerPong,
  updateMultiplayerGameState,
  handleMultiplayerGameOver,
  cleanupMultiplayerPong
} from './multiplayer_pong.js';
import { SceneManager } from "./pong3D/sceneManager.js";

// Import all pong versions
import { startPongGame as startAIPong, setCanvas as setAIPongCanvas, stopPongGame as stopAIPong } from "./pong.js";
import { startPongGame as startRemotePong, setCanvas as setRemotePongCanvas, stopPongGame as stopRemotePong } from "./client_pong.ts";
import { startPongGame as startLocalPong, setCanvas as setLocalPongCanvas, stopPongGame as stopLocalPong } from "./localmultipong.js";


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
let sceneManager: SceneManager | null = null;
let activeRemoteGameId: string | null = null;

// --- State Management for Games ---
let activePongMode: 'solo_3d' | 'remote_2d' | 'local_2d' | null = null;
let stopCurrentGame: (() => void) | null = null;


// --- Utility Functions ---
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

function stopAnyActiveGame() {
    if (stopCurrentGame) {
        console.log(`Stopping active game mode: ${activePongMode}`);
        stopCurrentGame();
        stopCurrentGame = null;
        activePongMode = null;
    }
}


function changeTheme(color1: string, color2: string) {
    document.body.style.backgroundImage = `
        repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 2px, transparent 2px, transparent 4px),
        linear-gradient(to bottom, ${color1} 0%, ${color2} 50%, ${color1} 100%)
    `;
}



async function updateUIBasedOnAuth() {
  const isSignedIn = await checkSignedIn();

  if (isSignedIn) {
    assignOpenTrigger(profileWindow, "profileBtn", settingUserProfile);
    assignOpenTrigger(settingWindow, "settingTab", settingUserSetting);
    assignOpenTrigger(logoutWindow, "logoutTab");
    
    // --- Enable Game Buttons ---
    document.getElementById("clickMeBtn")?.classList.remove("opacity-50", "cursor-not-allowed");
    document.getElementById("darkBtn")?.classList.remove("opacity-50", "cursor-not-allowed");
    document.getElementById("tournamentBtn")?.classList.remove("opacity-50", "cursor-not-allowed");

    assignOpenTrigger(chatWindow, "chatBtn");
    assignOpenTrigger(infoWindow, "infoTab");
    assignOpenTrigger(statsWindow, "statsTab");
    assignOpenTrigger(aiWindow, "aiBtn", commandWindow.open);
    assignOpenTrigger(musicWindow, "musicBtn");

    initializeChatSystem();

    disableTrigger("signinTab");
    disableTrigger("signupTab");
  }
  else {
    assignOpenTrigger(signinWindow, "signinTab", () => (window as any).resetSigninForm?.());
    assignOpenTrigger(signupWindow, "signupTab", () => (window as any).resetSignupForm?.());

    disableTrigger("profileBtn");
    disableTrigger("settingTab");
    disableTrigger("logoutTab");
    
    // --- Disable Game Buttons ---
    document.getElementById("clickMeBtn")?.classList.add("opacity-50", "cursor-not-allowed");
    document.getElementById("darkBtn")?.classList.add("opacity-50", "cursor-not-allowed");
    document.getElementById("tournamentBtn")?.classList.add("opacity-50", "cursor-not-allowed");

    disableTrigger("chatBtn");
    disableTrigger("infoWindow");
    disableTrigger("statsTab");
    disableTrigger("aiBtn");
    disableTrigger("musicBtn");

    // Close all windows on logout
    [
        weatherWindow, settingWindow, infoWindow, profileWindow, logoutWindow, statsWindow,
        chatWindow, pongWindow, aiWindow, grafanaWindow, musicWindow, aboutWindow, multiplayerPongWindow
    ].forEach(win => win?.close());
    
    if (typeof resetChatSystem === 'function') {
      resetChatSystem();
    }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
    const defaultShowClasses = ["opacity-100", "scale-100", "visible", "pointer-events-auto"];
    const defaultHideClasses = ["opacity-0", "scale-95", "invisible", "pointer-events-none"];

  // --- Initialize all windows ---
    try { new DesktopWindow({ windowId: "dragWindow", dragHandleId: "dragHandle", resizeHandleId: "menuResize", boundaryContainerId: "main", visibilityToggleId: "dragWindow", openTriggerId: "menuShortcut", closeButtonId: "closeMenuBtn" }); } catch (e) { console.error("Menu init failed:", e); }
    try { signinWindow = new DesktopWindow({ windowId: "signinWindow", dragHandleId: "signinDragHandle", resizeHandleId: "signinResizeHandle", boundaryContainerId: "main", visibilityToggleId: "signinWindow", closeButtonId: "closesigninBtn" }); setupSigninForm(signinWindow); } catch (e) { console.error("Signin init failed:", e); }
    try { signupWindow = new DesktopWindow({ windowId: "signupWindow", dragHandleId: "signupDragHandle", resizeHandleId: "signupResizeHandle", boundaryContainerId: "main", visibilityToggleId: "signupWindow", closeButtonId: "closeSignupBtn" }); setupSignupForm(signupWindow); } catch (e) { console.error("Signup init failed:", e); }
    try { logoutWindow = new DesktopWindow({ windowId: "logoutWindow", dragHandleId: "logoutDragHandle", resizeHandleId: "logoutResizeHandle", boundaryContainerId: "main", visibilityToggleId: "logoutWindow", closeButtonId: "closelogoutBtn" }); setupLogoutForm(logoutWindow); } catch (e) { console.error("Logout init failed:", e); }
    try { settingWindow = new DesktopWindow({ windowId: "settingWindow", dragHandleId: "settingDragHandle", resizeHandleId: "settingResizeHandle", boundaryContainerId: "main", visibilityToggleId: "settingWindow", closeButtonId: "closesettingBtn" }); } catch (e) { console.error("Settings init failed:", e); }
    try { profileWindow = new DesktopWindow({ windowId: "profileWindow", dragHandleId: "profileDragHandle", resizeHandleId: "profileResizeHandle", boundaryContainerId: "main", visibilityToggleId: "profileWindow", closeButtonId: "closeprofileBtn" }); } catch (e) { console.error("Profile init failed:", e); }
    try { infoWindow = new DesktopWindow({ windowId: "infoWindow", dragHandleId: "infoDragHandle", resizeHandleId: "infoResizeHandle", boundaryContainerId: "main", visibilityToggleId: "infoWindow", closeButtonId: "closeinfoBtn" }); } catch (e) { console.error("Info init failed:", e); }
    try { weatherWindow = new DesktopWindow({ windowId: "weatherWindow", dragHandleId: "weatherDragHandle", resizeHandleId: "weatherResizeHandle", boundaryContainerId: "main", visibilityToggleId: "weatherWindow", closeButtonId: "closeweatherBtn" }); } catch(e) { console.error("Weather init failed:", e); }
    try { grafanaWindow = new DesktopWindow({ windowId: "grafanaWindow", dragHandleId: "grafanaDragHandle", resizeHandleId: "grafanaResizeHandle", boundaryContainerId: "main", visibilityToggleId: "grafanaWindow", closeButtonId: "closegrafanaBtn" }); } catch(e) { console.error("Grafana init failed:", e); }
    try { commandWindow = new DesktopWindow({ windowId: "commandWindow", dragHandleId: "commandDragHandle", resizeHandleId: "commandResizeHandle", boundaryContainerId: "main", visibilityToggleId: "commandWindow", closeButtonId: "closecommandBtn" }); } catch(e) { console.error("Command init failed:", e); }
    try { aboutWindow = new DesktopWindow({ windowId: "aboutWindow", dragHandleId: "aboutDragHandle", resizeHandleId: "aboutResizeHandle", boundaryContainerId: "main", visibilityToggleId: "aboutWindow", closeButtonId: "closeaboutBtn" }); } catch(e) { console.error("About init failed:", e); }
    try { statsWindow = new DesktopWindow({ windowId: "statsWindow", dragHandleId: "statsDragHandle", resizeHandleId: "statsResizeHandle", boundaryContainerId: "main", visibilityToggleId: "statsWindow", closeButtonId: "closestatsBtn" }); } catch (e) { console.error("Stats init failed:", e); }
    try { chatWindow = new DesktopWindow({ windowId: "chatWindow", dragHandleId: "chatDragHandle", resizeHandleId: "chatResizeHandle", boundaryContainerId: "main", visibilityToggleId: "chatWindow", closeButtonId: "closeChatBtn" }); } catch (e) { console.error("Chat init failed:", e); }
    try { aiWindow = new DesktopWindow({ windowId: "aiWindow", dragHandleId: "aiDragHandle", resizeHandleId: "aiResizeHandle", boundaryContainerId: "main", visibilityToggleId: "aiWindow", closeButtonId: "closeaiBtn" }); } catch (e) { console.error("AI init failed:", e); }
    try { musicWindow = new DesktopWindow({ windowId: "musicWindow", dragHandleId: "musicDragHandle", resizeHandleId: "musicResizeHandle", boundaryContainerId: "main", visibilityToggleId: "musicWindow", closeButtonId: "closemusicBtn" }); setupSpotifySearch(); } catch (e) { console.error("Music init failed:", e); }

    // --- PONG WINDOWS ---
    try {
        pongWindow = new DesktopWindow({
            windowId: "pongWindow", dragHandleId: "pongDragHandle", resizeHandleId: "pongResizeHandle",
            boundaryContainerId: "main", visibilityToggleId: "pongWindow", closeButtonId: "closepongBtn",
            onCloseCallback: () => stopAnyActiveGame() // Generic cleanup
        });
        multiplayerPongWindow = new DesktopWindow({
            windowId: "multiplayerPongWindow", dragHandleId: "multiplayerPongDragHandle", resizeHandleId: "multiplayerPongResizeHandle",
            boundaryContainerId: "main", visibilityToggleId: "multiplayerPongWindow", closeButtonId: "closeMultiplayerPongBtn",
            onCloseCallback: () => {
              if (activePongMode === 'remote_2d' && activeRemoteGameId) {
                sendPongLeaveGame(activeRemoteGameId);
            }
              stopAnyActiveGame()}
        });
    } catch (e) { console.error("Pong windows init failed:", e); }

    // --- Define Canvases ---
    const soloPongCanvas = document.getElementById("pongCanvas") as HTMLCanvasElement;
    const multiPongCanvas = document.getElementById('multiplayerPongCanvas') as HTMLCanvasElement;

    // --- Event Listeners for Game Buttons ---

    // 1. SOLO 3D PONG
    document.getElementById("clickMeBtn")?.addEventListener("click", async () => {
        stopAnyActiveGame();
        multiplayerPongWindow.close();
        pongWindow.open();
        
        activePongMode = 'solo_3d';
        sceneManager = await SceneManager.create(soloPongCanvas);
        stopCurrentGame = () => {
            if (sceneManager) {
                sceneManager.dispose();
                sceneManager = null;
                console.log("3D Pong scene disposed.");
            }
        };
    });

    // 2. REMOTE 2D MULTIPLAYER
    document.getElementById("darkBtn")?.addEventListener("click", () => {
        stopAnyActiveGame();
        pongWindow.close();
        multiplayerPongWindow.open();

        activePongMode = 'remote_2d';
        setRemotePongCanvas(multiPongCanvas);
        startRemotePong();
        stopCurrentGame = stopRemotePong;
    });

    // 3. LOCAL 2D MULTIPLAYER
    document.getElementById("tournamentBtn")?.addEventListener("click", () => {
        stopAnyActiveGame();
        multiplayerPongWindow.close();
        pongWindow.open();
        
        activePongMode = 'local_2d';
        setLocalPongCanvas(soloPongCanvas);
        startLocalPong();
        stopCurrentGame = stopLocalPong;
    });

    // --- Final Setup ---
    await updateUIBasedOnAuth();
    window.addEventListener("auth:updated", updateUIBasedOnAuth);

    // Multiplayer game orchestration listeners
    window.addEventListener('pongGameStart', (event: Event) => {
        stopAnyActiveGame(); // Stop any local game before starting a remote one
        const customEvent = event as CustomEvent;
        const { gameId, initialState, yourPlayerId, opponentId, opponentUsername } = customEvent.detail;
        activeRemoteGameId = gameId;


        pongWindow.close();
        multiplayerPongWindow.open();
        initMultiplayerPong(gameId, initialState, yourPlayerId, opponentId, opponentUsername, multiPongCanvas, sendPongPlayerInput, sendPongPlayerReady);
        activePongMode = 'remote_2d';
        stopCurrentGame = cleanupMultiplayerPong;
    });

    window.addEventListener('pongGameStateUpdate', (event: Event) => {
        const { gameId, ball, players, status } = (event as CustomEvent).detail;
        updateMultiplayerGameState(ball, players, status);
    });

    window.addEventListener('pongGameOver', (event: Event) => {
        const { winnerId, scores } = (event as CustomEvent).detail;
        handleMultiplayerGameOver(winnerId, scores);
        activeRemoteGameId = null;
        activePongMode = null;
        stopCurrentGame = null;
    });
    window.addEventListener('changeTheme', (event: Event) => {
        const customEvent = event as CustomEvent;
        const theme = customEvent.detail.theme;

        if (theme === 'blue') {
            changeTheme('#1e293b', '#1b3F72');
        } else if (theme === 'pink') {
            changeTheme('#4d2d3f', '#804c64');
        } else if (theme === 'green') {
            changeTheme('#2d4d26', '#4a803d');
        }
    });

    initGoogleSignIn();
    settingUserProfile();
    setupSettingForm(settingWindow);
    setupInfoWindow(weatherWindow, grafanaWindow, commandWindow, aboutWindow);

    fetch("/ai_prompt.txt")
        .then(res => res.text())
        .then(text => setupAIWindow(musicWindow, text))
        .catch(err => console.error("Failed to load AI prompt:", err));
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

