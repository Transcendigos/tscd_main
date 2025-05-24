import { startPongGame, setCanvas } from "./pong.js";
import { DesktopWindow } from "./DesktopWindow.js";
// import { startWebcamFeed } from "./webcam.js";
import { checkSignedIn, setupSignupForm } from "./sign_up.js";
import { initGoogleSignIn } from "./google_auth";
import { initializeChatSystem } from "./chatClient.js"; // +++ ADD THIS IMPORT +++

window.addEventListener("DOMContentLoaded", () => {
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

  // --- Signup Window ---
  try {
    const signupWindow = new DesktopWindow({
      windowId: "signupWindow",
      dragHandleId: "signupDragHandle",
      resizeHandleId: "signupResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "signupWindow",
      openTriggerId: "signupTab",
      closeButtonId: "closeSignupBtn",
      showClasses: defaultShowClasses,
      hideClasses: defaultHideClasses,
    });
  } catch (error) {
    console.error("Failed to initialize the signup window:", error);
  }

    // --- Profile Window ---

  try {
    const myNewWindow = new DesktopWindow({
      windowId: "profileWindow",
      dragHandleId: "profileDragHandle",
      resizeHandleId: "profileResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "profileWindow",
      openTriggerId: "profileBtn",
      closeButtonId: "closeprofileBtn",
    });
  } catch (error) {
    console.error("Failed to initialize 'profileWindow':", error);
  }

    // --- Pong Window ---

  try {
    const myNewWindow = new DesktopWindow({
      windowId: "pongWindow",
      dragHandleId: "pongDragHandle",
      resizeHandleId: "pongResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "pongWindow",
      openTriggerId: "clickMeBtn",
      closeButtonId: "closepongBtn",
    });
  } catch (error) {
    console.error("Failed to initialize 'PREFIXWindow':", error);
  }

  // --- Chat Window ---
  try {
    const chatWindow = new DesktopWindow({
      windowId: "chatWindow",
      dragHandleId: "chatDragHandle",
      resizeHandleId: "chatResizeHandle",
      boundaryContainerId: "main",
      visibilityToggleId: "chatWindow", // The window itself is the toggle target
      openTriggerId: "chatBtn", // ID of the "Chat" link we added to the menu
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

  initGoogleSignIn();
  // --- START OF SIGN-UP  Logic ---
  checkSignedIn().then((isSignedIn) => {
    if (!isSignedIn) 
    {
      setupSignupForm(); 
    } else {
      initializeChatSystem();
    }
    
  }); 
  // --- END OF SIGN-UP  Logic ---

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
