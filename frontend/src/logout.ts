export function setupLogoutForm() {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutUsername = document.getElementById("logoutUsername");

  // Set username when logout window opens
  const logoutTab = document.getElementById("logoutTab");
  logoutTab?.addEventListener("click", async () => {
    const response = await fetch("http://localhost:3000/api/me", { credentials: "include" });
    const data = await response.json();

    if (data?.signedIn && data.user?.username && logoutUsername) {
      logoutUsername.textContent = data.user.username;
    }
  });

  // Handle logout
  logoutBtn?.addEventListener("click", async () => {
    await fetch("http://localhost:3000/api/logout", {
      method: "POST",
      credentials: "include",
    });

    // ✅ Hide logout window
    const logoutWindow = document.getElementById("logoutWindow");
    logoutWindow?.classList.add("opacity-0", "scale-95", "invisible", "pointer-events-none");
    logoutWindow?.classList.remove("opacity-100", "scale-100", "visible", "pointer-events-auto");

    // ✅ Update frontend UI dynamically
    window.dispatchEvent(new Event("auth:updated"));
  });
}
