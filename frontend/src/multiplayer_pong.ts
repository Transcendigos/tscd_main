// frontend/src/multiplayer_pong.ts

let mpCanvas: HTMLCanvasElement | null = null;
let mpCtx: CanvasRenderingContext2D | null = null;

let mpGameId: string | null = null;
let mpMyPlayerId: string | null = null;
let mpOpponentPlayerId: string | null = null;
let mpOpponentUsername: string | null = null;

let mpBallState: { x: number, y: number, width: number, height: number } | null = null;
let mpPlayersState: {
    [playerId: string]: { paddleY: number, score: number, username?: string }
} | null = null;
let mpGameStatus: string | null = null;

const PADDLE_WIDTH = 8;
const PADDLE_HEIGHT = 70;
const BALL_WIDTH = 10;
const BALL_HEIGHT = 10;

type SendInputFunction = (gameId: string, input: 'up' | 'down' | 'stop_up' | 'stop_down') => void;
let sendPlayerInputToServer: SendInputFunction | null = null;

export function initMultiplayerPong(
    gameId: string,
    initialState: any,
    yourPlayerId: string,
    opponentId: string,
    opponentUsername: string,
    canvasElement: HTMLCanvasElement,
    sendInputFunc: SendInputFunction
) {
    mpGameId = gameId;
    mpMyPlayerId = yourPlayerId;
    mpOpponentPlayerId = opponentId;
    mpOpponentUsername = opponentUsername;

    mpCanvas = canvasElement;
    if (!mpCanvas) {
        console.error("Multiplayer Pong: Canvas element not provided or found!");
        return;
    }
    mpCtx = mpCanvas.getContext('2d');
    if (!mpCtx) {
        console.error("Multiplayer Pong: Failed to get 2D context from canvas.");
        return;
    }

    sendPlayerInputToServer = sendInputFunc;

    updateMultiplayerGameState(initialState.ball, initialState.players, initialState.status);
    console.log(`Multiplayer Pong initialized for game ${mpGameId}. You are ${mpMyPlayerId}. Opponent: ${mpOpponentUsername}`);

    setupMultiplayerInputHandlers();
    renderMultiplayerFrame();
}

export function updateMultiplayerGameState(
    ballData: any,
    playersData: any,
    statusData: string
) {
    mpBallState = ballData;
    mpPlayersState = playersData;
    mpGameStatus = statusData;

    if (mpCtx && mpCanvas) {
        renderMultiplayerFrame();
    }
}

export function handleMultiplayerGameOver(winnerId: string | null, scores: any) {
    console.log(`Multiplayer Game Over. Winner: ${winnerId}, Scores:`, scores);
    mpGameStatus = 'finished';

    if (mpCtx && mpCanvas) {
        mpCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        mpCtx.fillRect(0, 0, mpCanvas.width, mpCanvas.height);
        mpCtx.fillStyle = '#FFF';
        mpCtx.font = "30px 'Press Start 2P'";
        mpCtx.textAlign = 'center';

        let winnerDisplayName: string;

        if (winnerId) {
            if (mpMyPlayerId && winnerId === mpMyPlayerId) {
                // Current client is the winner
                winnerDisplayName = (mpPlayersState && mpPlayersState[mpMyPlayerId as string]?.username) || 'You';
            } else if (mpOpponentPlayerId && winnerId === mpOpponentPlayerId) {
                // Opponent is the winner
                winnerDisplayName = (mpPlayersState && mpPlayersState[mpOpponentPlayerId as string]?.username) || mpOpponentUsername || 'Opponent';
            } else {
                // Winner ID is present but doesn't match known local player IDs (should not happen ideally)
                winnerDisplayName = "Unknown Winner"; 
            }
            mpCtx.fillText(`${winnerDisplayName} Wins!`, mpCanvas.width / 2, mpCanvas.height / 2 - 30);
        } else {
            // It's a draw (winnerId is null)
            mpCtx.fillText("It's a Draw!", mpCanvas.width / 2, mpCanvas.height / 2 - 30);
        }

        mpCtx.font = "20px 'Press Start 2P'";
        if (mpPlayersState && mpMyPlayerId && mpOpponentPlayerId) {
             mpCtx.fillText(
                `Score: ${mpPlayersState[mpMyPlayerId as string]?.score ?? 0} - ${mpPlayersState[mpOpponentPlayerId as string]?.score ?? 0}`,
                mpCanvas.width / 2, mpCanvas.height / 2 + 20
            );
        }
        mpCtx.fillText("Game Over", mpCanvas.width / 2, mpCanvas.height / 2 + 60);
    }
    cleanupMultiplayerInputHandlers();
}


