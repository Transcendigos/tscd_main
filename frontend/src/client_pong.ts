// client_pong.ts

interface ClientPaddle {
  x: number; y: number; width: number; height: number; color: string; score: number;
}
interface ClientBall {
  x: number; y: number; width: number; height: number; color: string;
}
interface PongMessage {
    type: string;
    message?: string;
    context?: string;
    playerId?: number;
    username?: string;
    side?: 'left' | 'right' | 'spectator';
    ball?: any;
    paddles?: any;
    gameIsRunning?: boolean;
    yourPlayerId?: number;
    yourSide?: 'left' | 'right' | 'spectator';
    playerSides?: { [key: string]: 'left' | 'right' };
    playersInGame?: {id: number, username: string, side: string | null}[];
    winnerSide?: 'left' | 'right' | null;
    scores?: { left: number, right: number };
    reason?: string;
    user?: {id: number, username: string, side: string | null};
}


let canvas: HTMLCanvasElement;
let pongCtx: CanvasRenderingContext2D;

let socket: WebSocket | null = null;
const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsHost = window.location.host;
const WEBSOCKET_URL = `${wsProtocol}://${wsHost}/ws/remotepong`;

let localPlayerId: number | null = null;
let playerSide: 'left' | 'right' | 'spectator' | null = null;

let leftPaddle: ClientPaddle;
let rightPaddle: ClientPaddle;
let ball: ClientBall;

let gameIsRunningClient = false;
let waitingForGameMessage: string | null = "Initializing Pong...";

const PADDLE_WIDTH_CLIENT = 8;
const PADDLE_HEIGHT_CLIENT = 70;
const BALL_WIDTH_CLIENT = 10;
const BALL_HEIGHT_CLIENT = 10;

const keysPressed: { [key: string]: boolean } = {};
let animationFrameId: number | null = null;
let flickerPhase = 0;


// --- Input Handling ---
function handleKeyDown(event: KeyboardEvent) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !gameIsRunningClient) return;
    const key = event.key.toLowerCase();
    if ((key === 'w' || key === 'arrowup') && !keysPressed[key]) {
        keysPressed[key] = true;
        socket.send(JSON.stringify({ type: 'PADDLE_INPUT', input: 'up' }));
    } else if ((key === 's' || key === 'arrowdown') && !keysPressed[key]) {
        keysPressed[key] = true;
        socket.send(JSON.stringify({ type: 'PADDLE_INPUT', input: 'down' }));
    }
}

function handleKeyUp(event: KeyboardEvent) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !gameIsRunningClient) return;
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') {
        keysPressed[key] = false;
        socket.send(JSON.stringify({ type: 'PADDLE_INPUT', input: 'stop_up' }));
    } else if (key === 's' || key === 'arrowdown') {
        keysPressed[key] = false;
        socket.send(JSON.stringify({ type: 'PADDLE_INPUT', input: 'stop_down' }));
    }
}

function addKeyListeners() {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
}
function removeKeyListeners() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    for (const key in keysPressed) {
        keysPressed[key] = false;
    }
}

// --- Connection & State Management ---

export function handleUnexpectedDisconnection() {
    gameIsRunningClient = false;
    waitingForGameMessage = "Pong Connection Lost. Click button to retry.";
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    if (typeof draw === 'function') draw();
    if ((window as any).pongConnectionLostCallback) {
        (window as any).pongConnectionLostCallback();
    }
    removeKeyListeners();
}

export function setCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  if (canvas) {
    pongCtx = canvas.getContext('2d')!;
    initializeClientVisualsDefault();
  } else {
    console.error("CLIENT_PONG.TS: Attempted to set null canvas.");
  }
}

function initializeClientVisualsDefault(): void {
    if (!canvas) return;
    const defaultColor = '#d6ecff';
    const playerHighlightColor = '#39FF14';

    leftPaddle = { x: 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: defaultColor, score: 0 };
    rightPaddle = { x: canvas.width - PADDLE_WIDTH_CLIENT - 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: defaultColor, score: 0 };
    
    updatePaddleColors();

    ball = { x: canvas.width / 2 - BALL_WIDTH_CLIENT / 2, y: canvas.height / 2 - BALL_HEIGHT_CLIENT / 2, width: BALL_WIDTH_CLIENT, height: BALL_HEIGHT_CLIENT, color: '#FFFFFF' };
}

