import { DesktopWindow } from "./DesktopWindow.js";

export async function setupSettingForm(settingWindow: DesktopWindow) {

  async function resetAllForms() {
    (document.getElementById("newUsername") as HTMLInputElement).value = '';
    (document.getElementById("newEmail") as HTMLInputElement).value = '';
    (document.getElementById("newPassword") as HTMLInputElement).value = '';
    (document.getElementById("profilePicInput") as HTMLInputElement).value = '';
    (document.getElementById("verifyTotpInput") as HTMLInputElement).value = '';
    hide("usernameForm");
    hide("emailForm");
    hide("passwordForm");
    hide("pictureForm");
    const usernameMsg = document.getElementById("UsernameUpdateStatus")!;
    const emailMsg = document.getElementById("emailUpdateStatus")!;
    const passwordMsg = document.getElementById("passwordUpdateStatus")!;
    const pictureMsg = document.getElementById("pictureUpdateStatus")!;
    const deleteMsg = document.getElementById("deleteUpdateStatus")!;
    usernameMsg.textContent = "";
    emailMsg.textContent = "";
    passwordMsg.textContent = "";
    pictureMsg.textContent = "";
    deleteMsg.textContent = "";
  }

  const usernameMsg = document.getElementById("UsernameUpdateStatus")!;
  const emailMsg = document.getElementById("emailUpdateStatus")!;
  const passwordMsg = document.getElementById("passwordUpdateStatus")!;
  const pictureMsg = document.getElementById("pictureUpdateStatus")!;
  const deleteMsg = document.getElementById("deleteUpdateStatus")!;

  const show = (id: string) => document.getElementById(id)!.classList.remove("hidden");
  const hide = (id: string) => document.getElementById(id)!.classList.add("hidden");

  document.getElementById("changeUsernameBtn")?.addEventListener("click", () => show("usernameForm"));
  document.getElementById("changeEmailBtn")?.addEventListener("click", () => show("emailForm"));
  document.getElementById("changePasswordBtn")?.addEventListener("click", () => show("passwordForm"));
  document.getElementById("changePictureBtn")?.addEventListener("click", () => show("pictureForm"));
  const currentUsername = document.getElementById('currentUsername');
  const currentEmail = document.getElementById('currentEmail');

  function getApiUrl(path: string) {
    const base = import.meta.env.VITE_API_URL || '';
    return base + path;
  }

  // Username
  document.getElementById("saveUsernameBtn")?.addEventListener("click", async () => {
    const newUsername = (document.getElementById("newUsername") as HTMLInputElement).value;
    const res = await fetch(getApiUrl("/api/profile/update-username"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: newUsername }),
    });

    const data = await res.json();
    if (res.ok) {
      currentUsername.textContent = newUsername;
      const logoutUsername = document.getElementById("logoutUsername") as HTMLDivElement;
      logoutUsername.textContent = newUsername;
      const usernameProfile = document.getElementById('profileUsername');
      usernameProfile.textContent = newUsername;
      usernameMsg.textContent = "✅ Username updated!";
      setTimeout(() => {
        hide("usernameForm"); resetAllForms()
      }, 1500);
      ;
      console.log("ALL GOOD");
    } else {
      usernameMsg.textContent = `❌ ${data.error || "Failed to update username"}`;
    }
  });

  // Email
  document.getElementById("saveEmailBtn")?.addEventListener("click", async () => {
    const emailInput = document.getElementById("newEmail") as HTMLInputElement;
    const newEmail = emailInput.value;

    if (!emailInput.checkValidity()) {
      emailInput.reportValidity(); // Trigger browser-style error popup
      return;
    }

    const res = await fetch(getApiUrl("/api/profile/update-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: newEmail }),
    });

    const data = await res.json();
    if (res.ok) {
      currentEmail.textContent = newEmail;
      const emailProfile = document.getElementById("profileEmail");
      emailProfile.textContent = newEmail;
      emailMsg.textContent = "✅ Email updated!";
      setTimeout(() => {
        hide("emailForm");
      }, 1000);
      resetAllForms();
      console.log("ALL GOOD");
    } else {
      emailMsg.textContent = `❌ ${data.error || "Failed to update email"}`;
    }
  });
  // Password
  document.getElementById("savePasswordBtn")?.addEventListener("click", async () => {
    const newPassword = (document.getElementById("newPassword") as HTMLInputElement).value;
    const res = await fetch(getApiUrl("/api/profile/update-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    if (res.ok) {
      passwordMsg.textContent = "✅ Password updated!";
      setTimeout(() => {
        hide("passwordForm"); // Redirect to homepage or login
      }, 1000);
      resetAllForms();
      console.log("ALL GOOD");
    } else {
      passwordMsg.textContent = `❌ ${data.error || "Failed to update password"}`;
    }
  });

  // Picture Upload profileImageSetting
  document.getElementById("uploadPicBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("profilePicInput") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("profilePic", file);

    const res = await fetch(getApiUrl("/api/profile/upload-picture"), {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      const img_profile = document.getElementById("profileImage") as HTMLImageElement;
      img_profile.src = data.url || URL.createObjectURL(file); // temporary preview
      const img_setting = document.getElementById("profileImageSetting") as HTMLImageElement;
      img_setting.src = data.url || URL.createObjectURL(file); // temporary preview
      pictureMsg.textContent = "✅ Picture updated!";
      setTimeout(() => {
        hide("pictureForm"); // Redirect to homepage or login
      }, 1000);
      resetAllForms();
      console.log("ALL GOOD");
    } else {
      pictureMsg.textContent = `❌ ${data.error || "Failed to upload picture"}`;
    }
  });

  // DELETE ACCOUNT

  document.getElementById("deleteAccount")?.addEventListener("click", async () => {
    const confirmDelete = confirm("⚠️ Are you sure you want to delete your account? This action is irreversible.");
    if (!confirmDelete) return;

    deleteMsg.textContent = "⏳ Deleting your account...";

    try {
      const res = await fetch(getApiUrl("/api/profile/delete-account"), {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (res.ok) {
        deleteMsg.textContent = "✅ Account deleted. Redirecting...";
        setTimeout(() => {
          window.location.href = "/"; // Redirect to homepage or login
        }, 1500);
        resetAllForms();
      } else {
        deleteMsg.textContent = `❌ ${data.error || "Failed to delete account"}`;
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      deleteMsg.textContent = "❌ Unexpected error occurred.";
    }
  });

  // 2FA SECTION
  const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;
  const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
  const qrCodeImage = document.getElementById('qrCodeImage') as HTMLImageElement;
  const verifyTotpInput = document.getElementById('verifyTotpInput') as HTMLInputElement;
  const confirmTotpButton = document.getElementById('confirmTotpButton') as HTMLButtonElement;
  const totpMsg = document.getElementById('totpStatus') as HTMLParagraphElement;

  // ✅ Enable/Disable TOTP 2FA
  totp2faCheckbox.addEventListener('change', async () => {
    if (!totp2faCheckbox.checked) {
      // ❌ Disable TOTP
      const res = await fetch(getApiUrl('/api/2fa/disable-totp'), {
        method: 'POST',
        credentials: 'include',
      });
      // const result = await res.json();
      // alert(result.message || 'TOTP disabled.');
      qrContainer.classList.add('hidden');
      return;
    }

    // ✅ Start TOTP setup
    const res = await fetch(getApiUrl('/api/2fa/setup-totp'), {
      method: 'POST',
      credentials: 'include',
    });

    const data = await res.json();
    if (data.qrCodeUrl && data.base32) {
      qrCodeImage.src = data.qrCodeUrl;
      qrCodeImage.dataset.secret = data.base32; // ← store secret
      qrContainer.classList.remove('hidden');
      totpMsg.textContent = '';
    }
  });

  // ✅ Confirm TOTP 6-digit input
  confirmTotpButton.addEventListener('click', async () => {
    const token = verifyTotpInput.value;
    const secret = qrCodeImage.dataset.secret || '';
    totpMsg.textContent = ''; // clear previous

    try {
      const res = await fetch(getApiUrl('/api/2fa/verify-totp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, secret }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unknown error');
      }

      // ✅ Success
      totpMsg.textContent = data.message;
      totpMsg.classList.remove('text-[#D4535B]');
      totpMsg.classList.add('text-[#53D4C0]');
      setTimeout(() => {
        qrContainer.classList.add('hidden');
        totpMsg.textContent = '';
      }, 1500);

    } catch (err) {
      // 👇 You will see any backend-provided error here
      console.error("❌ TOTP verification failed:", err);
      totpMsg.textContent = err.message || 'TOTP verification failed';
      totpMsg.classList.remove('text-[#53D4C0]');
      totpMsg.classList.add('text-[#D4535B]');

    }
  });
}