export function setupLogoutForm() {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutUsername = document.getElementById("logoutUsername");

  // Set username when logout window opens
  const logoutTab = document.getElementById("logoutTab");
  logoutTab?.addEventListener("click", async () => {
    const response = await fetch("/api/me", { credentials: "include" });
    const data = await response.json();

    if (data?.signedIn && data.user?.username && logoutUsername) {
      logoutUsername.textContent = data.user.username;
    }
  });

  // Handle logout
  logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    location.reload();
  });
}
