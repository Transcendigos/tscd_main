let mpCanvas: HTMLCanvasElement | null = null;
let mpCtx: CanvasRenderingContext2D | null = null;

let mpGameId: string | null = null;
let mpMyPlayerId: string | null = null;
let mpOpponentPlayerId: string | null = null;
let mpOpponentUsername: string | null = null;

let mpServerPlayer1Id: string | null = null;
let mpServerPlayer2Id: string | null = null;

let mpBallState: { x: number, y: number, width: number, height: number, vx?: number, vy?: number } | null = null;
let mpPlayersState: {
    [playerId: string]: { id?: string, paddleY: number, score: number, username?: string, isReady?: boolean }
} | null = null;
let mpGameStatus: string | null = null;
let localPlayerHasSignalledReady = false;

const PADDLE_WIDTH = 8;
const PADDLE_HEIGHT = 70;
const BALL_WIDTH = 10;
const BALL_HEIGHT = 10;

// --- Color Constants ---
const PLAYER_HIGHLIGHT_COLOR = '#39FF14'; // Green for the local player
const DEFAULT_COLOR = '#d6ecff';        // Default color for opponents/UI

type SendInputFunction = (gameId: string, input: 'up' | 'down' | 'stop_up' | 'stop_down') => void;
let sendPlayerInputToServer: SendInputFunction | null = null;

type SendReadyFunction = (gameId: string) => void;
let sendPlayerReadySignalToServer: SendReadyFunction | null = null;

let flickerPhase = 0;

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    width: number, height: number,
    radius: number
) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawMidline_Styled_MP() {
    if (!mpCtx || !mpCanvas) return;
    const segmentHeight = 20;
    const gap = 15;
    const lineWidth = 4;
    const x = mpCanvas.width / 2 - lineWidth / 2;
    mpCtx.fillStyle = DEFAULT_COLOR;
    mpCtx.shadowColor = "#0fffff";
    for (let y = 0; y < mpCanvas.height; y += segmentHeight + gap) {
        mpCtx.shadowBlur = 2;
        mpCtx.fillRect(x, y, lineWidth, segmentHeight);
    }
    mpCtx.shadowBlur = 0;
}

function drawScore_Styled_MP() {
    if (!mpCtx || !mpCanvas || !mpPlayersState || !mpServerPlayer1Id || !mpServerPlayer2Id) return;
    const p1DisplayScore = mpPlayersState[mpServerPlayer1Id]?.score ?? 0;
    const p2DisplayScore = mpPlayersState[mpServerPlayer2Id]?.score ?? 0;

    mpCtx.font = "64px 'Press Start 2P'";
    mpCtx.fillStyle = DEFAULT_COLOR;
    mpCtx.textAlign = "center";
    mpCtx.shadowColor = "#0fffff";
    mpCtx.shadowBlur = 3;
    mpCtx.fillText(`${p1DisplayScore}  ${p2DisplayScore}`, mpCanvas.width / 2, mpCanvas.height / 6);
    mpCtx.shadowBlur = 0;
}

function drawVerticalCRTLines_Styled_MP() {
    if (!mpCtx || !mpCanvas) return;
    let pulse = Math.sin(Date.now() * 0.01) * 2 + Math.sin(Date.now() * 0.05) * 3;
    mpCtx.shadowBlur = Math.abs(pulse);
    mpCtx.shadowColor = "#000fff";
    flickerPhase += 0.05;
    const flickerAlpha = 0.02 + 0.01 * Math.sin(flickerPhase);
    mpCtx.save();
    mpCtx.globalAlpha = flickerAlpha + 0.05;
    mpCtx.strokeStyle = "#00ffff";
    mpCtx.lineWidth = 1;
    for (let y = 0; y < mpCanvas.height; y += 4) {
        mpCtx.beginPath();
        mpCtx.moveTo(0, y);
        mpCtx.lineTo(mpCanvas.width, y);
        mpCtx.stroke();
    }
    mpCtx.restore();
    mpCtx.shadowBlur = 0;
}

/**
 * MODIFIED: This function now accepts a color parameter to draw the paddle.
 */
