export function setupAvatarCanvas() {
  const canvas = document.getElementById("avatarCanvas") as HTMLCanvasElement | null;
  const clearBtn = document.getElementById("clearAvatarBtn");
  const saveBtn = document.getElementById("saveAvatarBtn");

  if (!canvas || !clearBtn || !saveBtn) {
    console.warn("Canvas/avatar buttons not found in DOM.");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let drawing = false;

  canvas.addEventListener("mousedown", () => {
    drawing = true;
    ctx.beginPath();
  });

  canvas.addEventListener("mouseup", () => {
    drawing = false;
    ctx.closePath();
  });

  canvas.addEventListener("mouseleave", () => {
    drawing = false;
    ctx.closePath();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  saveBtn.addEventListener("click", () => {
    const dataURL = canvas.toDataURL("image/png");
    fetch("/api/users/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: dataURL })
    })
    .then((res) => {
      if (!res.ok) throw new Error("Upload failed");
      const img = document.getElementById("profileAvatarImg") as HTMLImageElement;
      if (img) {
        img.src = `/uploads/avatars/42.png?${Date.now()}`; // force reload via timestamp
      }
      alert("Avatar sauvegardé !");
    })
    .catch((err) => {
      console.error("Erreur upload avatar :", err);
      alert("Erreur lors de l’envoi de l’avatar");
    });
  });
}

const img = document.getElementById("profileAvatarImg") as HTMLImageElement;
if (img) {
  img.src = `/uploads/avatars/42.png?${Date.now()}`; // empêche le cache navigateur
}


export function loadAvatarPreview(userId: number = 42) {
	const img = document.getElementById("profileAvatarImg") as HTMLImageElement;
	if (img) {
		// Nettoie l’image précédente (évite accumulation mémoire dans certains navigateurs)
		img.removeAttribute("src");
		// Recharge depuis le backend
		img.src = `http://localhost:3000/uploads/avatars/${userId}.png?${Date.now()}`;
	}
}