function updatePaddleColors() {
    const defaultColor = '#d6ecff'; // Default paddle color from styled version
    const playerHighlightColor = '#39FF14'; // Green highlight for local player

    if (!leftPaddle || !rightPaddle) initializeClientVisualsDefault();

    leftPaddle.color = (playerSide === 'left') ? playerHighlightColor : defaultColor;
    rightPaddle.color = (playerSide === 'right') ? playerHighlightColor : defaultColor;
}


function updateLocalGameState(serverBall: any, serverPaddles: any) {
  if (!ball || !leftPaddle || !rightPaddle) {
    initializeClientVisualsDefault();
  }
  if (serverBall) {
    ball.x = serverBall.x; ball.y = serverBall.y;
  }
  if (serverPaddles) {
    if (serverPaddles.left) { leftPaddle.y = serverPaddles.left.y; leftPaddle.score = serverPaddles.left.score; }
    if (serverPaddles.right) { rightPaddle.y = serverPaddles.right.y; rightPaddle.score = serverPaddles.right.score; }
  }
}

// --- Drawing Functions (Harmonized with chatMulti) ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

function drawVerticalCRTLines_Styled() {
    if (!pongCtx || !canvas) return;
    let pulse = Math.sin(Date.now() * 0.01) * 2 + Math.sin(Date.now() * 0.05) * 3; 
    pongCtx.shadowBlur = Math.abs(pulse);
    pongCtx.shadowColor = "#000fff";
    flickerPhase += 0.05; 
    const flickerAlpha = 0.02 + 0.01 * Math.sin(flickerPhase); 
    pongCtx.save();
    pongCtx.globalAlpha = flickerAlpha + 0.05; 
    pongCtx.strokeStyle = "#00ffff";
    pongCtx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 4) { 
        pongCtx.beginPath();
        pongCtx.moveTo(0, y);
        pongCtx.lineTo(canvas.width, y);
        pongCtx.stroke();
    }
    pongCtx.restore();
    pongCtx.shadowBlur = 0;
}

function drawMidline_Styled(): void {
  if (!pongCtx || !canvas) return;
  const segmentHeight = 20; const gap = 15; const lineWidth = 4;
  const x = canvas.width / 2 - lineWidth / 2;
  pongCtx.fillStyle = "#d6ecff";
  pongCtx.shadowColor = "#0fffff";
  for (let y = 0; y < canvas.height; y += segmentHeight + gap) {
      pongCtx.shadowBlur = 2;
      pongCtx.fillRect(x, y, lineWidth, segmentHeight);
  }
  pongCtx.shadowBlur = 0;
}

function drawScore_Styled(): void {
  if (!leftPaddle || !rightPaddle || !pongCtx || !canvas) return;
  pongCtx.font = "64px 'Press Start 2P'";
  pongCtx.textAlign = "center";
  pongCtx.fillStyle = "#d6ecff";
  pongCtx.shadowColor = "#0fffff";
  pongCtx.shadowBlur = 3;
  pongCtx.fillText(`${leftPaddle.score ?? 0}  ${rightPaddle.score ?? 0}`, canvas.width / 2, canvas.height / 6);
  pongCtx.shadowBlur = 0;
}

function drawPaddle_Styled(paddle: ClientPaddle): void {
  if (!paddle || !pongCtx) return;
  let pulse = Math.sin(Date.now() * 0.2) * 1 + 1.5; 
  pongCtx.shadowBlur = pulse;
  // Use the color from the paddle object, which is set to green for the local player
  pongCtx.shadowColor = paddle.color === '#39FF14' ? paddle.color : "#0fffff";
  pongCtx.fillStyle = paddle.color;
  roundRect(pongCtx, paddle.x, paddle.y, paddle.width, paddle.height, 5);
  pongCtx.fill();
  pongCtx.shadowBlur = 0;
}

function draw(): void {
  if (!pongCtx || !canvas) return;
  
  // New styled background
  const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
  bgGradient.addColorStop(0, "#1e293b");
  bgGradient.addColorStop(0.5, "#1b3f72");
  bgGradient.addColorStop(1, "#1e293b");
  pongCtx.fillStyle = bgGradient;
  pongCtx.fillRect(0, 0, canvas.width, canvas.height);
  
  drawVerticalCRTLines_Styled();

  if (leftPaddle && rightPaddle && ball) {
    drawPaddle_Styled(leftPaddle);
    drawPaddle_Styled(rightPaddle);
    pongCtx.fillStyle = ball.color;
    pongCtx.fillRect(ball.x, ball.y, ball.width, ball.height);
    drawMidline_Styled();
    drawScore_Styled();
  }

  if (waitingForGameMessage) {
    pongCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    pongCtx.fillRect(0, 0, canvas.width, canvas.height);
    pongCtx.font = "20px 'Press Start 2P'";
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.textAlign = "center";
    pongCtx.fillText(waitingForGameMessage, canvas.width / 2, canvas.height / 2);
  }
}


