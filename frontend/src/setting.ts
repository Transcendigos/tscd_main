import { DesktopWindow } from "./DesktopWindow.js";

export function setupSettingForm(settingWindow: DesktopWindow) {
  const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;
  const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
  const qrCodeImage = document.getElementById('qrCodeImage') as HTMLImageElement;
  const verifyTotpInput = document.getElementById('verifyTotpInput') as HTMLInputElement;
  const confirmTotpButton = document.getElementById('confirmTotpButton') as HTMLButtonElement;
  const statusMsg = document.getElementById('totpStatus') as HTMLParagraphElement;


  function disableTrigger(triggerId: string) {
    const el = document.getElementById(triggerId);
    if (el) {
      el.classList.add("opacity-50", "cursor-not-allowed", "select-none");
      el.classList.remove("hover-important", "cursor-default");

      // Désactiver tous les <input> enfants
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
      el.classList.add("hover-important", "cursor-default");

      // Désactiver tous les <input> enfants
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
      statusMsg.textContent = '';
    }
  });

  // ✅ Confirm TOTP 6-digit input
  confirmTotpButton.addEventListener('click', async () => {
    const token = verifyTotpInput.value;
    const secret = qrCodeImage.dataset.secret || '';
    statusMsg.textContent = ''; // clear previous

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
      statusMsg.textContent = data.message;
      statusMsg.classList.remove('text-[#D4535B]');
      statusMsg.classList.add('text-[#53D4C0]');
      setTimeout(() => {
        qrContainer.classList.add('hidden');
        statusMsg.textContent = '';
      }, 1500);

    } catch (err) {
      // 👇 You will see any backend-provided error here
      console.error("❌ TOTP verification failed:", err);
      statusMsg.textContent = err.message || 'TOTP verification failed';
      statusMsg.classList.remove('text-[#53D4C0]');
      statusMsg.classList.add('text-[#D4535B]');

    }
  });
}