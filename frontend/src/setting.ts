export function setupSettingForm() {
  const email2faCheckbox = document.getElementById('email2faCheckbox') as HTMLInputElement;
  const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;
  const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
  const qrCodeImage = document.getElementById('qrCodeImage') as HTMLImageElement;
  const verifyTotpInput = document.getElementById('verifyTotpInput') as HTMLInputElement;
  const confirmTotpButton = document.getElementById('confirmTotpButton') as HTMLButtonElement;
  const statusMsg = document.getElementById('totpStatus') as HTMLParagraphElement;

  // ✅ Load current 2FA status from server
  (async () => {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();
    if (data.signedIn && data.user) {
      email2faCheckbox.checked = data.user.email_enabled;
      totp2faCheckbox.checked = data.user.totp_enabled;
    }
  })();

  // ✅ Enable/Disable Email 2FA
  email2faCheckbox.addEventListener('change', async () => {
    const enable = email2faCheckbox.checked;
    const res = await fetch('/api/2fa/enable-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enable }),
    });

    const result = await res.json();
    alert(result.message || 'Email 2FA updated.');
  });

  // ✅ Enable/Disable TOTP 2FA
  totp2faCheckbox.addEventListener('change', async () => {
    if (!totp2faCheckbox.checked) {
      // ❌ Disable TOTP
      const res = await fetch('/api/2fa/disable-totp', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await res.json();
      alert(result.message || 'TOTP disabled.');
      qrContainer.classList.add('hidden');
      return;
    }

    // ✅ Start TOTP setup
    const res = await fetch('/api/2fa/setup-totp', {
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

    const res = await fetch('/api/2fa/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, secret }),
    });

    const data = await res.json();
    if (data.message) {
      statusMsg.textContent = '✅ TOTP enabled!';
      statusMsg.classList.remove('text-red-500');
      statusMsg.classList.add('text-green-500');
    } else {
      statusMsg.textContent = data.error || 'Failed to verify TOTP code.';
      statusMsg.classList.remove('text-green-500');
      statusMsg.classList.add('text-red-500');
    }
  });
}