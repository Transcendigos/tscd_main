export function setupTournamentButtonBehavior(): void {
  const wrapper = document.getElementById("tournamentWrapper");
  const tournamentBtn = document.getElementById("tournamentBtn");
  const splitButtons = document.getElementById("splitButtons");

  
  
  if (!wrapper || !tournamentBtn || !splitButtons) return ;
  
  wrapper.addEventListener("mouseenter", () => {
    tournamentBtn.classList.add("hidden");
    splitButtons.classList.remove("hidden");
    console.log("--Mouse Enter Detected--");
  });

  wrapper.addEventListener("mouseleave", () => {
    tournamentBtn.classList.remove("hidden");
    splitButtons.classList.add("hidden");
  });

  const localBtn = splitButtons.children[0] as HTMLElement;
  const onlineBtn = splitButtons.children[1] as HTMLElement;

  localBtn.id = "localBtn";
  onlineBtn.id = "onlineBtn";

  localBtn.addEventListener("click", () => {
    document.getElementById("tournamentBtn")?.click(); // simule le clic
  });

  console.log("button behavior set");

  onlineBtn.addEventListener("click", () => {
    alert("Online Tournament: Coming Soon 👀");
  });
}

export function initPlayerCountSelection() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".player-count-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Réinitialiser tous les boutons : texte bleu
      buttons.forEach((b) => {
        b.classList.remove("text-green-400");
        b.classList.add("text-[#4cb4e7]");
      });

      // Activer le bouton cliqué : texte vert
      btn.classList.remove("text-[#4cb4e7]");
      btn.classList.add("text-green-400");
    });
  });
}

export function initReadyToggles() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".ready-toggle");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const isReady = btn.classList.contains("bg-green-400");

      if (isReady) {
        // Retour à l'état normal
        btn.classList.remove("bg-green-400", "text-white");
        btn.classList.add("bg-transparent", "text-[#4cb4e7]");
      } else {
        // Marquer comme prêt
        btn.classList.remove("bg-transparent", "text-[#4cb4e7]");
        btn.classList.add("bg-green-400", "text-white");
      }
    });
  });
}

