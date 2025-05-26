import { DesktopWindow } from "./DesktopWindow.js";

export function setupLogoutForm(logoutWindow: DesktopWindow) {

  const logoutUsername = document.getElementById("logoutUsername") as HTMLDivElement;

  // ✅ Patch .open() to auto-populate username every time
  const originalOpen = logoutWindow.open.bind(logoutWindow);
  logoutWindow.open = async () => {

    try {
      const res = await fetch("http://localhost:3000/api/me", { credentials: "include" });
      const data = await res.json();
      if (data?.signedIn && data.user?.username) {
        logoutUsername.textContent = data.user.username;
      }
    } catch (err) {
      logoutUsername.textContent = "Unknown user";
    }

    originalOpen(); // call the original open behavior
  };
  // Handle logout
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", async () => {
    await fetch("http://localhost:3000/api/logout", {
      method: "POST",
      credentials: "include",
    });

    logoutWindow.close(); // properly uses DesktopWindow method
    window.dispatchEvent(new Event("auth:updated"));

  });
}