function drawPaddle_Styled_MP(x: number, y: number, width: number, height: number, color: string) {
    if (!mpCtx) return;
    let pulse = Math.sin(Date.now() * 0.2) * 1 + 1.5;
    mpCtx.shadowBlur = pulse;
    // Use the paddle's specific color for the shadow and fill
    mpCtx.shadowColor = color === PLAYER_HIGHLIGHT_COLOR ? color : "#0fffff";
    mpCtx.fillStyle = color;
    roundRect(mpCtx, x, y, width, height, 5);
    mpCtx.fill();
    mpCtx.shadowBlur = 0;
}

function drawMultiplayerBall(x: number, y: number, color: string) {
    if (!mpCtx) return;
    mpCtx.fillStyle = color;
    mpCtx.fillRect(x, y, BALL_WIDTH, BALL_HEIGHT);
}

function handleReadyUpKeyPress(event: KeyboardEvent) {
    if (mpGameStatus === 'waiting_for_ready' && !localPlayerHasSignalledReady) {
        if (event.code === 'Space' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (mpGameId && sendPlayerReadySignalToServer) {
                sendPlayerReadySignalToServer(mpGameId);
                localPlayerHasSignalledReady = true;
                renderMultiplayerFrame();
                document.removeEventListener('keydown', handleReadyUpKeyPress);
                setupMultiplayerInputHandlers();
            }
        }
    }
}

export function initMultiplayerPong(
    gameId: string,
    initialState: any,
    yourPlayerId: string,
    opponentId: string,
    opponentUsername: string,
    canvasElement: HTMLCanvasElement,
    sendInputFunc: SendInputFunction,
    sendReadyFunc: SendReadyFunction
) {
    cleanupMultiplayerPong();

    mpGameId = gameId;
    mpMyPlayerId = yourPlayerId;
    mpOpponentPlayerId = opponentId;
    mpOpponentUsername = opponentUsername;

    mpServerPlayer1Id = initialState.player1Id;
    mpServerPlayer2Id = initialState.player2Id;

    mpCanvas = canvasElement;
    if (!mpCanvas) { console.error("Multiplayer Pong: Canvas element not provided!"); return; }
    mpCtx = mpCanvas.getContext('2d');
    if (!mpCtx) { console.error("Multiplayer Pong: Failed to get 2D context."); return; }

    sendPlayerInputToServer = sendInputFunc;
    sendPlayerReadySignalToServer = sendReadyFunc;
    localPlayerHasSignalledReady = false;

    updateMultiplayerGameState(initialState.ball, initialState.players, initialState.status);

    if (initialState.status === 'waiting_for_ready') {
        document.addEventListener('keydown', handleReadyUpKeyPress);
    } else if (initialState.status === 'in-progress') {
        localPlayerHasSignalledReady = true;
        setupMultiplayerInputHandlers();
    }
    renderMultiplayerFrame();
}

export function updateMultiplayerGameState(
    ballData: any,
    playersData: any,
    statusData: string
) {
    const oldStatus = mpGameStatus;
    mpBallState = ballData;
    mpPlayersState = playersData;
    mpGameStatus = statusData;

    if (oldStatus === 'waiting_for_ready' && mpGameStatus === 'in-progress') {
        document.removeEventListener('keydown', handleReadyUpKeyPress);
        if (!localPlayerHasSignalledReady) {
            localPlayerHasSignalledReady = true;
        }
        setupMultiplayerInputHandlers();
    }

    if (mpCtx && mpCanvas) {
        renderMultiplayerFrame();
    }
}

