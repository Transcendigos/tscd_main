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
  }[],
  isFinished: false,
};

// --- Helper function for delays ---
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Match Simulation Logic ---
/**
 * Simulates a match between two players and returns the winner.
 */
function launchMatch(
    player1: { id: number; name: string }, 
    player2: { id: number; name: string }
): { id: number; name: string } {
    return Math.random() > 0.5 ? player1 : player2;
}

/**
 * Automatically simulates all rounds of the tournament.
 */
async function simulateTournament() {
    const totalRounds = Math.max(0, ...tournamentData.matches.map(m => m.round));

    for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
        const currentRoundMatches = tournamentData.matches.filter(m => m.round === roundNum);
        
        for (const match of currentRoundMatches) {
            if (match.player1 && match.player2) {
                await delay(1000); // 1-second delay

                match.winner = launchMatch(match.player1, match.player2);

                if (roundNum < totalRounds) {
                    const nextRound = match.round + 1;
                    const matchIndexInRound = tournamentData.matches.filter(m => m.round === match.round).indexOf(match);
                    const nextMatchInNextRound = tournamentData.matches.find(m => 
                        m.round === nextRound && 
                        Math.floor(matchIndexInRound / 2) === tournamentData.matches.filter(mx => mx.round === nextRound).indexOf(m)
                    );

                    if (nextMatchInNextRound) {
                        if (matchIndexInRound % 2 === 0) {
                            nextMatchInNextRound.player1 = match.winner;
                        } else {
                            nextMatchInNextRound.player2 = match.winner;
                        }
                    }
                }
                
                renderBracket();
            }
        }
    }

    tournamentData.isFinished = true;
    await delay(500);
    displayFinalWinner();
}

/**
 * Displays the final winner message and the close button.
 */
function displayFinalWinner() {
    const endScreen = document.getElementById("tournamentEndScreen") as HTMLElement;
    const winnerMessage = document.getElementById("finalWinnerMessage") as HTMLElement;
    const closeBtn = document.getElementById("closeTournamentEndBtn") as HTMLButtonElement;
    
    const finalWinner = tournamentData.matches[tournamentData.matches.length - 1].winner;

    if (endScreen && winnerMessage && closeBtn && finalWinner) {
        winnerMessage.textContent = `🏆 ${finalWinner.name} is the champion! 🏆`;
        endScreen.classList.remove("hidden");

        // Set the onclick for the new red close button
        closeBtn.onclick = () => {
            // Programmatically click the main window's close button
            document.getElementById("closetournamentBtn")?.click();
        };
    }
}


// --- Logique du Menu Principal ---
export function setupTournamentButtonBehavior(): void {
  const wrapper = document.getElementById("tournamentWrapper");
  const tournamentBtn = document.getElementById("tournamentBtn");
  const splitButtons = document.getElementById("splitButtons");

  if (!wrapper || !tournamentBtn || !splitButtons) return;

  wrapper.addEventListener("mouseenter", () => {
    tournamentBtn.classList.add("hidden");
    splitButtons.classList.remove("hidden");
  });

  wrapper.addEventListener("mouseleave", () => {
    tournamentBtn.classList.remove("hidden");
    splitButtons.classList.add("hidden");
  });

  (splitButtons.children[0] as HTMLElement).id = "tournamentLocalBtn";
  (splitButtons.children[1] as HTMLElement).id = "tournamentOnlineBtn";
}

// --- Fenêtre 1: Création ---
export function initTournamentCreationLogic(creationWin: DesktopWindow, playersWin: DesktopWindow, tournamentWin: DesktopWindow) {
  const nameInput = document.getElementById("tournamentNameInput") as HTMLInputElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>(".player-count-btn");
  const createBtn = document.getElementById("tournamentPlayersBtn") as HTMLButtonElement;
  let selectedCount = 0;

  function updateCreateButtonState() {
    const isReady = nameInput.value.trim() !== "" && selectedCount > 0;
    createBtn.disabled = !isReady;
    createBtn.classList.toggle("opacity-50", !isReady);
    createBtn.classList.toggle("cursor-not-allowed", !isReady);
  }

  nameInput.addEventListener("input", updateCreateButtonState);
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("text-green-400"));
      btn.classList.add("text-green-400");
      selectedCount = parseInt(btn.textContent!, 10);
      updateCreateButtonState();
    });
  });

  createBtn.addEventListener("click", () => {
    tournamentData.name = nameInput.value.trim();
    tournamentData.playerCount = selectedCount;
    creationWin.close();
    playersWin.open();
    populatePlayerInputs(playersWin, tournamentWin);
  });
}

