// frontend/src/tournamentLocal.ts

interface LocalParticipant {
    alias: string;
}

export interface LocalMatch {
    round: number;
    matchInRound: number;
    player1: LocalParticipant | null;
    player2: LocalParticipant | null;
    winner: LocalParticipant | null;
    status: 'pending' | 'in_progress' | 'finished';
}

interface LocalTournament {
    participants: LocalParticipant[];
    matches: LocalMatch[];
    status: 'setup' | 'in_progress' | 'finished';
    winner: LocalParticipant | null;
}

let currentTournament: LocalTournament | null = null;

export function getNextMatch(): LocalMatch | undefined {
    if (!currentTournament) return undefined;
    return currentTournament.matches.find(m => m.status === 'pending' && m.player1 && m.player2);
}


export function recordMatchWinner(winnerAlias: string): void {
    if (!currentTournament) return;

    const matchInProgress = currentTournament.matches.find(m => m.status === 'in_progress');
    if (!matchInProgress) {
        console.error("Could not find a match in progress to record winner.");
        return;
    }

    const winner = currentTournament.participants.find(p => p.alias === winnerAlias);
    if (winner) {
        matchInProgress.winner = winner;
        matchInProgress.status = 'finished';
    } else {
        console.error(`Winner alias "${winnerAlias}" not found in participants.`);
        matchInProgress.status = 'finished';
    }

    const currentRound = matchInProgress.round;
    const allMatchesInRound = currentTournament.matches.filter(m => m.round === currentRound);
    const isRoundFinished = allMatchesInRound.every(m => m.status === 'finished');

    if (isRoundFinished) {
        const winnersOfRound = allMatchesInRound.map(m => m.winner).filter(w => w !== null);
        if (winnersOfRound.length === 1) {
            currentTournament.winner = winnersOfRound[0];
            currentTournament.status = 'finished';
        } else if (winnersOfRound.length > 1) {
            createMatchesForRound(currentRound + 1);
        }
    }
}


export function createLocalTournament(aliases: string[]): void {
    const participantCount = Math.pow(2, Math.ceil(Math.log2(aliases.length)));
    const shuffledAliases = [...aliases].sort(() => Math.random() - 0.5);
    
    const participants: LocalParticipant[] = [];
    for(let i=0; i < participantCount; i++) {
        participants.push({ alias: shuffledAliases[i] || 'BYE' });
    }

    currentTournament = {
        participants,
        matches: [],
        status: 'in_progress',
        winner: null,
    };

    createMatchesForRound(1);
}

function createMatchesForRound(roundNumber: number): void {
    if (!currentTournament) return;

    let playersForThisRound: (LocalParticipant | null)[] = [];

    if (roundNumber === 1) {
        playersForThisRound = [...currentTournament.participants];
    } else {
        const prevRound = roundNumber - 1;
        playersForThisRound = currentTournament.matches
            .filter(m => m.round === prevRound && m.status === 'finished')
            .map(m => m.winner)
            .sort((a,b) => (a?.alias || '').localeCompare(b?.alias || ''));
    }

    const numMatches = playersForThisRound.length / 2;
    for (let i = 0; i < numMatches; i++) {
        const player1 = playersForThisRound[i*2];
        const player2 = playersForThisRound[i*2 + 1];

        const match: LocalMatch = {
            round: roundNumber,
            matchInRound: i + 1,
            player1: player1,
            player2: player2,
            winner: null,
            status: 'pending',
        };

        if (player1 && (!player2 || player2.alias === 'BYE')) {
            match.winner = player1;
            match.status = 'finished';
        } else if (player2 && (!player1 || player1.alias === 'BYE')) {
            match.winner = player2;
            match.status = 'finished';
        }

        currentTournament.matches.push(match);
    }
}


export function renderLocalBracket(container: HTMLElement): void {
    if (!currentTournament) {
        container.innerHTML = '<p class="text-red-400">No active local tournament.</p>';
        return;
    }

    container.innerHTML = '';
    const { participants, matches, status: tournamentStatus } = currentTournament;
    const size = participants.length;
    const numRounds = Math.log2(size);
    const rounds: { [key: number]: LocalMatch[] } = {};
    matches.forEach(match => {
        if (!rounds[match.round]) rounds[match.round] = [];
        rounds[match.round].push(match);
    });

    for (let i = 1; i <= numRounds; i++) {
        const roundEl = document.createElement('div');
        roundEl.className = 'round';
        const roundMatches = rounds[i] || [];
        
        for (const match of roundMatches) {
            const player1Html = match.player1 ? match.player1.alias : `<span class="tbd">TBD</span>`;
            const player2Html = match.player2 ? match.player2.alias : `<span class="tbd">TBD</span>`;
            
            const matchEl = document.createElement('div');
            matchEl.className = 'match';
            if (match.status === 'in_progress') matchEl.style.borderColor = '#f8aab6';

            matchEl.innerHTML = `
                <div class="player player-top ${match.winner === match.player1 ? 'winner' : ''}">${player1Html}</div>
                <div class="player player-bottom ${match.winner === match.player2 ? 'winner' : ''}">${player2Html}</div>
            `;
            
            const isPlayable = match.player1 && match.player1.alias !== 'BYE' && match.player2 && match.player2.alias !== 'BYE' && match.status === 'pending';
            const isNextMatch = !matches.some(m => m.status === 'in_progress') && isPlayable;

            if (isNextMatch) {
                const startBtn = document.createElement('button');
                startBtn.textContent = 'Start Match';
                startBtn.className = 'start-local-match-btn w-full text-center bg-green-600 hover:bg-green-500 p-1 mt-1';
                startBtn.dataset.round = match.round.toString();
                startBtn.dataset.matchInRound = match.matchInRound.toString();
                matchEl.appendChild(startBtn);
            }
            roundEl.appendChild(matchEl);
        }
        container.appendChild(roundEl);
    }

    if (tournamentStatus === 'finished' && currentTournament.winner) {
        const finalRoundEl = document.createElement('div');
        finalRoundEl.className = 'round final';
        const matchEl = document.createElement('div');
        matchEl.className = 'match';
        matchEl.innerHTML = `<div class="player winner">🏆 ${currentTournament.winner.alias}</div>`;
        finalRoundEl.appendChild(matchEl);
        container.appendChild(finalRoundEl);
    }
}