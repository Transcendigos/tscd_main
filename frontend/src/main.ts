import { startPongGame, setCanvas } from "./pong.js";
import { DesktopWindow } from "./DesktopWindow.js";
// import { startWebcamFeed } from "./webcam.js";

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


  const signupForm = document.getElementById("signupForm") as HTMLFormElement;

  // Toggle Sign-Up Window
  const signupTab = document.getElementById("signupTab");
  const signupWindow = document.getElementById("signupWindow");
  const closeSignupBtn = document.getElementById("closeSignupBtn");

  signupTab?.addEventListener("click", () => {
    signupWindow?.classList.remove("hidden");
  });

  closeSignupBtn?.addEventListener("click", () => {
    signupWindow?.classList.add("hidden");
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(signupForm);
    const body: Record<string, string> = {};

    formData.forEach((value, key) => {
      body[key] = value.toString(); // convert to string just to be safe
    });

    try {
      console.log("Sending signup request:", body);

      const res = await fetch("http://localhost:3000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      console.log("Server responded:", result);

      if (res.ok) {
        // alert("Signed up successfully!");
        signupWindow?.classList.add("hidden");
        signupForm.reset();
      } else {
        alert("Signup failed.");
      }
    } catch (err) {
      console.error("Request failed:", err);
      alert("Could not contact the server.");
    }
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
