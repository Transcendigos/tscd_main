import { DesktopWindow } from "./DesktopWindow.js";

export async function setupSettingForm(settingWindow: DesktopWindow) {

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
  const profileImage = document.getElementById('profileImageSetting') as HTMLImageElement | null;
  const currentUsername = document.getElementById('currentUsername');
  const currentEmail = document.getElementById('currentEmail');
  
  try {
    const res = await fetch('http://localhost:3000/api/profile', { credentials: 'include' });
    if (!res.ok) {
      console.error('Failed to fetch profile');
      return;
    }
    const { profile } = await res.json();
    console.log(profile);
    if (!profileImage || !currentUsername || !currentEmail) {
      console.warn("Profile elements not found in DOM.");
      return;
    }
    console.log('image is ', profile.image);
    const fallbackImage = '/favicon.jpg';
    const resolvedSrc = profile.picture || fallbackImage;
    const absoluteResolvedSrc = resolvedSrc.startsWith('http')
      ? resolvedSrc
      : new URL(resolvedSrc, window.location.origin).href;

    // Avoid flickering
    if (profileImage.src !== absoluteResolvedSrc) {
      profileImage.src = resolvedSrc;
    }

    console.log(profileImage);
    profileImage.alt = `${profile.username}'s profile picture`;

    profileImage.onerror = () => {
      if (!profileImage.src.includes(fallbackImage)) {
        profileImage.src = fallbackImage;
      }
    };
    currentUsername.textContent = profile.username;
    currentEmail.textContent = profile.email;
    profileImage.src = profile.picture;
  } catch (error) {
    console.error("Error loading user profile:", error);
  }


  // Username
  document.getElementById("saveUsernameBtn")?.addEventListener("click", async () => {
    const newUsername = (document.getElementById("newUsername") as HTMLInputElement).value;
    const res = await fetch("http://localhost:3000/api/profile/update-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: newUsername }),
    });

    const data = await res.json();
    if (res.ok) {
      currentUsername.textContent = newUsername;
      usernameMsg.textContent = "✅ Username updated!";
      hide("usernameForm");
    } else {
      usernameMsg.textContent = `❌ ${data.error || "Failed to update username"}`;
    }
  });

  // Email
  document.getElementById("saveEmailBtn")?.addEventListener("click", async () => {
    const newEmail = (document.getElementById("newEmail") as HTMLInputElement).value;
    const res = await fetch("http://localhost:3000/api/profile/update-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: newEmail }),
    });

    const data = await res.json();
    if (res.ok) {
      currentEmail.textContent = newEmail;
      emailMsg.textContent = "✅ Email updated!";
      hide("emailForm");
    } else {
      emailMsg.textContent = `❌ ${data.error || "Failed to update email"}`;
    }
  });

  // Password
  document.getElementById("savePasswordBtn")?.addEventListener("click", async () => {
    const newPassword = (document.getElementById("newPassword") as HTMLInputElement).value;
    const res = await fetch("http://localhost:3000//api/profile/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    if (res.ok) {
      passwordMsg.textContent = "✅ Password updated!";
      hide("passwordForm");
    } else {
      passwordMsg.textContent = `❌ ${data.error || "Failed to update password"}`;
    }
  });

  // Picture Upload
  document.getElementById("uploadPicBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("profilePicInput") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("profilePic", file);

    const res = await fetch("http://localhost:3000//api/profile/upload-picture", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      const img = document.getElementById("profileImage") as HTMLImageElement;
      img.src = data.url || URL.createObjectURL(file); // temporary preview
      pictureMsg.textContent = "✅ Picture updated!";
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
      const res = await fetch("http://localhost:3000/api/profile/delete-account", {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (res.ok) {
        deleteMsg.textContent = "✅ Account deleted. Redirecting...";
        setTimeout(() => {
          window.location.href = "/"; // Redirect to homepage or login
        }, 1500);
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
  const totpMsg = document.getElementById('totp') as HTMLParagraphElement;


  function disableTrigger(triggerId: string) {
    const el = document.getElementById(triggerId);
    if (el) {
      el.classList.add("opacity-50", "cursor-not-allowed", "select-none");
      el.classList.remove("hover-important", "cursor-default");
      const inputs = el.querySelectorAll("input");
      inputs.forEach((input) => {
        (input as HTMLInputElement).disabled = true;
        (input as HTMLInputElement).style.pointerEvents = 'none'; // pour être sûr
      });
    }
  }

  function enableTrigger(triggerId: string) {
    const el = document.getElementById(triggerId);
    if (el) {
      el.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
      const inputs = el.querySelectorAll("input");
      inputs.forEach((input) => {
        (input as HTMLInputElement).disabled = false;
        (input as HTMLInputElement).style.pointerEvents = 'auto'; // pour être sûr
      });
    }
  }

  async function refreshTotpState() {
    console.log("Refreshing TOTP state");
    qrContainer.classList.add('hidden');
    try {
      enableTrigger("twofaSection");
      const res = await fetch("http://localhost:3000/api/me", { credentials: "include" });
      const data = await res.json();
      if (data.signedIn && data.user) {
        totp2faCheckbox.checked = data.user.totp_enabled;
      }
      if (data.user && data.user.method_sign == "google") {
        disableTrigger("twofaSection");
      }
    } catch (err) {
      console.error("Failed to refresh TOTP state:", err);
      totp2faCheckbox.checked = false;
    }
  }


  // Patch the open method to always update TOTP checkbox
  const originalOpen = settingWindow.open.bind(settingWindow);
  settingWindow.open = async () => {
    await refreshTotpState();
    originalOpen();
  };

  // Call once during init just in case
  refreshTotpState();


  // ✅ Enable/Disable TOTP 2FA
  totp2faCheckbox.addEventListener('change', async () => {
    if (!totp2faCheckbox.checked) {
      // ❌ Disable TOTP
      const res = await fetch('http://localhost:3000/api/2fa/disable-totp', {
        method: 'POST',
        credentials: 'include',
      });
      // const result = await res.json();
      // alert(result.message || 'TOTP disabled.');
      qrContainer.classList.add('hidden');
      return;
    }

    // ✅ Start TOTP setup
    const res = await fetch('http://localhost:3000/api/2fa/setup-totp', {
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
      const res = await fetch('http://localhost:3000/api/2fa/verify-totp', {
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