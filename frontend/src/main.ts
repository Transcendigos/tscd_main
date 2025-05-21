import { startPongGame, setCanvas } from "./pong.js";
import { DesktopWindow } from "./DesktopWindow.js";

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

  // --- Pong Game Specific Logic ---
  const gameContainer = document.getElementById("gameContainer")!;
  const clickBtn = document.getElementById("clickMeBtn")!;
  const backBtn = document.getElementById("backBtn")!;
  const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;

  // The #main element is no longer directly hidden by pong logic,
  // but the menuWindow instance (dragWindow) will be.
  const menuWindowElement = document.getElementById("dragWindow")!;

  if (clickBtn && menuWindowElement && gameContainer && canvas) {
    clickBtn.addEventListener("click", () => {
      menuWindowElement.classList.remove(...defaultShowClasses);
      menuWindowElement.classList.add(...defaultHideClasses);
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

  // Handle Form Submission
  const signupForm = document.getElementById("signupForm") as HTMLFormElement;

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
