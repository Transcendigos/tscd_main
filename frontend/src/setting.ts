import { DesktopWindow } from "./DesktopWindow.js";

export function setupSettingForm(settingWindow: DesktopWindow) {
  const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;
  const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
  const qrCodeImage = document.getElementById('qrCodeImage') as HTMLImageElement;
  const verifyTotpInput = document.getElementById('verifyTotpInput') as HTMLInputElement;
  const confirmTotpButton = document.getElementById('confirmTotpButton') as HTMLButtonElement;
  const statusMsg = document.getElementById('totpStatus') as HTMLParagraphElement;

  async function refreshTotpState() {
    console.log("Refreshing TOTP state");
    qrContainer.classList.add('hidden');
    try {
      const res = await fetch("http://localhost:3000/api/me", { credentials: "include" });
      const data = await res.json();
      if (data.signedIn && data.user) {
        totp2faCheckbox.checked = data.user.totp_enabled;
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
      statusMsg.classList.remove('text-red-500');
      statusMsg.classList.add('text-green-500');
      setTimeout(() => {
        qrContainer.classList.add('hidden');
        statusMsg.textContent = '';
      }, 1500);

    } catch (err) {
      // 👇 You will see any backend-provided error here
      console.error("❌ TOTP verification failed:", err);
      statusMsg.textContent = err.message || 'TOTP verification failed';
      statusMsg.classList.remove('text-green-500');
      statusMsg.classList.add('text-red-500');
    }
  });
}