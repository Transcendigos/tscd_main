export async function checkSignedIn(): Promise<boolean> {
  console.log("Checking signed-in status..."); // ✅ add this
  try {
    const res = await fetch("http://localhost:3000/api/me", {
      credentials: "include",
    });

    const result = await res.json();
    console.log("Session check result:", result);

    const signupWindow = document.getElementById("signupWindow");

    if (result.signedIn) {
      signupWindow!.innerHTML = `
        <div class="p-4">
          <p class="mb-4">You are already signed in as <strong>${result.user.username}</strong>.</p>
          <button id="logoutBtn"
            class="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-700">
            Log Out
          </button>
        </div>`;

      document.getElementById("logoutBtn")?.addEventListener("click", async () => {
        await fetch("http://localhost:3000/api/logout", {
          method: "POST",
          credentials: "include",
        });
        location.reload();
      });

      return true;
    }

    return false;
  } catch (err) {
    console.error("Failed to check session:", err);
    return false;
  }
}

export function setupSignupForm() {
  const signupForm = document.getElementById("signupForm") as HTMLFormElement;
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
      body[key] = value.toString();
    });

    try {
      console.log("Sending signup request:", body);

      const res = await fetch("http://localhost:3000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const result = await res.json();
      console.log("Server responded:", result);

      if (res.ok) {
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
}