// --- Fenêtre 2: Joueurs (avec Ready-check) ---
function populatePlayerInputs(playersWin: DesktopWindow, tournamentWin: DesktopWindow) {
  const container = document.getElementById("playerInputsContainer");
  if (!container) return;
  container.innerHTML = "";
  
  for (let i = 1; i <= tournamentData.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "participant-row flex items-center justify-between gap-2";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Joueur ${i}`;
    input.className = "participant-name flex-1 bg-slate-700 border border-[#4cb4e7]/50 rounded p-1";
    input.dataset.id = String(i);

    const button = document.createElement("button");
    button.textContent = "✓";
    button.disabled = true;
    button.className = "ready-toggle bg-transparent text-[#4cb4e7] border border-[#4cb4e7]/50 rounded px-2 py-1 opacity-50 cursor-not-allowed";

    row.appendChild(input);
    row.appendChild(button);
    container.appendChild(row);

    input.addEventListener("input", () => {
        if(input.value.trim() !== "") {
            button.disabled = false;
            button.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
            button.disabled = true;
            button.classList.add("opacity-50", "cursor-not-allowed");
            button.classList.remove("bg-green-400", "text-white");
            button.classList.add("bg-transparent", "text-[#4cb4e7]");
        }
    });

    button.addEventListener("click", () => {
        const isReady = button.classList.contains("bg-green-400");
        if (isReady) {
            button.classList.remove("bg-green-400", "text-white");
            button.classList.add("bg-transparent", "text-[#4cb4e7]");
        } else {
            button.classList.remove("bg-transparent", "text-[#4cb4e7]");
            button.classList.add("bg-green-400", "text-white");
        }
        checkAllPlayersReady(playersWin, tournamentWin);
    });
  }
}

function checkAllPlayersReady(playersWin: DesktopWindow, tournamentWin: DesktopWindow) {
    const toggles = document.querySelectorAll(".ready-toggle");
    const allReady = Array.from(toggles).every(btn => btn.classList.contains("bg-green-400"));

    if (allReady) {
        const inputs = document.querySelectorAll<HTMLInputElement>(".participant-name");
        tournamentData.players = Array.from(inputs).map(i => ({ id: Number(i.dataset.id), name: i.value.trim() }));
        playersWin.close();
        tournamentWin.open();
        initTournamentDisplay();
    }
}

// --- Fenêtre 3: Tournoi ---
export function resetTournamentData() {
    tournamentData.name = "";
    tournamentData.playerCount = 0;
    tournamentData.players = [];
    tournamentData.matches = [];
    tournamentData.isFinished = false;
    resetTournamentUI();
}

/**
 * Resets the tournament window UI to its initial state.
 */
function resetTournamentUI() {
    const nameElem = document.getElementById("tournamentName");
    const bracketContainer = document.getElementById("tournamentBracketContainer");
    const endScreen = document.getElementById("tournamentEndScreen");
    
    if(nameElem) nameElem.textContent = "Tournoi";
    if(bracketContainer) bracketContainer.innerHTML = "";
    if(endScreen) endScreen.classList.add("hidden");
}

function generateMatches(players: { id: number; name: string }[]) {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const matches: typeof tournamentData.matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        matches.push({ id: `r1m${i/2}`, player1: shuffled[i], player2: shuffled[i+1], winner: null, round: 1 });
    }

    let lastRoundCount = matches.length;
    let round = 2;
    while (lastRoundCount > 1) {
        for (let i = 0; i < lastRoundCount / 2; i++) {
            matches.push({ id: `r${round}m${i}`, player1: null, player2: null, winner: null, round: round });
        }
        lastRoundCount /= 2;
        round++;
    }
    return matches;
}

function renderBracket() {
    const container = document.getElementById("tournamentBracketContainer");
    if(!container) return;
    container.innerHTML = "";
    const rounds = Math.max(0, ...tournamentData.matches.map(m => m.round));
    for(let i = 1; i <= rounds; i++) {
        const roundColumn = document.createElement('div');
        roundColumn.className = "flex flex-col justify-around p-4";
        roundColumn.innerHTML = `<h3 class="text-center font-bold mb-4">Round ${i}</h3>`;
        const roundMatches = tournamentData.matches.filter(m => m.round === i);
        roundMatches.forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.id = match.id;
            matchDiv.className = "border p-2 m-2 min-w-[150px] text-center rounded-lg transition-colors duration-500";
            if(match.winner) {
                matchDiv.classList.add("bg-green-900/50");
            }
            matchDiv.innerHTML = `<div>${match.player1?.name||"..."}</div><div class="text-xs my-1">vs</div><div>${match.player2?.name||"..."}</div>${match.winner?`<div class="text-xs mt-1 pt-1 border-t">Gagnant: ${match.winner.name}</div>`:''}`;
            roundColumn.appendChild(matchDiv);
        });
        container.appendChild(roundColumn);
    }
}

/**
 * Initializes the tournament display and starts the simulation.
 */
export function initTournamentDisplay() {
    (document.getElementById("tournamentName") as HTMLElement).textContent = tournamentData.name;
    
    resetTournamentUI();
    tournamentData.matches = generateMatches(tournamentData.players);
    
    renderBracket();

    simulateTournament();
}