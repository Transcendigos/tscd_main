export function setupSigninForm() {
  const signinForm = document.getElementById("signinForm") as HTMLFormElement;
  const methodSelect = document.getElementById("methodSelect") as HTMLSelectElement;
  const codeInput = document.getElementById("codeInput") as HTMLInputElement;
  const twofaFields = document.getElementById("twofaFields") as HTMLDivElement;
  const submit2FAButton = document.getElementById("submit2FA") as HTMLButtonElement;
  const resendCodeButton = document.getElementById("resendCode") as HTMLButtonElement;
  const errorBox = document.getElementById("twofaError") as HTMLDivElement;

  let tempEmail = "";

  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const email = (signinForm.elements.namedItem("email") as HTMLInputElement).value;
    const password = (signinForm.elements.namedItem("password") as HTMLInputElement).value;

    const res = await fetch("/api/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.twofa_required) {
      tempEmail = email;
      methodSelect.innerHTML = "";
      data.available_methods.forEach((method: string) => {
        const option = document.createElement("option");
        option.value = method;
        option.textContent = method.toUpperCase();
        methodSelect.appendChild(option);
      });

      twofaFields.classList.remove("hidden");

      // Pre-send email code
      if (data.available_methods.includes("email")) {
        await fetch("/api/2fa/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
      }
    } else if (data.user) {
      window.location.reload();
    } else {
      errorBox.textContent = data.error || "Login failed";
    }
  });

  submit2FAButton.addEventListener("click", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const code = codeInput.value;
    const method = methodSelect.value;

    const res = await fetch("/api/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, method, email: tempEmail }),
    });

    const data = await res.json();
    if (data.user) {
      window.location.reload();
    } else {
      errorBox.textContent = data.error || "Invalid 2FA code";
    }
  });

  resendCodeButton.addEventListener("click", async () => {
    errorBox.textContent = "";
    if (!tempEmail) return;
    const method = methodSelect.value;
    if (method !== "email") return;

    const res = await fetch("/api/2fa/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: tempEmail }),
    });

    const result = await res.json();
    if (result.error) {
      errorBox.textContent = result.error;
    } else {
      errorBox.textContent = "A new email code was sent.";
    }
  });
}