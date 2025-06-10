import { DesktopWindow } from "./DesktopWindow";

export const tournamentData = {
  name: "",
  playerCount: 0,
  players: [] as { id: number; name: string }[],
  matches: [] as {
    id: string;
    player1: { id: number; name: string } | null;
    player2: { id: number; name: string } | null;
    winner: { id: number; name: string } | null;
    round: number;
    matchNumberInRound: number;
    played: boolean;
  }[],
  currentMatchIndex: 0,
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

  onlineBtn.addEventListener("click", () => {
    alert("Online Tournament: Coming Soon 👀");
  });
}


/*----------TOURNAMENT CREATION---------*/


export function initTournamentCreationLogic(tournamentCreationWindow: DesktopWindow, tournamentPlayersWindow: DesktopWindow) {
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

    initTournamentWindow();
    nextWin.classList.remove("opacity-0", "scale-95", "invisible", "pointer-events-none");
    nextWin.style.zIndex = "999";
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


/*----------TOURNAMENT WINDOW---------*/

export function resetTournamentWindow() {
  tournamentData.name = "";
  tournamentData.playerCount = 0;
  tournamentData.players = [];
  tournamentData.matches = [];
  tournamentData.currentMatchIndex = 0;

  const tournamentNameElem = document.getElementById("tournamentName");
  const tournamentBracketContainer = document.getElementById("tournamentBracketContainer");
  const nextMatchButtonContainer = document.getElementById("nextMatchButtonContainer");
  const nextMatchButton = document.getElementById("nextMatchButton") as HTMLButtonElement;
  const player1NameSpan = document.getElementById("player1Name") as HTMLElement;
  const player2NameSpan = document.getElementById("player2Name") as HTMLElement;
  const finalWinnerDisplay = document.getElementById("finalWinnerDisplay") as HTMLElement;
  const launchTournamentBtn = document.getElementById("launchTournamentBtn") as HTMLButtonElement;


  if (tournamentNameElem) tournamentNameElem.innerHTML = "";
  if (tournamentBracketContainer) tournamentBracketContainer.innerHTML = "";
  if (nextMatchButtonContainer) nextMatchButtonContainer.classList.add("hidden");
  if (player1NameSpan) player1NameSpan.textContent = "";
  if (player2NameSpan) player2NameSpan.textContent = "";
  if (finalWinnerDisplay) finalWinnerDisplay.classList.add("hidden");
  if (launchTournamentBtn) {
    launchTournamentBtn.classList.remove("hidden"); // Assure qu'il est visible pour le prochain tournoi
    launchTournamentBtn.textContent = "Lancer le Tournoi";
    launchTournamentBtn.classList.remove("bg-red-700", "hover:bg-red-900");
    launchTournamentBtn.classList.add("bg-[#4cb4e7]", "hover:bg-green-400");
    launchTournamentBtn.disabled = true; // Désactivé par défaut
    launchTournamentBtn.classList.add("opacity-50", "cursor-not-allowed");
  }
  // Réinitialise le gros bouton "Prochain Match" à son état initial (non modifié en "Fermer")
  if (nextMatchButton) {
    nextMatchButton.textContent = "Lancer le prochain Match"; // Texte par défaut
    nextMatchButton.classList.remove("bg-red-700", "hover:bg-red-900");
    nextMatchButton.classList.add("bg-[#4cb4e7]", "hover:bg-green-400");
    nextMatchButton.disabled = false; // Réactive-le si besoin, bien que le container soit caché
    nextMatchButton.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

function generateMatches(players: { id: number; name: string }[]): typeof tournamentData.matches {
  const shuffledPlayers = [...players].sort(() => 0.5 - Math.random()); // Shuffle players
  const numPlayers = shuffledPlayers.length;
  let currentMatches: typeof tournamentData.matches = [];
  let round = 1;
  let matchIdCounter = 0;

  // Validate player count to be 4 or 8
  if (numPlayers !== 4 && numPlayers !== 8) {
      console.error("Nombre de joueurs invalide pour l'arbre de tournoi. Seuls 4 ou 8 joueurs sont supportés.");
      return []; // Return empty array if invalid player count
  }

  // Ensure power of 2 for players by adding BYEs if necessary
  let playersForBracket = [...shuffledPlayers];
  const nextPowerOf2 = numPlayers; // It will always be 4 or 8 here
  while (playersForBracket.length < nextPowerOf2) {
      playersForBracket.push({ id: -1, name: "BYE" });
  }

  // Initial Round (Round 1)
  for (let i = 0; i < playersForBracket.length; i += 2) {
    const player1 = playersForBracket[i];
    const player2 = playersForBracket[i + 1] || null;

    currentMatches.push({
      id: `match-${round}-${++matchIdCounter}`,
      player1: player1,
      player2: player2,
      winner: null,
      round: round,
      matchNumberInRound: matchIdCounter,
      played: false,
    });
  }

  // Generate subsequent rounds (empty matches)
  let prevRoundMatchCount = currentMatches.length;
  while (prevRoundMatchCount > 1) {
    round++;
    matchIdCounter = 0;
    for (let i = 0; i < prevRoundMatchCount / 2; i++) {
      currentMatches.push({
        id: `match-${round}-${++matchIdCounter}`,
        player1: null, // To be filled by winners of previous round
        player2: null,
        winner: null,
        round: round,
        matchNumberInRound: matchIdCounter,
        played: false,
      });
    }
    prevRoundMatchCount /= 2;
  }
  return currentMatches;
}

function updateNextMatchButton(launchTournamentBtn: HTMLButtonElement, nextMatchButtonContainer: HTMLElement, nextMatchButton: HTMLButtonElement, player1NameSpan: HTMLElement, player2NameSpan: HTMLElement, finalWinnerDisplay: HTMLElement, closetournamentBtn: HTMLElement) {
  // Find the next unplayed match where both players are known
  let nextMatch: (typeof tournamentData.matches[0]) | null = null;
  for (let i = tournamentData.currentMatchIndex; i < tournamentData.matches.length; i++) {
    const match = tournamentData.matches[i];
    // Ensure both players are defined AND the match has not been played
    if (!match.played && match.player1 && match.player2) {
      nextMatch = match;
      tournamentData.currentMatchIndex = i; // Update currentMatchIndex to this match
      break;
    } else if (!match.played && (!match.player1 || !match.player2)) {
        // This match is waiting for previous round winners. We cannot determine the next playable match yet.
        nextMatch = null;
        break;
    }
  }

  if (nextMatch) {
    // Un match est en cours ou prêt à être joué
    player1NameSpan.textContent = nextMatch.player1!.name;
    player2NameSpan.textContent = (nextMatch.player2!.name === "BYE") ? "(BYE)" : nextMatch.player2!.name;
    nextMatchButton.disabled = false;
    nextMatchButton.classList.remove("opacity-50", "cursor-not-allowed");
    nextMatchButton.classList.add("hover:bg-green-400", "cursor-pointer");
    nextMatchButtonContainer.classList.remove("hidden"); // Affiche le gros bouton de match (Prochain Match)
    
    // Le bouton "Lancer le Tournoi" doit être caché si un match est prêt
    launchTournamentBtn.classList.add("hidden"); 
    finalWinnerDisplay.classList.add("hidden"); // Cache le vainqueur final

    // Réinitialise le gros bouton "Prochain Match" à son état de "lancement de match"
    nextMatchButton.textContent = "Lancer le prochain Match";
    nextMatchButton.classList.remove("bg-red-700", "hover:bg-red-900");
    nextMatchButton.classList.add("bg-[#4cb4e7]", "hover:bg-green-400");
    // L'onclick sera géré par l'écouteur principal qui est défini une seule fois pour nextMatchButton.

  } else if (tournamentData.matches.every(m => m.played)) {
    // Tous les matchs ont été joués, tournoi terminé
    nextMatchButtonContainer.classList.remove("hidden"); // Garde le conteneur du gros bouton visible
    
    // Transforme nextMatchButton (le gros bouton) en bouton de fermeture
    nextMatchButton.textContent = "Fermer la fenêtre"; // Change le texte
    nextMatchButton.classList.remove("bg-[#4cb4e7]", "hover:bg-green-400"); // Retire les styles de lancement
    nextMatchButton.classList.add("bg-red-700", "hover:bg-red-900"); // Ajoute le style de fermeture
    nextMatchButton.disabled = false;
    nextMatchButton.classList.remove("opacity-50", "cursor-not-allowed");
    nextMatchButton.onclick = () => {
      resetTournamentWindow(); // Réinitialise le tournoi AVANT de fermer
      closetournamentBtn.click(); // Ferme la fenêtre
    };

    launchTournamentBtn.classList.add("hidden"); // S'assure que le bouton "Lancer le Tournoi" est caché
    
    finalWinnerDisplay.classList.remove("hidden"); // Affiche le vainqueur final
    const finalMatch = tournamentData.matches[tournamentData.matches.length - 1];
    if (finalMatch && finalMatch.winner) {
        finalWinnerDisplay.textContent = `${finalMatch.winner.name}`;
    }
  } else {
    // Aucun match immédiatement jouable (tournoi initialisé mais pas "lancé" ou en attente de joueurs)
    nextMatchButtonContainer.classList.add("hidden"); // Cache le gros bouton de match
    
    // Le bouton "Lancer le Tournoi" est visible et à droite
    launchTournamentBtn.classList.remove("hidden"); 
    
    // S'assure que launchTournamentBtn est enabled s'il y a des joueurs mais aucun match n'a commencé
    if (tournamentData.playerCount > 0 && tournamentData.matches.length > 0) {
        launchTournamentBtn.disabled = false;
        launchTournamentBtn.classList.remove("opacity-50", "cursor-not-allowed");
        launchTournamentBtn.classList.add("hover:bg-green-400", "cursor-pointer");
    } else {
        launchTournamentBtn.disabled = true;
        launchTournamentBtn.classList.add("opacity-50", "cursor-not-allowed");
        launchTournamentBtn.classList.remove("hover:bg-green-400", "cursor-pointer");
    }
    
    // Réinitialise l'action du bouton "Lancer le Tournoi"
    launchTournamentBtn.textContent = "Lancer le Tournoi";
    launchTournamentBtn.classList.remove("bg-red-700", "hover:bg-red-900");
    launchTournamentBtn.classList.add("bg-[#4cb4e7]", "hover:bg-green-400");
    launchTournamentBtn.onclick = () => updateNextMatchButton(launchTournamentBtn, nextMatchButtonContainer, nextMatchButton, player1NameSpan, player2NameSpan, finalWinnerDisplay, closetournamentBtn); // Redéfinit son action de lancement
    
    finalWinnerDisplay.classList.add("hidden"); // Cache le vainqueur final
  }
}

export function initTournamentWindow() {
  const tournamentNameElem = document.getElementById("tournamentName");
  const tournamentBracketContainer = document.getElementById("tournamentBracketContainer");
  const launchTournamentBtn = document.getElementById("launchTournamentBtn") as HTMLButtonElement;
  const nextMatchButton = document.getElementById("nextMatchButton") as HTMLButtonElement;
  const nextMatchButtonContainer = document.getElementById("nextMatchButtonContainer");
  const player1NameSpan = document.getElementById("player1Name") as HTMLElement;
  const player2NameSpan = document.getElementById("player2Name") as HTMLElement;
  const finalWinnerDisplay = document.getElementById("finalWinnerDisplay") as HTMLElement;
  const closetournamentBtn = document.getElementById("closetournamentBtn") as HTMLElement;

  if (!tournamentNameElem || !tournamentBracketContainer || !launchTournamentBtn || !nextMatchButton || !nextMatchButtonContainer || !player1NameSpan || !player2NameSpan || !finalWinnerDisplay || !closetournamentBtn) {
    console.error("One or more tournament window elements not found.");
    return;
  }

  tournamentNameElem.innerHTML = tournamentData.name;
  tournamentBracketContainer.innerHTML = "";


  if (tournamentData.playerCount !== 4 && tournamentData.playerCount !== 8) {
      tournamentNameElem.innerHTML = `${tournamentData.name || "Tournoi"}`;
      tournamentBracketContainer.innerHTML = `
        <p class="text-center text-red-400 p-4">
            Pour un arbre de tournoi complet, veuillez choisir 4 ou 8 joueurs.
            Vous avez sélectionné ${tournamentData.playerCount} joueurs.
        </p>
      `;
      launchTournamentBtn.disabled = true;
      launchTournamentBtn.classList.add("opacity-50", "cursor-not-allowed");
      nextMatchButtonContainer.classList.add("hidden");
      return;
  }

  if (tournamentData.players.length > 0) {
    tournamentData.matches = generateMatches(tournamentData.players);
  } else {
    tournamentNameElem.innerHTML = "Aucun tournoi créé.";
    tournamentBracketContainer.innerHTML = '<p class="text-center italic text-slate-400 p-4">Veuillez créer un tournoi pour voir l\'arbre.</p>';
    launchTournamentBtn.disabled = true;
    launchTournamentBtn.classList.add("opacity-50", "cursor-not-allowed");
    nextMatchButtonContainer.classList.add("hidden");
    return;
  }

  const roundsMap = new Map<number, HTMLElement>();
  let maxRound = 0;
  tournamentData.matches.forEach(match => {
    if (match.round > maxRound) maxRound = match.round;

    if (!roundsMap.has(match.round)) {
      const roundColumn = document.createElement("div");
      roundColumn.className = "flex flex-col items-center justify-around mx-2 py-4 flex-shrink-0";
      const roundTitle = document.createElement("h3");
      roundTitle.className = "text-md font-bold mb-4 whitespace-nowrap";
      roundTitle.textContent = `Ronde ${match.round}`;
      roundColumn.appendChild(roundTitle);
      tournamentBracketContainer.appendChild(roundColumn);
      roundsMap.set(match.round, roundColumn);
    }

    const roundColumn = roundsMap.get(match.round);
    if (roundColumn) {
      const matchDiv = document.createElement("div");
      matchDiv.id = match.id;
      matchDiv.className = "flex flex-col p-2 border border-[#4cb4e7]/50 rounded text-center min-w-[120px]";

      const verticalGapClass = match.round === 1 ? 'my-2' : 'my-4';
      matchDiv.classList.add(verticalGapClass);

      if (match.player1 && match.player2) {
          matchDiv.innerHTML = `
            <span class="text-sm font-semibold">${match.player1.name}</span>
            <span class="text-sm">vs ${match.player2.name === "BYE" ? "(BYE)" : match.player2.name}</span>
          `;
      } else {
          matchDiv.innerHTML = `
            <span class="text-sm">En attente...</span>
            <span class="text-sm">En attente...</span>
          `;
      }
      roundColumn.appendChild(matchDiv);
    }
  });

  roundsMap.forEach((column, roundNum) => {
      const titleElem = column.querySelector('h3');
      if (titleElem) {
          if (maxRound === 2 && roundNum === 1) {
              titleElem.textContent = "Demi-finales";
          } else if (maxRound === 3 && roundNum === 1) {
              titleElem.textContent = "Quarts de finale";
          } else if (maxRound === 2 && roundNum === 2) {
              titleElem.textContent = "Finale";
          } else if (maxRound === 3 && roundNum === 2) {
              titleElem.textContent = "Demi-finales";
          } else if (maxRound === 3 && roundNum === 3) {
              titleElem.textContent = "Finale";
          } else {
              titleElem.textContent = `Ronde ${roundNum}`;
          }
      }
  });

  let finalWinnerColumn = tournamentBracketContainer.querySelector('.final-winner-column');
  if (!finalWinnerColumn) {
      finalWinnerColumn = document.createElement("div");
      finalWinnerColumn.className = "final-winner-column flex flex-col items-center justify-center mx-2 py-4 flex-shrink-0";
      const finalWinnerTitle = document.createElement("h3");
      finalWinnerTitle.className = "text-md font-bold mb-4 whitespace-nowrap";
      finalWinnerTitle.textContent = "Vainqueur";
      finalWinnerColumn.appendChild(finalWinnerTitle);
      finalWinnerColumn.appendChild(finalWinnerDisplay);
      tournamentBracketContainer.appendChild(finalWinnerColumn);
  }

  launchTournamentBtn.onclick = () => updateNextMatchButton(launchTournamentBtn, nextMatchButtonContainer, nextMatchButton, player1NameSpan, player2NameSpan, finalWinnerDisplay, closetournamentBtn);

  nextMatchButton.onclick = () => {
    const currentMatch = tournamentData.matches[tournamentData.currentMatchIndex];
    if (currentMatch && currentMatch.player1 && currentMatch.player2 && !tournamentData.matches.every(m => m.played)) {
        if (currentMatch.player2.name === "BYE") {
            currentMatch.played = true;
            currentMatch.winner = currentMatch.player1;
            const matchDiv = document.getElementById(currentMatch.id);
            if (matchDiv) {
                matchDiv.classList.add("bg-green-700/50");
                matchDiv.innerHTML = `
                  <span class="text-sm font-bold">${currentMatch.player1.name}</span>
                  <span class="text-sm font-bold">(BYE)</span>
                  <span class="text-xs mt-1">Avance: ${currentMatch.winner.name}</span>
                `;
            }
            const nextRoundMatchForBye = tournamentData.matches.find(m =>
              m.round === currentMatch.round + 1 &&
              (m.matchNumberInRound === Math.ceil(currentMatch.matchNumberInRound / 2))
            );

            if (nextRoundMatchForBye) {
                if (currentMatch.matchNumberInRound % 2 !== 0) {
                    nextRoundMatchForBye.player1 = currentMatch.winner;
                } else {
                    nextRoundMatchForBye.player2 = currentMatch.winner;
                }
                const nextMatchDivForBye = document.getElementById(nextRoundMatchForBye.id);
                if (nextMatchDivForBye) {
                    nextMatchDivForBye.innerHTML = `
                          <span class="text-sm font-semibold">${nextRoundMatchForBye.player1 ? nextRoundMatchForBye.player1.name : 'En attente...'}</span>
                          <span class="text-sm">vs ${nextRoundMatchForBye.player2 ? nextRoundMatchForBye.player2.name : 'En attente...'}</span>
                        `;
                }
            }
        } else {
            currentMatch.played = true;
            currentMatch.winner = Math.random() > 0.5 ? currentMatch.player1 : currentMatch.player2;

            const matchDiv = document.getElementById(currentMatch.id);
            if (matchDiv) {
                matchDiv.classList.add("bg-green-700/50");
                matchDiv.innerHTML = `
                  <span class="text-sm font-bold">${currentMatch.player1.name}</span>
                  <span class="text-sm font-bold">vs ${currentMatch.player2.name}</span>
                  <span class="text-xs mt-1">Vainqueur: ${currentMatch.winner.name}</span>
                `;
            }

            const nextRoundMatch = tournamentData.matches.find(m =>
              m.round === currentMatch.round + 1 &&
              (m.matchNumberInRound === Math.ceil(currentMatch.matchNumberInRound / 2))
            );

            if (nextRoundMatch) {
                if (currentMatch.matchNumberInRound % 2 !== 0) {
                    nextRoundMatch.player1 = currentMatch.winner;
                } else {
                    nextRoundMatch.player2 = currentMatch.winner;
                }
                const nextMatchDiv = document.getElementById(nextRoundMatch.id);
                if (nextMatchDiv) {
                    nextMatchDiv.innerHTML = `
                          <span class="text-sm font-semibold">${nextRoundMatch.player1 ? nextRoundMatch.player1.name : 'En attente...'}</span>
                          <span class="text-sm">vs ${nextRoundMatch.player2 ? nextRoundMatch.player2.name : 'En attente...'}</span>
                        `;
                }
            }
        }
    } else if (tournamentData.matches.every(m => m.played)) {
        closetournamentBtn.click();
    }
    updateNextMatchButton(launchTournamentBtn, nextMatchButtonContainer, nextMatchButton, player1NameSpan, player2NameSpan, finalWinnerDisplay, closetournamentBtn);
  };

  updateNextMatchButton(launchTournamentBtn, nextMatchButtonContainer, nextMatchButton, player1NameSpan, player2NameSpan, finalWinnerDisplay, closetournamentBtn);
}