function drawMultiplayerPaddle(x: number, y: number, width: number, height: number, color: string) {
    if (!mpCtx) return;
    mpCtx.fillStyle = color;
    mpCtx.fillRect(x, y, width, height);
}

function drawMultiplayerBall(x: number, y: number, width: number, height: number, color: string) {
    if (!mpCtx) return;
    mpCtx.fillStyle = color;
    mpCtx.fillRect(x, y, width, height);
}

function drawMultiplayerScores() {
    if (!mpCtx || !mpPlayersState || !mpMyPlayerId || !mpOpponentPlayerId) return;
    
    const player1Score = mpPlayersState[mpMyPlayerId]?.score ?? 0;
    const player2Score = mpPlayersState[mpOpponentPlayerId]?.score ?? 0;

    mpCtx.fillStyle = '#FFF';
    mpCtx.font = "40px 'Press Start 2P'";
    mpCtx.textAlign = 'center';
    mpCtx.fillText(`${player1Score}  -  ${player2Score}`, (mpCanvas?.width || 800) / 2, 70);
}

function renderMultiplayerFrame() {
    if (!mpCtx || !mpCanvas || !mpBallState || !mpPlayersState || !mpMyPlayerId || !mpOpponentPlayerId) {
        return;
    }

    mpCtx.fillStyle = '#001c3b';
    mpCtx.fillRect(0, 0, mpCanvas.width, mpCanvas.height);

    const leftPaddleX = 10;
    const rightPaddleX = mpCanvas.width - PADDLE_WIDTH - 10;

    const playerIds = Object.keys(mpPlayersState);
    const p1Data = mpPlayersState[playerIds[0]];
    const p2Data = mpPlayersState[playerIds[1]];

    if (p1Data) drawMultiplayerPaddle(leftPaddleX, p1Data.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, '#d6ecff');
    if (p2Data) drawMultiplayerPaddle(rightPaddleX, p2Data.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, '#d6ecff');

    drawMultiplayerBall(mpBallState.x, mpBallState.y, mpBallState.width, mpBallState.height, '#FFFFFF');
    drawMultiplayerScores();
}

const boundKeyDownHandler = (event: KeyboardEvent) => handleMultiplayerKeyDown(event);
const boundKeyUpHandler = (event: KeyboardEvent) => handleMultiplayerKeyUp(event);
let keysPressed: { [key: string]: boolean } = {};

function setupMultiplayerInputHandlers() {
    cleanupMultiplayerInputHandlers();
    keysPressed = {};
    document.addEventListener('keydown', boundKeyDownHandler);
    document.addEventListener('keyup', boundKeyUpHandler);
    console.log("Multiplayer input handlers ADDED.");
}

function cleanupMultiplayerInputHandlers() {
    document.removeEventListener('keydown', boundKeyDownHandler);
    document.removeEventListener('keyup', boundKeyUpHandler);
    keysPressed = {};
    console.log("Multiplayer input handlers REMOVED.");
}

function handleMultiplayerKeyDown(event: KeyboardEvent) {
    if (!mpGameId || !sendPlayerInputToServer || mpGameStatus !== 'in-progress') return;

    let inputSent = false;
    if (event.key === 'w' || event.key === 'W') {
        if (!keysPressed['w']) sendPlayerInputToServer(mpGameId, 'up');
        keysPressed['w'] = true;
        inputSent = true;
    } else if (event.key === 's' || event.key === 'S') {
        if (!keysPressed['s']) sendPlayerInputToServer(mpGameId, 'down');
        keysPressed['s'] = true;
        inputSent = true;
    }
    if (inputSent) event.preventDefault();
}

function handleMultiplayerKeyUp(event: KeyboardEvent) {
    if (!mpGameId || !sendPlayerInputToServer || mpGameStatus !== 'in-progress') return;

    let inputSent = false;
    if (event.key === 'w' || event.key === 'W') {
        sendPlayerInputToServer(mpGameId, 'stop_up');
        keysPressed['w'] = false;
        inputSent = true;
    } else if (event.key === 's' || event.key === 'S') {
        sendPlayerInputToServer(mpGameId, 'stop_down');
        keysPressed['s'] = false;
        inputSent = true;
    }
     if (inputSent) event.preventDefault();
}

export function cleanupMultiplayerPong() {
    cleanupMultiplayerInputHandlers();
    mpGameId = null;
    mpMyPlayerId = null;
    mpOpponentPlayerId = null;
    mpOpponentUsername = null;
    mpBallState = null;
    mpPlayersState = null;
    mpGameStatus = null;
    if (mpCtx && mpCanvas) {
        mpCtx.clearRect(0, 0, mpCanvas.width, mpCanvas.height);
    }
    sendPlayerInputToServer = null;
    console.log("Multiplayer Pong resources cleaned up.");
}