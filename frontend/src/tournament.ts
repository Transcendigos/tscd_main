import { DesktopWindow } from "./DesktopWindow";

// --- TYPES ---
type Player = { id: number; name: string };
type Match = {
  id: string;
  player1: Player | null;
  player2: Player | null;
  winner: Player | null;
  round: number;
  matchNumberInRound: number;
  played: boolean;
};

// Gère l'intégralité du cycle de vie d'un tournoi, de la création à la fin.
// Cette classe est autonome et gère son propre état et ses interactions avec le DOM.
export class TournamentManager {
  // --- State ---
  private name: string = "";
  private playerCount: number = 0;
  private players: Player[] = [];
  private matches: Match[] = [];
  private currentMatchIndex: number = 0;

  // --- Dependencies ---
  private creationWindow: DesktopWindow;
  private playersWindow: DesktopWindow;
  private tournamentWindow: DesktopWindow;
  
  // --- UI Elements Cache ---
  private ui: { [key: string]: HTMLElement | null | NodeListOf<Element> } = {};

  constructor(
    creationWindow: DesktopWindow,
    playersWindow: DesktopWindow,
    tournamentWindow: DesktopWindow
  ) {
    this.creationWindow = creationWindow;
    this.playersWindow = playersWindow;
    this.tournamentWindow = tournamentWindow;
    
    this._queryUIElements();
    this._attachEventListeners();
  }

  // =================================================================
  // PUBLIC API: Méthodes appelées depuis l'extérieur (main.ts)
  // =================================================================

  public startNewTournament(): void {
    this._resetState();
    this._resetCreationWindowDOM();
    this.creationWindow.open();
  }

  public startTestTournament(name: string, players: Player[]): void {
    this._resetState();
    this.name = name;
    this.players = players;
    this.playerCount = players.length;
    this.matches = this._generateMatches(this.players);
    
    this._initTournamentWindowDOM();
    this.tournamentWindow.open();
  }

  // =================================================================
  // INITIALIZATION & EVENT HANDLING
  // =================================================================

  private _queryUIElements(): void {
    const ids = [
      "tournamentNameInput", "tournamentPlayersBtn", "playerInputsContainer",
      "tournamentName", "tournamentBracketContainer", "nextMatchButtonContainer",
      "player1Name", "player2Name", "finalWinnerDisplay", "launchTournamentBtn",
      "nextMatchButton", "closetournamentBtn"
    ];
    ids.forEach(id => this.ui[id] = document.getElementById(id));
    this.ui.playerCountButtons = document.querySelectorAll(".player-count-btn");
  }

  private _attachEventListeners(): void {
    // Fenêtre de création
    const nameInput = this.ui.tournamentNameInput as HTMLInputElement;
    const createBtn = this.ui.tournamentPlayersBtn as HTMLButtonElement;
    nameInput?.addEventListener("input", () => this._updateCreateButtonState());
    (this.ui.playerCountButtons as NodeListOf<HTMLButtonElement>)?.forEach(btn => {
      btn.addEventListener("click", () => this._selectPlayerCount(btn));
    });
    createBtn?.addEventListener("click", () => {
        if (!createBtn.disabled) this._handleTournamentCreation();
    });

    // Fenêtre de tournoi
    (this.ui.launchTournamentBtn as HTMLButtonElement)?.addEventListener("click", () => this._updateTournamentUIDisplay());
    
    // Le listener du bouton de match vérifie maintenant l'état du tournoi.
    (this.ui.nextMatchButton as HTMLButtonElement)?.addEventListener("click", () => {
      const isFinished = this.matches.length > 0 && this.matches.every(m => m.played);
      if (isFinished) {
        this._handleCloseTournament();
      } else {
        this._playNextMatch();
      }
    });
  }
  
  // =================================================================
  // LOGIC & STATE MANAGEMENT
  // =================================================================
  
// Gère la fermeture et la réinitialisation de la fenêtre du tournoi.
  private _handleCloseTournament(): void {
    this._resetState();
    this.tournamentWindow.close();
  }
  
