import { DesktopWindow } from "./DesktopWindow.js";

export function setupSigninForm(signinWindow: DesktopWindow) {
  const signinForm = document.getElementById("signinForm") as HTMLFormElement;
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

  function resetSigninForm() {
    console.log("[SignIn] Resetting form");

    signinForm.reset();
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

  resetSigninForm();

  closeBtn?.addEventListener("click", () => {
    signinWindow.close();
    resetSigninForm();
  });


  async function detectAuthMethod(email: string) {
    if (!email) return;

    try {
      const res = await fetch(`/api/auth/methods?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      const methods = data.methods || [];

      if (methods.length === 0) {
        passwordInput.disabled = true;
        passwordInput.classList.add("opacity-50");
        submitBtn.disabled = true;
        signinGOOGLE?.classList.add("hidden");

        setTimeout(() => {
          signinWindow.close();
          resetSigninForm();

          const signupTab = document.getElementById("signupTab");
          signupTab?.click();
        }, 2200);
        return;
      }

      if (methods.includes("google") && !methods.includes("local")) {
        passwordInput.disabled = true;
        passwordInput.classList.add("opacity-50");
        submitBtn.disabled = true;
        return;
      }

      if (methods.includes("local") && !methods.includes("google")) {
        passwordInput.disabled = false;
        passwordInput.classList.remove("opacity-50");
        submitBtn.disabled = false;
        signinGOOGLE?.classList.add("hidden");
        return;
      }


    } catch (err) {
      console.error("Failed to detect auth method:", err);
      errorBox.textContent = "Something went wrong while checking the login method.";
    }
  }

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

    const res = await fetch("/api/signin", {
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
      signinWindow.close();
      window.dispatchEvent(new Event("auth:updated"));
    } else {
      errorBox.textContent = data.error || "Login failed";
    }
  });

  submit2FAButton.addEventListener("click", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const code = codeInput.value;
    const method = "TOTP"; 
    const res = await fetch("/api/2fa/verify", {
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
