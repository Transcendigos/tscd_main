import { DesktopWindow } from "./DesktopWindow.js";


export async function checkSignedIn(): Promise<boolean> {
  try {
    const res = await fetch("/api/me", {
      credentials: "include",
    });
    const result = await res.json();
    return result?.signedIn === true;
  } catch (err) {
    console.error("Failed to check session:", err);
    return false;
  }
}

export function setupSignupForm(signupWindow: DesktopWindow) {
  const signupForm = document.getElementById("signupForm") as HTMLFormElement;
  const closeSignupBtn = document.getElementById("closeSignupBtn");


  function resetSignupForm() {
    console.log("[SignUp] Resetting form");
    signupForm.reset();
  }

  (window as any).resetSignupForm = resetSignupForm;

  resetSignupForm();


  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(signupForm);
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const result = await res.json();
      if (res.ok) {
        signupWindow.close();
        window.dispatchEvent(new Event("auth:updated"));
      } else {
        alert("Signup failed: " + result.error);
      }
    } catch (err) {
      console.error("Signup failed:", err);
      alert("Could not contact the server.");
    }

    resetSignupForm();
  });

  closeSignupBtn?.addEventListener("click", () => {
    signupWindow.close();
    resetSignupForm();
  });
}