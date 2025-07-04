import { DesktopWindow } from "./DesktopWindow.js";
import { resetAIWindow } from "./aiassistant.js";

export function setupLogoutForm(logoutWindow: DesktopWindow) {

  const logoutUsername = document.getElementById("logoutUsername") as HTMLDivElement;

  const originalOpen = logoutWindow.open.bind(logoutWindow);

  logoutWindow.open = async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json();
      console.log("🧾 /api/me response:", data);

      if (data?.signedIn && data.user?.username) {
        logoutUsername.textContent = data.user.username;
      } else {
        logoutUsername.textContent = "Unknown user";
      }
    } catch (err) {
      console.error("❌ Failed to fetch /api/me:", err);
      logoutUsername.textContent = "Unknown user";
    }

    originalOpen();
  };
  
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    
    resetAIWindow();
    logoutWindow.close();

    window.dispatchEvent(new Event("auth:updated"));

  });
}
