import { startPongGame, setCanvas } from "./pong.ts";
import { DesktopWindow } from "./DesktopWindow.js";
import { checkSignedIn, setupSignupForm } from "./sign_up.js";
import { initGoogleSignIn } from "./google_auth.js";
import { setupLogoutForm } from "./logout.js";
import { setupSigninForm } from "./sign_in.js";
import { setupSettingForm } from "./setting.js";
import { initializeChatSystem } from "./chatClient.js";
import { setupAvatarCanvas, loadAvatarPreview } from "./avatar_draw.ts";

let signinWindow: DesktopWindow;
let signupWindow: DesktopWindow;
let logoutWindow: DesktopWindow;
let profileWindow: DesktopWindow;
let settingWindow: DesktopWindow;
let pongWindow: DesktopWindow;

function assignOpenTrigger(windowInstance: DesktopWindow, triggerId: string, onOpen?: () => void) {
  const trigger = document.getElementById(triggerId);
  if (trigger) {
    trigger.addEventListener("click", () => {
      windowInstance.open();
      onOpen?.();
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
    assignOpenTrigger(profileWindow, "profileBtn", () => {
      loadAvatarPreview();
      setupAvatarCanvas();
    });

    assignOpenTrigger(settingWindow, "settingTab");
    assignOpenTrigger(logoutWindow, "logoutTab");
    assignOpenTrigger(pongWindow, "clickMeBtn");
    initializeChatSystem();

    disableTrigger("signinTab");
    disableTrigger("signupTab");
  } else {
    assignOpenTrigger(signinWindow, "signinTab");
    (window as any).resetSigninForm?.();
    assignOpenTrigger(signupWindow, "signupTab");
    (window as any).resetSignupForm?.();

    disableTrigger("profileBtn");
    disableTrigger("settingTab");
    disableTrigger("logoutTab");
    disableTrigger("clickMeBtn");
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
  } catch (error) {
    console.error("Failed to initialize the signin window:", error);
  }

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
  } catch (error) {
    console.error("Failed to initialize the signup window:", error);
  }

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
  } catch (error) {
    console.error("Failed to initialize 'logoutWindow':", error);
  }

  try {
    settingWindow = new DesktopWindow({
      windowId: "settingWindow",
      dragHandleId: "settingDragHandle",
      resizeHandleId: "settingResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "settingWindow",
      closeButtonId: "closesettingBtn",
    });
  } catch (error) {
    console.error("Failed to initialize 'settingWindow':", error);
  }

  try {
    profileWindow = new DesktopWindow({
      windowId: "profileWindow",
      dragHandleId: "profileDragHandle",
      resizeHandleId: "profileResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "profileWindow",
      closeButtonId: "closeprofileBtn",
    });
  } catch (error) {
    console.error("Failed to initialize 'profileWindow':", error);
  }

  try {
    pongWindow = new DesktopWindow({
      windowId: "pongWindow",
      dragHandleId: "pongDragHandle",
      resizeHandleId: "pongResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "pongWindow",
      closeButtonId: "closepongBtn",
    });
  } catch (error) {
    console.error("Failed to initialize 'PREFIXWindow':", error);
  }

  try {
    const chatWindow = new DesktopWindow({
      windowId: "chatWindow",
      dragHandleId: "chatDragHandle",
      resizeHandleId: "chatResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "chatWindow",
      openTriggerId: "chatBtn",
      closeButtonId: "closeChatBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the chat window:", error);
  }

  await updateUIBasedOnAuth();
  window.addEventListener("auth:updated", updateUIBasedOnAuth);

  setupSignupForm(signupWindow);
  initGoogleSignIn();
  setupSigninForm(signinWindow);
  setupSettingForm(settingWindow);
  setupLogoutForm(logoutWindow);

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
  }});