export function handleMultiplayerGameOver(winnerId: string | null, scores: any) {
    mpGameStatus = 'finished';
    renderMultiplayerFrame();

    if (mpCtx && mpCanvas) {
        mpCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        mpCtx.fillRect(0, 0, mpCanvas.width, mpCanvas.height);
        mpCtx.fillStyle = '#FFF';
        mpCtx.font = "30px 'Press Start 2P'";
        mpCtx.textAlign = 'center';
        let winnerDisplayName: string;
        if (winnerId) {
            if (mpMyPlayerId && winnerId === mpMyPlayerId) {
                winnerDisplayName = (mpPlayersState && mpPlayersState[mpMyPlayerId as string]?.username) || 'You';
            } else if (mpOpponentPlayerId && winnerId === mpOpponentPlayerId) {
                winnerDisplayName = (mpPlayersState && mpPlayersState[mpOpponentPlayerId as string]?.username) || mpOpponentUsername || 'Opponent';
            } else {
                winnerDisplayName = mpPlayersState?.[winnerId]?.username || "Unknown Winner";
            }
            mpCtx.fillText(`${winnerDisplayName} Wins!`, mpCanvas.width / 2, mpCanvas.height / 2 - 30);
        } else {
            mpCtx.fillText("It's a Draw!", mpCanvas.width / 2, mpCanvas.height / 2 - 30);
        }
        mpCtx.font = "20px 'Press Start 2P'";
        if (mpPlayersState && mpServerPlayer1Id && mpServerPlayer2Id) {
             mpCtx.fillText(
                `Score: ${mpPlayersState[mpServerPlayer1Id]?.score ?? 0} - ${mpPlayersState[mpServerPlayer2Id]?.score ?? 0}`,
                mpCanvas.width / 2, mpCanvas.height / 2 + 20
            );
        }
        mpCtx.fillText("Game Over", mpCanvas.width / 2, mpCanvas.height / 2 + 60);
    }
    cleanupMultiplayerInputHandlers();
    document.removeEventListener('keydown', handleReadyUpKeyPress);
}


/**
 * MODIFIED: This function now determines the color for each paddle based on the player ID.
 */
function renderMultiplayerFrame() {
    if (!mpCtx || !mpCanvas) {
        console.warn("[MultiplayerPong] renderMultiplayerFrame: Bailing due to missing canvas context or element.");
        return;
    }

    const bgGradient = mpCtx.createLinearGradient(0, 0, 0, mpCanvas.height);
    bgGradient.addColorStop(0, "#1e293b");
    bgGradient.addColorStop(0.5, "#1b3f72");
    bgGradient.addColorStop(1, "#1e293b");
    mpCtx.fillStyle = bgGradient;
    mpCtx.fillRect(0, 0, mpCanvas.width, mpCanvas.height);

    drawVerticalCRTLines_Styled_MP();

    if (mpGameStatus === 'waiting_for_ready' || !mpPlayersState || !mpServerPlayer1Id || !mpServerPlayer2Id) {
        mpCtx.fillStyle = '#FFF';
        mpCtx.font = "20px 'Press Start 2P'";
        mpCtx.textAlign = 'center';
        mpCtx.fillText("Waiting for players...", mpCanvas.width / 2, mpCanvas.height / 2 - 60);
        const myPlayerData = mpMyPlayerId ? mpPlayersState?.[mpMyPlayerId] : null;
        const opponentPlayerData = mpOpponentPlayerId ? mpPlayersState?.[mpOpponentPlayerId] : null;
        const myReadyText = localPlayerHasSignalledReady || myPlayerData?.isReady ? 'Ready!' : 'Press SPACE to Ready Up';
        mpCtx.fillText(`You: ${myReadyText}`, mpCanvas.width / 2, mpCanvas.height / 2 - 20);
        mpCtx.fillText(`Opponent (${mpOpponentUsername || 'Player 2'}): ${opponentPlayerData?.isReady ? 'Ready!' : 'Waiting...'}`, mpCanvas.width / 2, mpCanvas.height / 2 + 20);

        if (mpPlayersState && mpServerPlayer1Id && mpPlayersState[mpServerPlayer1Id]) {
            const p1Color = mpServerPlayer1Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
            drawPaddle_Styled_MP(10, mpPlayersState[mpServerPlayer1Id].paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p1Color);
        }
        if (mpPlayersState && mpServerPlayer2Id && mpPlayersState[mpServerPlayer2Id]) {
            const p2Color = mpServerPlayer2Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
            drawPaddle_Styled_MP(mpCanvas.width - PADDLE_WIDTH - 10, mpPlayersState[mpServerPlayer2Id].paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p2Color);
        }
        if (mpPlayersState) drawScore_Styled_MP();
        return;
    }

    if (mpGameStatus === 'finished') {
        if (mpPlayersState && mpServerPlayer1Id && mpServerPlayer2Id && mpBallState) {
            drawMidline_Styled_MP();
            const p1Color = mpServerPlayer1Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
            const p2Color = mpServerPlayer2Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
            drawPaddle_Styled_MP(10, mpPlayersState[mpServerPlayer1Id].paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p1Color);
            drawPaddle_Styled_MP(mpCanvas.width - PADDLE_WIDTH - 10, mpPlayersState[mpServerPlayer2Id].paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p2Color);
            drawMultiplayerBall(mpBallState.x, mpBallState.y, '#FFFFFF');
            drawScore_Styled_MP();
        }
        return;
    }

    if (!mpBallState || !mpPlayersState || !mpServerPlayer1Id || !mpServerPlayer2Id ) {
         console.warn("[MultiplayerPong] renderMultiplayerFrame: Bailing before full render for in-progress game.",
            { mpBallState, mpPlayersState, mpServerPlayer1Id, mpServerPlayer2Id });
        return;
    }


    const leftPaddleX = 10;
    const rightPaddleX = mpCanvas.width - PADDLE_WIDTH - 10;
    const leftPlayerData = mpPlayersState[mpServerPlayer1Id];
    const rightPlayerData = mpPlayersState[mpServerPlayer2Id];

    if (leftPlayerData) {
        const p1Color = mpServerPlayer1Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
        drawPaddle_Styled_MP(leftPaddleX, leftPlayerData.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p1Color);
    }
    if (rightPlayerData) {
        const p2Color = mpServerPlayer2Id === mpMyPlayerId ? PLAYER_HIGHLIGHT_COLOR : DEFAULT_COLOR;
        drawPaddle_Styled_MP(rightPaddleX, rightPlayerData.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, p2Color);
    }

    drawMultiplayerBall(mpBallState.x, mpBallState.y, '#FFFFFF');
    drawMidline_Styled_MP();
    drawScore_Styled_MP();
}

