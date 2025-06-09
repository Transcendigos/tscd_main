import { DesktopWindow } from "./DesktopWindow";

export const tournamentData = {
  name: "",
  playerCount: 0,
  players: [] as { id: number; name: string }[],
};

/*----------MENU---------*/

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
    document.getElementById("tournamentBtn")?.click();
  });

  console.log("button behavior set");

  onlineBtn.addEventListener("click", () => {
    alert("Online Tournament: Coming Soon 👀");
  });
}


/*----------TOURNAMENT CREATION---------*/


export function initTournamentCreationLogic(tournamentCreationWindow, tournamentPlayersWindow) {
  const nameInput = document.getElementById("tournamentNameInput") as HTMLInputElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>(".player-count-btn");
  const createBtn = document.getElementById("tournamentPlayersBtn") as HTMLButtonElement;

  let selectedCount = 0;

  function updateCreateButtonState() {
    const nameFilled = nameInput.value.trim() !== "";
    const playersChosen = selectedCount > 0;

    if (nameFilled && playersChosen) {
      createBtn.disabled = false;
      createBtn.classList.remove("opacity-50", "cursor-not-allowed");
      createBtn.classList.add("hover:bg-green-400", "cursor-pointer");
    } else {
      createBtn.disabled = true;
      createBtn.classList.add("opacity-50", "cursor-not-allowed");
      createBtn.classList.remove("hover:bg-green-400", "cursor-pointer");
    }
  }

  nameInput.addEventListener("input", updateCreateButtonState);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("text-green-400");
        b.classList.add("text-[#4cb4e7]");
      });

      btn.classList.remove("text-[#4cb4e7]");
      btn.classList.add("text-green-400");
      selectedCount = parseInt(btn.textContent || "0", 10);

      updateCreateButtonState();
    });
  });

  createBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name || selectedCount === 0) return;

    tournamentData.name = name;
    tournamentData.playerCount = selectedCount;

    resetTournamentCreationWindow();
    tournamentCreationWindow.close();
    populatePlayerInputs("playerInputsContainer", tournamentPlayersWindow);
    console.log("Tournoi prêt :", tournamentData);

  });
  updateCreateButtonState();
}

export function resetTournamentCreationWindow() {
  const nameInput = document.getElementById("tournamentNameInput") as HTMLInputElement;
  if (nameInput) nameInput.value = "";

  const buttons = document.querySelectorAll<HTMLButtonElement>(".player-count-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("text-green-400");
    btn.classList.add("text-[#4cb4e7]");
  });

  // tournamentData.name = "";
  // tournamentData.playerCount = 0;

  const createBtn = document.getElementById("tournamentPlayersBtn") as HTMLButtonElement;
  if (createBtn) {
    createBtn.disabled = true;
    createBtn.classList.add("opacity-50", "cursor-not-allowed");
    createBtn.classList.remove("hover:bg-green-400", "cursor-pointer");
  }
}


/*----------PLAYERS NAME SELECTION---------*/


export function populatePlayerInputs(containerId: string, tournamentPlayersWindow: DesktopWindow) {
  const container = document.getElementById(containerId);
  if (!container) return; 

  container.innerHTML = ""; // clear previous content
  tournamentData.players = [];

  for (let i = 1; i <= tournamentData.playerCount; ++i) {
    const row = document.createElement("div");
    row.className = "participant-row flex items-center justify-between gap-2";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Player ${i}`;
    input.className = "participant-name flex-1 bg-slate-700 border border-[#4cb4e7]/50 rounded p-1";
    input.setAttribute("data-id", String(i));

    const button = document.createElement("button");
    button.textContent = "✓";
    button.disabled = true;
    button.className =
      "ready-toggle bg-transparent text-[#4cb4e7] border border-[#4cb4e7]/50 rounded px-2 py-1 opacity-50 cursor-not-allowed";

    row.appendChild(input);
    row.appendChild(button);
    container.appendChild(row);

    tournamentData.players.push({ id: i, name: "" });
  }

  initReadyToggles(tournamentPlayersWindow);
  initReadyInputsToggleControl();
}

export function initReadyToggles(tournamentPlayersWindow: DesktopWindow) {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".ready-toggle");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const isReady = btn.classList.contains("bg-green-400");

      if (isReady) {
        btn.classList.remove("bg-green-400", "text-white");
        btn.classList.add("bg-transparent", "text-[#4cb4e7]");
      } else {
        btn.classList.remove("bg-transparent", "text-[#4cb4e7]");
        btn.classList.add("bg-green-400", "text-white");
      }

      checkAllPlayersReadyAndShowNextWindow(tournamentPlayersWindow);
    });
  });
}

export function initReadyInputsToggleControl() {
  const rows = document.querySelectorAll<HTMLElement>(".participant-row");

  rows.forEach((row) => {
    const input = row.querySelector<HTMLInputElement>(".participant-name");
    const button = row.querySelector<HTMLButtonElement>(".ready-toggle");

    if (input && button) {
      input.addEventListener("input", () => {
        const name = input.value.trim();
        const id = Number(input.dataset.id);

        const player = tournamentData.players.find((p) => p.id === id);
        if (player) {
          player.name = name;
        }

        if (name !== "") {
          button.disabled = false;
          button.classList.remove("opacity-50", "cursor-not-allowed");
          button.classList.add("cursor-pointer");
        } else {
          button.disabled = true;
          button.classList.add("opacity-50", "cursor-not-allowed");
          button.classList.remove("cursor-pointer");

          button.classList.remove("bg-green-400", "text-white");
          button.classList.add("bg-transparent", "text-[#4cb4e7]");
        }
      });
    }
  });
}

export function checkAllPlayersReadyAndShowNextWindow(tournamentPlayersWindow: DesktopWindow) {
  const inputs = document.querySelectorAll<HTMLInputElement>(".participant-name");
  const toggles = document.querySelectorAll<HTMLButtonElement>(".ready-toggle");

  let allFilled = true;
  let allReady = true;

  inputs.forEach((input) => {
    if (input.value.trim() === "") {
      allFilled = false;
    }
  });

  toggles.forEach((btn) => {
    if (!btn.classList.contains("bg-green-400")) {
      allReady = false;
    }
  });

  if (allFilled && allReady) {
    const nextWin = document.getElementById("tournamentWindow");

    if (nextWin) {
    resetTournamentPlayersWindow();
    tournamentPlayersWindow.close();

    nextWin.classList.remove("opacity-0", "scale-95", "invisible", "pointer-events-none");
    nextWin.style.zIndex = "999";
    console.log(tournamentData);
    console.log(tournamentData.players);
  }
  }
}

export function resetTournamentPlayersWindow() {
  const rows = document.querySelectorAll<HTMLElement>(".participant-row");

  rows.forEach((row) => {
    const input = row.querySelector<HTMLInputElement>(".participant-name");
    const button = row.querySelector<HTMLButtonElement>(".ready-toggle");

    if (input) input.value = "";

    if (button) {
      button.disabled = true;
      button.classList.add("opacity-50", "cursor-not-allowed");
      button.classList.remove("cursor-pointer");
      button.classList.remove("bg-green-400", "text-white");
      button.classList.add("bg-transparent", "text-[#4cb4e7]");
    }
  });
}
