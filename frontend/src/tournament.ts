import { socket } from './chatClient.js';
import { currentUserId } from './chatClient.js';
import { createLocalTournament, getNextMatch, recordMatchWinner, renderLocalBracket } from './tournamentLocal.js';

function renderBracket(container: HTMLElement, tournamentData: any) {
    container.innerHTML = ''; 
    const { size, participants, matches, status: tournamentStatus } = tournamentData;
    const myId = currentUserId; 

    const rounds: { [key: number]: any[] } = {};
    matches.forEach((match: any) => {
        if (!rounds[match.round]) rounds[match.round] = [];
        rounds[match.round].push(match);
    });

    const numRounds = Math.log2(size);

    for (let i = 1; i <= numRounds; i++) {
        const roundEl = document.createElement('div');
        roundEl.className = 'round';
        const roundMatches = rounds[i] || [];
        const numMatchesInRound = size / (2 ** i);

        for (let j = 0; j < numMatchesInRound; j++) {
            const match = roundMatches.find((m:any) => m.match_in_round === j + 1) || {};
            const player1 = participants.find((p:any) => p.user_id === match.player1_id);
            const player2 = participants.find((p:any) => p.user_id === match.player2_id);
            let player1Html = `<span class="tbd">TBD</span>`;
            if (player1) {
                if (match.status === 'pending' && player1.user_id === myId) {
                    player1Html = `<button data-match-id="${match.id}" class="start-match-btn w-full text-center bg-green-600 hover:bg-green-500 p-1">Start Match</button>`;
                } else {
                    player1Html = player1.username;
                }
            }
            let player2Html = `<span class="tbd">TBD</span>`;
            if (player2) {
                if (match.status === 'pending' && player2.user_id === myId) {
                    player2Html = `<button data-match-id="${match.id}" class="start-match-btn w-full text-center bg-green-600 hover:bg-green-500 p-1">Start Match</button>`;
                } else {
                    player2Html = player2.username;
                }
            }
            const matchEl = document.createElement('div');
            matchEl.className = 'match';
            if (match.status === 'in_progress') matchEl.style.borderColor = '#f8aab6';
            matchEl.innerHTML = `
                <div class="player player-top ${match.winner_id === match.player1_id ? 'winner' : ''}">${player1Html}</div>
                <div class="player player-bottom ${match.winner_id === match.player2_id ? 'winner' : ''}">${player2Html}</div>
            `;
            roundEl.appendChild(matchEl);
        }
        container.appendChild(roundEl);
    }
    
    if (tournamentStatus === 'finished' && tournamentData.winner_id) {
        const finalRoundEl = document.createElement('div');
        finalRoundEl.className = 'round final';
        const winner = participants.find((p:any) => p.user_id === tournamentData.winner_id);
        const matchEl = document.createElement('div');
        matchEl.className = 'match';
        matchEl.innerHTML = `<div class="player winner">🏆 ${winner ? winner.username : 'Winner'}</div>`;
        finalRoundEl.appendChild(matchEl);
        container.appendChild(finalRoundEl);
    }
}

