import { startPongGame, setCanvas } from "./pong.ts";
import { DesktopWindow } from "./DesktopWindow.js";
import { checkSignedIn, setupSignupForm } from "./sign_up.js";
import { initGoogleSignIn } from "./google_auth.js";
import { setupLogoutForm } from "./logout.js";
import { setupSigninForm } from "./sign_in.js";
import { setupSettingForm } from "./setting.js";
import { initializeChatSystem } from "./chatClient.js";
import { setupInfoWindow } from "./infowindow.ts";
// import { startWebcamFeed } from "./webcam.js";

// Top of the file
let signinWindow: DesktopWindow;
let signupWindow: DesktopWindow;
let logoutWindow: DesktopWindow;
let profileWindow: DesktopWindow;
let settingWindow: DesktopWindow;
let pongWindow: DesktopWindow;
let chatWindow: DesktopWindow;
let statsWindow: DesktopWindow;
let infoWindow: DesktopWindow;
let weatherWindow: DesktopWindow;

// Utility functions
function assignOpenTrigger(windowInstance: DesktopWindow, triggerId: string) {
  const trigger = document.getElementById(triggerId);
  if (trigger) {
    trigger.addEventListener("click", () => windowInstance.open());
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

// Auth-aware trigger logic
async function updateUIBasedOnAuth() {
  const isSignedIn = await checkSignedIn();

  if (isSignedIn) {
    assignOpenTrigger(profileWindow, "profileBtn");
    assignOpenTrigger(settingWindow, "settingTab");
    assignOpenTrigger(logoutWindow, "logoutTab");
    assignOpenTrigger(pongWindow, "clickMeBtn");
    assignOpenTrigger(chatWindow, "chatBtn");
    assignOpenTrigger(infoWindow, "infoTab");
    assignOpenTrigger(statsWindow, "statsTab");
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

  // Declare windows
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


  // --- Signin Window ---
  try {
    signinWindow = new DesktopWindow({
      windowId: "signinWindow",
      dragHandleId: "signinDragHandle",
      resizeHandleId: "signinResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "signinWindow",
      // openTriggerId: "signinTab",
      closeButtonId: "closesigninBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the signin window:", error);
  }

  // --- Signup Window ---
  try {
    signupWindow = new DesktopWindow({
      windowId: "signupWindow",
      dragHandleId: "signupDragHandle",
      resizeHandleId: "signupResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "signupWindow",
      // openTriggerId: "signupTab",
      closeButtonId: "closeSignupBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the signup window:", error);
  }

  // --- Logout Window ---
  try {
    logoutWindow = new DesktopWindow({
      windowId: "logoutWindow",
      dragHandleId: "logoutDragHandle",
      resizeHandleId: "logoutResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "logoutWindow",
      // openTriggerId: "logoutTab",
      closeButtonId: "closelogoutBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'logoutWindow':", error);
  }

  // --- Setting Window ---

  try {
    settingWindow = new DesktopWindow({
      windowId: "settingWindow",
      dragHandleId: "settingDragHandle",
      resizeHandleId: "settingResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "settingWindow",
      // openTriggerId: "settingTab",
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
      // openTriggerId: "profileBtn",
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
      // openTriggerId: "infoTab",
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
      // openTriggerId: "openWeatherBtn",
      closeButtonId: "closeweatherBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
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
      // openTriggerId: "spawner",
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
      // openTriggerId: "clickMeBtn",
      closeButtonId: "closepongBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize 'pongWindow':", error);
  }

  // --- Chat Window ---
  try {
    chatWindow = new DesktopWindow({
      windowId: "chatWindow",
      dragHandleId: "chatDragHandle",
      resizeHandleId: "chatResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "chatWindow", // The window itself is the toggle target
      // openTriggerId: "chatBtn", // ID of the "Chat" link we added to the menu
      closeButtonId: "closeChatBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the chat window:", error);
  }

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

  // --- Pong Game Specific Logic ---
  const gameContainer = document.getElementById("gameContainer")!;
  const clickBtn = document.getElementById("clickMeBtn")!;
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;
  if (clickBtn && gameContainer && canvas) {
    clickBtn.addEventListener("click", () => {
      setCanvas(canvas);
      startPongGame();
    });
  } else {
    console.error("One or more elements for Pong game setup are missing.");
  }

  await updateUIBasedOnAuth();

  window.addEventListener("auth:updated", updateUIBasedOnAuth);

  setupSignupForm(signupWindow);

  initGoogleSignIn();

  setupSigninForm(signinWindow);

  setupSettingForm(settingWindow);

  setupLogoutForm(logoutWindow);

  setupInfoWindow(weatherWindow);

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