  private _resetState(): void {
    this.name = "";
    this.playerCount = 0;
    this.players = [];
    this.matches = [];
    this.currentMatchIndex = 0;
  }

  private _selectPlayerCount(selectedBtn: HTMLButtonElement): void {
    (this.ui.playerCountButtons as NodeListOf<HTMLButtonElement>).forEach(b => {
      b.classList.remove("text-green-400");
    });
    selectedBtn.classList.add("text-green-400");
    this.playerCount = parseInt(selectedBtn.textContent || "0", 10);
    this._updateCreateButtonState();
  }

  private _handleTournamentCreation(): void {
    this.name = (this.ui.tournamentNameInput as HTMLInputElement).value.trim();
    this.creationWindow.close();
    this._populatePlayerInputs();
    this.playersWindow.open();
  }

  private _playNextMatch(): void {
    const currentMatch = this.matches[this.currentMatchIndex];
    if (!currentMatch || !currentMatch.player1 || !currentMatch.player2) return;
    
    currentMatch.played = true;
    currentMatch.winner = Math.random() > 0.5 ? currentMatch.player1 : currentMatch.player2;
    this._renderMatch(currentMatch);

    const nextRoundMatch = this.matches.find(m => m.round === currentMatch.round + 1 && m.matchNumberInRound === Math.ceil(currentMatch.matchNumberInRound / 2));
    if (nextRoundMatch) {
        if (currentMatch.matchNumberInRound % 2 !== 0) nextRoundMatch.player1 = currentMatch.winner;
        else nextRoundMatch.player2 = currentMatch.winner;
        this._renderMatch(nextRoundMatch);
    }
    
    this._updateTournamentUIDisplay();
  }

  private _generateMatches(players: Player[]): Match[] {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const matches: Match[] = [];
    let round = 1;

    for (let i = 0; i < shuffled.length; i += 2) {
        matches.push({
            id: `match-${round}-${i/2 + 1}`, player1: shuffled[i], player2: shuffled[i+1],
            winner: null, round, matchNumberInRound: i/2 + 1, played: false
        });
    }

    let prevRoundCount = matches.length;
    while (prevRoundCount > 1) {
        round++;
        for (let i = 0; i < prevRoundCount / 2; i++) {
            matches.push({
                id: `match-${round}-${i + 1}`, player1: null, player2: null,
                winner: null, round, matchNumberInRound: i + 1, played: false
            });
        }
        prevRoundCount /= 2;
    }
    return matches;
  }

  // =================================================================
  // DOM MANIPULATION & RENDERING
  // =================================================================

  private _updateCreateButtonState(): void {
    const createBtn = this.ui.tournamentPlayersBtn as HTMLButtonElement;
    const nameFilled = (this.ui.tournamentNameInput as HTMLInputElement).value.trim() !== "";
    const playersChosen = this.playerCount > 0;
    createBtn.disabled = !(nameFilled && playersChosen);
    createBtn.classList.toggle("opacity-50", createBtn.disabled);
    createBtn.classList.toggle("cursor-not-allowed", createBtn.disabled);
  }

  private _resetCreationWindowDOM(): void {
    const nameInput = this.ui.tournamentNameInput as HTMLInputElement;
    if (nameInput) nameInput.value = "";
    (this.ui.playerCountButtons as NodeListOf<HTMLButtonElement>)?.forEach(btn => {
      btn.classList.remove("text-green-400");
    });
    this.playerCount = 0;
    this._updateCreateButtonState();
  }