export async function showTournamentBracket(tournamentId: string) {
    const lobbyView = document.getElementById('tournamentLobbyView');
    const localSetupView = document.getElementById('localTournamentSetupView');
    const bracketView = document.getElementById('tournamentBracketView');
    const bracketContainer = document.getElementById('bracketContainer');
    const bracketTournamentName = document.getElementById('bracketTournamentName');
    if (!lobbyView || !bracketView || !bracketContainer || !bracketTournamentName || !localSetupView) return;

    lobbyView.classList.add('hidden');
    localSetupView.classList.add('hidden');
    bracketView.classList.remove('hidden');
    
    bracketContainer.innerHTML = '<p class="text-slate-400">Loading bracket...</p>';
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}`);
        if (!response.ok) throw new Error('Could not fetch tournament details.');
        const tournamentData = await response.json();
        bracketTournamentName.textContent = tournamentData.name;
        renderBracket(bracketContainer, tournamentData);
    } catch (error) {
        console.error("Error showing bracket:", error);
        bracketContainer.innerHTML = '<p class="text-red-400">Could not load bracket.</p>';
    }
}

function showLobbyView() {
    const lobbyView = document.getElementById('tournamentLobbyView');
    const bracketView = document.getElementById('tournamentBracketView');
    const localSetupView = document.getElementById('localTournamentSetupView');
    if (lobbyView && bracketView && localSetupView) {
        bracketView.classList.add('hidden');
        localSetupView.classList.add('hidden');
        lobbyView.classList.remove('hidden');
        fetchAndDisplayTournaments();
    }
}

export async function fetchAndDisplayTournaments() {
    const tournamentListEl = document.getElementById('tournamentLobbyList');
    if (!tournamentListEl) return;
    tournamentListEl.innerHTML = '<p class="text-slate-400 text-xs">Fetching tournaments...</p>';
    try {
        const response = await fetch('/api/tournaments');
        if (!response.ok) throw new Error('Failed to fetch tournaments.');
        const tournaments = await response.json();
        tournamentListEl.innerHTML = '';
        if (tournaments.length === 0) {
            tournamentListEl.innerHTML = '<p class="text-slate-400 text-xs">No available tournaments. Why not create one?</p>';
            return;
        }
        tournaments.forEach((tournament: any) => {
            const tournamentItem = document.createElement('div');
            tournamentItem.className = 'bg-slate-800/50 drop-shadow-xl/30 backdrop-blur-xs p-2.5 border border-slate-700 flex justify-between items-center';
            const buttonHtml = tournament.is_participant ? `<button data-tournament-id="${tournament.id}" class="view-bracket-btn border px-3 py-1 font-bold send-button text-xs transition-colors">View</button>` : `<button data-tournament-id="${tournament.id}" class="join-tournament-btn border px-3 py-1 font-bold hover:bg-[#4cb4e7] hover:text-slate-900 text-xs transition-colors">Join</button>`;
            tournamentItem.innerHTML = `
                <div>
                    <p class="font-bold text-white">${tournament.name}</p>
                    <p class="text-xs text-slate-400">${tournament.creator_username} - (${tournament.player_count}/${tournament.size}) - Status: ${tournament.status}</p>
                </div>
                ${buttonHtml}
            `;
            tournamentListEl.appendChild(tournamentItem);
        });
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        if (tournamentListEl) tournamentListEl.innerHTML = '<p class="text-red-400 text-xs">Could not load tournaments.</p>';
    }
}

export function setupTournamentSystem() {
    const createTournamentForm = document.getElementById('createTournamentForm');
    const tournamentErrorEl = document.getElementById('tournamentError');
    const tournamentLobby = document.getElementById('tournamentLobbyList');
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');
    const bracketContainer = document.getElementById('bracketContainer');
    const lobbyView = document.getElementById('tournamentLobbyView');
    const bracketView = document.getElementById('tournamentBracketView');
    
    const startLocalTournamentBtn = document.getElementById('startLocalTournamentBtn');
    const localTournamentSetupView = document.getElementById('localTournamentSetupView');
    const aliasInputsContainer = document.getElementById('aliasInputsContainer');
    const startLocalTournamentGameBtn = document.getElementById('startLocalTournamentGameBtn');
    const backToLobbyFromLocalSetupBtn = document.getElementById('backToLobbyFromLocalSetupBtn');

    if (startLocalTournamentBtn) {
        startLocalTournamentBtn.addEventListener('click', () => {
            if (lobbyView && localTournamentSetupView && aliasInputsContainer) {
                lobbyView.classList.add('hidden');
                localTournamentSetupView.classList.remove('hidden');
                aliasInputsContainer.innerHTML = '';
                const numPlayers = 4;
                for (let i = 0; i < numPlayers; i++) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.placeholder = `Player ${i + 1} Alias`;
                    input.className = 'player-alias-input bg-slate-800 border border-slate-600 rounded p-2 text-white';
                    aliasInputsContainer.appendChild(input);
                }
            }
        });
    }

    if (startLocalTournamentGameBtn) {
        startLocalTournamentGameBtn.addEventListener('click', () => {
            const aliasInputs = document.querySelectorAll('.player-alias-input') as NodeListOf<HTMLInputElement>;
            const aliases = Array.from(aliasInputs).map(input => input.value.trim()).filter(alias => alias);
            if (aliases.length < 2) {
                alert('Please enter at least two aliases.');
                return;
            }

            createLocalTournament(aliases);

            if (localTournamentSetupView && bracketView && bracketContainer) {
                localTournamentSetupView.classList.add('hidden');
                bracketView.classList.remove('hidden');
                document.getElementById('bracketTournamentName')!.textContent = 'Local Tournament';
                renderLocalBracket(bracketContainer);
            }
        });
    }

    if (createTournamentForm instanceof HTMLFormElement) {
        createTournamentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (tournamentErrorEl) tournamentErrorEl.textContent = '';
            const formData = new FormData(createTournamentForm);
            const name = formData.get('name') as string;
            const size = formData.get('size') as string;
            try {
                const response = await fetch('/api/tournaments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, size: parseInt(size, 10) })
                });
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error || 'Failed to create tournament.');
                createTournamentForm.reset();
                await fetchAndDisplayTournaments();
            } catch (error: any) {
                if (tournamentErrorEl) tournamentErrorEl.textContent = error.message;
            }
        });
    }

    if (tournamentLobby) {
        tournamentLobby.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const tournamentId = target.dataset.tournamentId;
            if (!tournamentId) return;

            if (target.matches('.join-tournament-btn')) {
                target.textContent = 'Joining...';
                target.setAttribute('disabled', 'true');
                try {
                    const response = await fetch(`/api/tournaments/${tournamentId}/join`, { method: 'POST' });
                    const responseData = await response.json();
                    if (!response.ok) throw new Error(responseData.error || 'Failed to join.');
                } catch (error: any) {
                    alert(`Error: ${error.message}`);
                    target.textContent = 'Join';
                    target.removeAttribute('disabled');
                }
            } else if (target.matches('.view-bracket-btn')) {
                await showTournamentBracket(tournamentId);
            }
        });
    }
    
    if (bracketContainer) {
        bracketContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const handleLocalPongClick = (window as any).handleLocalPongClick;

            if (target && target.matches('.start-local-match-btn')) {
                const match = getNextMatch();
                if (match && match.player1 && match.player2 && handleLocalPongClick) {
                    match.status = 'in_progress';
                    
                    handleLocalPongClick(match.player1.alias, match.player2.alias, (winnerAlias: string) => {
                        recordMatchWinner(winnerAlias);
                        renderLocalBracket(bracketContainer);
                    });

                    renderLocalBracket(bracketContainer);
                }
            }
            
            else if (target && target.matches('.start-match-btn')) {
                const matchId = target.dataset.matchId;
                if (!matchId) return;
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'PLAYER_READY_FOR_MATCH', matchId: parseInt(matchId, 10) }));
                    target.textContent = 'Waiting for Opponent...';
                    target.setAttribute('disabled', 'true');
                }
            }
        });
    }

    if (backToLobbyBtn) {
        backToLobbyBtn.addEventListener('click', showLobbyView);
    }
    if (backToLobbyFromLocalSetupBtn) {
        backToLobbyFromLocalSetupBtn.addEventListener('click', showLobbyView);
    }
}