const boundKeyDownHandler = (event: KeyboardEvent) => handleMultiplayerKeyDown(event);
const boundKeyUpHandler = (event: KeyboardEvent) => handleMultiplayerKeyUp(event);
let keysPressed: { [key: string]: boolean } = {};

function setupMultiplayerInputHandlers() {
    cleanupMultiplayerInputHandlers();
    keysPressed = {};
    document.addEventListener('keydown', boundKeyDownHandler);
    document.addEventListener('keyup', boundKeyUpHandler);
}

function cleanupMultiplayerInputHandlers() {
    document.removeEventListener('keydown', boundKeyDownHandler);
    document.removeEventListener('keyup', boundKeyUpHandler);
    keysPressed = {};
}

function handleMultiplayerKeyDown(event: KeyboardEvent) {
    if (!mpGameId || !sendPlayerInputToServer || mpGameStatus !== 'in-progress') return;
    let inputSent = false;
    if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        if (!keysPressed['w']) sendPlayerInputToServer(mpGameId, 'up');
        keysPressed['w'] = true; inputSent = true;
    } else if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') {
        if (!keysPressed['s']) sendPlayerInputToServer(mpGameId, 'down');
        keysPressed['s'] = true; inputSent = true;
    }
    if (inputSent) event.preventDefault();
}

function handleMultiplayerKeyUp(event: KeyboardEvent) {
    if (!mpGameId || !sendPlayerInputToServer || mpGameStatus !== 'in-progress') return;
    let inputSent = false;
    if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        sendPlayerInputToServer(mpGameId, 'stop_up');
        keysPressed['w'] = false; inputSent = true;
    } else if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') {
        sendPlayerInputToServer(mpGameId, 'stop_down');
        keysPressed['s'] = false; inputSent = true;
    }
    if (inputSent) event.preventDefault();
}

export function cleanupMultiplayerPong() {
    cleanupMultiplayerInputHandlers();
    document.removeEventListener('keydown', handleReadyUpKeyPress);

    mpGameId = null; mpMyPlayerId = null; mpOpponentPlayerId = null; mpOpponentUsername = null;
    mpServerPlayer1Id = null; mpServerPlayer2Id = null; mpBallState = null; mpPlayersState = null;
    mpGameStatus = null; localPlayerHasSignalledReady = false;

    if (mpCtx && mpCanvas) mpCtx.clearRect(0, 0, mpCanvas.width, mpCanvas.height);
    sendPlayerInputToServer = null; sendPlayerReadySignalToServer = null;
}