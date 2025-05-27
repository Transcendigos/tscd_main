import { DesktopWindow } from "./DesktopWindow.js";

export function setupSigninForm(signinWindow: DesktopWindow) {
  const signinForm = document.getElementById("signinForm") as HTMLFormElement;
  const statusBox = document.getElementById("signinStatus") as HTMLDivElement;
  const codeInput = document.getElementById("codeInput") as HTMLInputElement;
  const twofaFields = document.getElementById("twofaFields") as HTMLDivElement;
  const submit2FAButton = document.getElementById("submit2FA") as HTMLButtonElement;
  const errorBox = document.getElementById("twofaError") as HTMLDivElement;
  const closeBtn = document.getElementById("closesigninBtn");
  const signinGOOGLE = document.getElementById("signinGOOGLE") as HTMLSelectElement;

  const emailInput = signinForm.querySelector('input[name="email"]') as HTMLInputElement;
  const passwordInput = signinForm.querySelector('input[name="password"]') as HTMLInputElement;
  const submitBtn = signinForm.querySelector('button[type="submit"]') as HTMLButtonElement;
  const googleBtnContainer = document.getElementById("google-signin-signin");

  let tempEmail = "";

  //Reset sign-in form (called on window open)
  function resetSigninForm() {
    console.log("[SignIn] Resetting form");

    signinForm.reset();
    statusBox.textContent = "";
    statusBox.classList.add("opacity-0");
    statusBox.classList.remove("opacity-100");
    errorBox.textContent = "";
    twofaFields.classList.add("hidden");
    codeInput.value = "";
    tempEmail = "";
    passwordInput.disabled = false;
    passwordInput.classList.remove("opacity-50");
    submitBtn.disabled = false;
    googleBtnContainer?.classList.remove("hidden");
    signinGOOGLE?.classList.remove("hidden");

  }

  (window as any).resetSigninForm = resetSigninForm;

  // Reset on first load
  resetSigninForm();

  // Manual close
  closeBtn?.addEventListener("click", () => {
    signinWindow.close();
    resetSigninForm();
  });


  // ✅ Detect login method and adjust UI
  async function detectAuthMethod(email: string) {
    if (!email) return;

    try {
      const res = await fetch(`http://localhost:3000/api/auth/methods?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      const methods = data.methods || [];

      // Case: New email (no existing user)
      if (methods.length === 0) {
        // New user detected — block sign-in and prompt to sign up
        passwordInput.disabled = true;
        passwordInput.classList.add("opacity-50");
        submitBtn.disabled = true;
        signinGOOGLE?.classList.add("hidden");
        statusBox.textContent = "New user — redirecting to Sign-Up...";
        statusBox.classList.remove("opacity-0");
        statusBox.classList.add("opacity-100");

        // Auto-switch after short delay
        setTimeout(() => {
          // Close Sign-In window
          signinWindow.close();
          resetSigninForm();

          // Trigger Sign-Up tab
          const signupTab = document.getElementById("signupTab");
          signupTab?.click(); // Triggers DesktopWindow to open sign-up
        }, 2200);
        return;
      }

      // Case: Google only
      if (methods.includes("google") && !methods.includes("local")) {
        passwordInput.disabled = true;
        passwordInput.classList.add("opacity-50");
        submitBtn.disabled = true;
        statusBox.textContent = "This account uses Google Sign-In only.";
        statusBox.classList.remove("opacity-0");
        statusBox.classList.add("opacity-100");
        return;
      }

      // Case: Local only
      if (methods.includes("local") && !methods.includes("google")) {
        passwordInput.disabled = false;
        passwordInput.classList.remove("opacity-50");
        submitBtn.disabled = false;
        signinGOOGLE?.classList.add("hidden");
        statusBox.textContent = "This account uses Local Sign-In only.";
        statusBox.classList.remove("opacity-0");
        statusBox.classList.add("opacity-100");
        return;
      }


    } catch (err) {
      console.error("Failed to detect auth method:", err);
      errorBox.textContent = "Something went wrong while checking the login method.";
    }
  }

  // Trigger detection on blur
  emailInput.addEventListener("blur", () => {
    detectAuthMethod(emailInput.value);
  });

  emailInput.addEventListener("input", () => {
    errorBox.textContent = "";
    passwordInput.disabled = false;
    passwordInput.classList.remove("opacity-50");
    submitBtn.disabled = false;
    googleBtnContainer?.classList.remove("hidden");
    twofaFields.classList.add("hidden");
  });

  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const email = emailInput.value;
    const password = passwordInput.value;

    const res = await fetch("http://localhost:3000/api/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.twofa_required) {
      tempEmail = email;
      twofaFields.classList.remove("hidden");

    } else if (data.user) {
      signinWindow.close(); // ✅ close window
      window.dispatchEvent(new Event("auth:updated")); // 🔁 update UI
    } else {
      errorBox.textContent = data.error || "Login failed";
    }
  });

  // 2FA Submit
  submit2FAButton.addEventListener("click", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const code = codeInput.value;
    const method = "TOTP"; 
    const res = await fetch("http://localhost:3000/api/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, method, email: tempEmail }),
    });

    const data = await res.json();
    if (data.user) {
      signinWindow.close();
      window.dispatchEvent(new Event("auth:updated"));
    } else {
      errorBox.textContent = data.error || "Invalid 2FA code";
    }
  });


}