  private _populatePlayerInputs(): void {
    const container = this.ui.playerInputsContainer as HTMLElement;
    if (!container) return;
    container.innerHTML = "";
    this.players = [];

    for (let i = 1; i <= this.playerCount; i++) {
      const row = document.createElement("div");
      row.className = "participant-row flex items-center justify-between gap-2";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Player ${i}`;
      input.className = "participant-name flex-1 bg-slate-700 border border-[#4cb4e7]/50 rounded p-1";
      input.dataset.id = String(i);

      const button = document.createElement("button");
      button.textContent = "✓";
      button.disabled = true;
      button.className = "ready-toggle bg-transparent text-[#4cb4e7] border border-[#4cb4e7]/50 rounded px-2 py-1 opacity-50 cursor-not-allowed";
      
      input.addEventListener("input", () => this._handlePlayerInput(input, button));
      
      button.addEventListener("click", () => {
        if (button.disabled) return;
        const isReady = button.classList.contains("bg-green-400");
        if (isReady) {
            button.classList.remove("bg-green-400", "text-white");
            button.classList.add("bg-transparent", "text-[#4cb4e7]");
        } else {
            button.classList.remove("bg-transparent", "text-[#4cb4e7]");
            button.classList.add("bg-green-400", "text-white");
        }
        this._checkAllPlayersReady();
      });

      row.appendChild(input);
      row.appendChild(button);
      container.appendChild(row);
      this.players.push({ id: i, name: "" });
    }
  }

  private _handlePlayerInput(input: HTMLInputElement, button: HTMLButtonElement): void {
    const name = input.value.trim();
    const player = this.players.find(p => p.id === Number(input.dataset.id));
    if (player) player.name = name;

    const isDisabled = name === "";
    button.disabled = isDisabled;
    button.classList.toggle("opacity-50", isDisabled);
    button.classList.toggle("cursor-not-allowed", isDisabled);

    if (isDisabled) {
        button.classList.remove("bg-green-400", "text-white");
        button.classList.add("bg-transparent", "text-[#4cb4e7]");
    }
  }

  private _checkAllPlayersReady(): void {
    const allReady = Array.from(document.querySelectorAll<HTMLButtonElement>(".ready-toggle")).every(btn => btn.classList.contains("bg-green-400"));
    const allNamed = this.players.every(p => p.name.trim() !== "");

    if (allReady && allNamed) {
      this.playersWindow.close();
      this.matches = this._generateMatches(this.players);
      this._initTournamentWindowDOM();
      this.tournamentWindow.open();
    }
  }

  private _initTournamentWindowDOM(): void {
    const nameElem = this.ui.tournamentName as HTMLElement;
    const bracketContainer = this.ui.tournamentBracketContainer as HTMLElement;
    if (!nameElem || !bracketContainer) return;
    
    nameElem.textContent = this.name;
    bracketContainer.innerHTML = '';

    if (this.playerCount !== 4 && this.playerCount !== 8) {
        bracketContainer.innerHTML = `<p class="text-center text-red-400 p-4">Un arbre de tournoi requiert 4 ou 8 joueurs. Sélection: ${this.playerCount}.</p>`;
        (this.ui.launchTournamentBtn as HTMLButtonElement).disabled = true;
        return;
    }

    const roundsMap = new Map<number, HTMLElement>();
    const maxRound = this.matches.length > 0 ? Math.max(...this.matches.map(m => m.round)) : 0;
    const getRoundName = (r: number, max: number) => r === max ? "Finale" : r === max - 1 ? "Demi-finales" : r === max - 2 ? "Quarts de finale" : `Ronde ${r}`;
    
    this.matches.forEach(match => {
        if (!roundsMap.has(match.round)) {
            const roundColumn = document.createElement("div");
            roundColumn.className = "flex flex-col items-center justify-around mx-2 py-4 flex-shrink-0";
            roundColumn.innerHTML = `<h3 class="text-md font-bold mb-4">${getRoundName(match.round, maxRound)}</h3>`;
            bracketContainer.appendChild(roundColumn);
            roundsMap.set(match.round, roundColumn);
        }
        const matchDiv = document.createElement("div");
        matchDiv.id = match.id;
        matchDiv.className = `flex flex-col p-2 border border-[#4cb4e7]/50 rounded text-center min-w-[120px] ${match.round === 1 ? 'my-2' : 'my-4'}`;
        roundsMap.get(match.round)?.appendChild(matchDiv);
        this._renderMatch(match);
    });

    const winnerCol = document.createElement("div");
    winnerCol.className = "flex flex-col items-center justify-center mx-2 py-4 flex-shrink-0";
    winnerCol.innerHTML = `<h3 class="text-md font-bold mb-4">Vainqueur</h3>`;
    winnerCol.appendChild(this.ui.finalWinnerDisplay as HTMLElement);
    bracketContainer.appendChild(winnerCol);
    
    this._updateTournamentUIDisplay();
  }