function clientGameLoop(): void {
  if (!canvas || !pongCtx) {
      console.error("CLIENT_PONG.TS: Canvas or context not available in game loop. Stopping.");
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      waitingForGameMessage = "Error: Canvas unavailable.";
      return;
  }
  
  if (gameIsRunningClient || waitingForGameMessage) {
      draw();
      animationFrameId = requestAnimationFrame(clientGameLoop);
  } else {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
  }
}

// --- WebSocket Logic ---

function connectToServerPromise(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        reject(new Error("Socket connection already exists or is in progress."));
        return;
    }

    waitingForGameMessage = "Connecting to Pong...";
    draw();

    const newSocket = new WebSocket(WEBSOCKET_URL);

    newSocket.onopen = () => {
      socket = newSocket;
      console.log("CLIENT_PONG.TS: WebSocket Connection Opened!");
      // The server will now authenticate via the cookie and send 'assign_side'
    };

    newSocket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as PongMessage;

        switch (message.type) {
            case 'assign_side':
                playerSide = message.side!;
                updatePaddleColors();
                waitingForGameMessage = `You are ${playerSide}. Waiting for opponent...`;
                resolve(); // Connection is now considered successful and ready
                break;
            case 'game_start':
                gameIsRunningClient = true;
                waitingForGameMessage = null;
                updatePaddleColors(); // Ensure colors are correct at game start
                break;
            case 'game_update':
                if (gameIsRunningClient) {
                    updateLocalGameState(message.ball, message.paddles);
                }
                break;
            case 'game_over':
                gameIsRunningClient = false;
                waitingForGameMessage = `Game Over! ${message.winnerSide ? message.winnerSide.toUpperCase() + ' WINS!' : (message.reason || '')}.`;
                break;
            case 'status_update':
                if (!gameIsRunningClient) {
                    waitingForGameMessage = message.message || "Server update...";
                }
                break;
            case 'error':
                console.error("CLIENT_PONG.TS: Pong Server sent an error:", message.message);
                waitingForGameMessage = `Error: ${message.message}`;
                reject(new Error(message.message));
                break;
        }
      } catch (e) {
        console.error("CLIENT_PONG.TS: Error processing message:", e, event.data);
      }
    };

    newSocket.onerror = (event: Event) => {
      console.error("CLIENT_PONG.TS: WebSocket Error Event:", event);
      reject(new Error("WebSocket connection error."));
      handleUnexpectedDisconnection();
    };

    newSocket.onclose = (event: CloseEvent) => {
      console.log("CLIENT_PONG.TS: WebSocket Connection Closed.", `Code: ${event.code}, Reason: "${event.reason}"`);
      reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
      handleUnexpectedDisconnection();
    };
  });
}

export async function startPongGame(): Promise<void> {
  if (!canvas || !pongCtx) {
    console.error("CLIENT_PONG.TS: Canvas not set. Call setCanvas first.");
    throw new Error("Canvas not set for Pong.");
  }
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  
  addKeyListeners();
  gameIsRunningClient = false;
  playerSide = null; 
  
  initializeClientVisualsDefault();
  draw();

  try{
    if (socket) {
        socket.onclose = null; 
        socket.onerror = null;
        if(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, "Client re-initiating connection");
        }
        socket = null; 
    }

    await connectToServerPromise(); 
    console.log("CLIENT_PONG.TS: Connection promise resolved. Starting game loop.");
    animationFrameId = requestAnimationFrame(clientGameLoop);

  } catch (error: any) {
    console.error("CLIENT_PONG.TS: Failed to establish Pong connection:", error);
    waitingForGameMessage = `Pong Connection Failed: ${error.message || "Unknown error"}`;
    draw();
    removeKeyListeners();
  }
}

export function stopPongGame(): void {
  console.log('CLIENT_PONG.TS: stopPongGame called (multiplayer).');
  removeKeyListeners();
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (socket) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Client called stopPongGame.");
    }
    socket = null;
  }

  gameIsRunningClient = false;
  playerSide = null;
  waitingForGameMessage = null;
  initializeClientVisualsDefault();
  draw();
}