  private _renderMatch(match: Match): void {
      const matchDiv = document.getElementById(match.id);
      if (!matchDiv) return;
      matchDiv.classList.toggle("bg-green-700/50", match.played);
      if (match.played && match.winner) {
          matchDiv.innerHTML = `<span class="font-bold">${match.player1?.name}</span> vs <span class="font-bold">${match.player2?.name}</span><hr class="my-1 border-white/20"><span class="text-xs">Vainqueur: ${match.winner.name}</span>`;
      } else {
          matchDiv.innerHTML = `<span>${match.player1?.name || '...'}</span> vs <span>${match.player2?.name || '...'}</span>`;
      }
  }

  private _updateTournamentUIDisplay(): void {
    const nextMatchIdx = this.matches.findIndex(m => !m.played && m.player1 && m.player2);
    this.currentMatchIndex = nextMatchIdx;
    
    const isFinished = this.matches.length > 0 && this.matches.every(m => m.played);
    const launchBtn = this.ui.launchTournamentBtn as HTMLButtonElement;
    const nextMatchContainer = this.ui.nextMatchButtonContainer as HTMLElement;
    const nextMatchButton = this.ui.nextMatchButton as HTMLButtonElement;
    const finalWinnerDisplay = this.ui.finalWinnerDisplay as HTMLElement;

    launchBtn.classList.add('hidden');
    nextMatchContainer.classList.add('hidden');
    finalWinnerDisplay.classList.add('hidden');
    
    // Logique d'affichage des boutons en fonction de l'état du tournoi
    if (isFinished) {
        // État terminé : Affiche le vainqueur et le bouton "Close"
        const winner = this.matches[this.matches.length - 1].winner;
        finalWinnerDisplay.textContent = winner?.name || 'N/A';
        finalWinnerDisplay.classList.remove('hidden');

        nextMatchButton.textContent = "Close Tournament";
        nextMatchButton.classList.remove("bg-[#4cb4e7]", "hover:bg-green-400");
        nextMatchButton.classList.add("bg-red-700", "hover:bg-red-900");
        nextMatchContainer.classList.remove('hidden');
        (nextMatchContainer.querySelector('span') as HTMLElement).style.display = 'none'; // Masque le titre "Prochain Match"
        
    } else if (nextMatchIdx !== -1) {
        // État en cours : Affiche le bouton pour le prochain match
        const nextMatch = this.matches[nextMatchIdx];
        nextMatchButton.innerHTML = `<span id="player1Name" class="block">${nextMatch.player1!.name}</span><span class="block">vs</span><span id="player2Name" class="block">${nextMatch.player2!.name}</span>`;
        nextMatchButton.classList.remove("bg-red-700", "hover:bg-red-900");
        nextMatchButton.classList.add("bg-[#4cb4e7]", "hover:bg-green-400");
        nextMatchContainer.classList.remove('hidden');
        (nextMatchContainer.querySelector('span') as HTMLElement).style.display = 'block'; // Affiche le titre "Prochain Match"
    } else { 
        // État initial : Affiche le bouton pour lancer le tournoi
        launchBtn.classList.remove('hidden');
        launchBtn.disabled = this.playerCount !== 4 && this.playerCount !== 8;
        launchBtn.classList.toggle("opacity-50", launchBtn.disabled);
    }
  }
}

//Configure le comportement de survol du bouton "Tournament" dans le menu principal
export function setupTournamentMenuButton(): void {
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
}
