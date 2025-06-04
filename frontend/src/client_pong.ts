// client_pong.ts

interface ClientPaddle {
  x: number; y: number; width: number; height: number; color: string; score: number;
}
interface ClientBall {
  x: number; y: number; width: number; height: number; color: string;
}
interface PongMessage { // General interface for messages from Pong server
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
const WEBSOCKET_URL = 'ws://localhost:3000/ws/remotepong'; // TODO: Ensure this matches your Fastify port

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

const keyPress: Record<string, boolean> = {};
let animationFrameId: number | null = null;

function handleKeyDown(event: KeyboardEvent) { keyPress[event.key] = true; }
function handleKeyUp(event: KeyboardEvent) { keyPress[event.key] = false; }

function addKeyListeners() {
    document.removeEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.addEventListener("keyup", handleKeyUp);
    console.log("CLIENT_PONG.TS: Key listeners ADDED.");
}
function removeKeyListeners() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    console.log("CLIENT_PONG.TS: Key listeners REMOVED.");
}

export function handleUnexpectedDisconnection() {
    console.log("CLIENT_PONG.TS: handleUnexpectedDisconnection called.");
    gameIsRunningClient = false;
    // playerSide = null; // Keep side context or nullify as needed
    waitingForGameMessage = "Pong Connection Lost. Click button to retry.";
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    draw();

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
    if (!canvas) { console.warn("CLIENT_PONG.TS: initializeClientVisualsDefault - canvas not ready."); return; }
    leftPaddle = { x: 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: '#44bece', score: 0 };
    rightPaddle = { x: canvas.width - PADDLE_WIDTH_CLIENT - 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: '#FF69B4', score: 0 };
    ball = { x: canvas.width / 2 - BALL_WIDTH_CLIENT / 2, y: canvas.height / 2 - BALL_HEIGHT_CLIENT / 2, width: BALL_WIDTH_CLIENT, height: BALL_HEIGHT_CLIENT, color: 'white' };
    console.log("CLIENT_PONG.TS: Visuals initialized to default.");
    // No draw() here, let the calling context decide when to first draw.
}

function updateLocalGameState(serverBall: any, serverPaddles: any) {
  if (!ball || !leftPaddle || !rightPaddle) {
    initializeClientVisualsDefault();
  }
  if (serverBall) {
    ball.x = serverBall.x; ball.y = serverBall.y;
    // If server sends ball dimensions: ball.width = serverBall.width; ball.height = serverBall.height;
  }
  if (serverPaddles) {
    if (serverPaddles.left) { leftPaddle.y = serverPaddles.left.y; leftPaddle.score = serverPaddles.left.score; }
    if (serverPaddles.right) { rightPaddle.y = serverPaddles.right.y; rightPaddle.score = serverPaddles.right.score; }
  }
}

function draw(): void {
  if (!pongCtx || !canvas) return;
  const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
  bgGradient.addColorStop(0, "#001c3b"); bgGradient.addColorStop(0.5, "#234461"); bgGradient.addColorStop(1, "#001c3b");
  pongCtx.fillStyle = bgGradient; pongCtx.fillRect(0, 0, canvas.width, canvas.height);

  if (leftPaddle && rightPaddle && ball) {
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);
    pongCtx.fillStyle = ball.color;
    pongCtx.fillRect(ball.x, ball.y, ball.width, ball.height);
    drawMidline();
    drawScore();
  }
  // drawVerticalCRTLines(); // Uncomment if you have this function

  if (waitingForGameMessage) {
    pongCtx.font = "20px 'Press Start 2P'";
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.textAlign = "center";
    pongCtx.fillText(waitingForGameMessage, canvas.width / 2, canvas.height / 2);
  }
}

function drawMidline(): void {
  if (!pongCtx || !canvas) return;
  const segmentHeight = 20; const gap = 15; const lineWidth = 4;
  const x = canvas.width / 2 - lineWidth / 2;
  for (let y = 0; y < canvas.height; y += segmentHeight + gap) {
    pongCtx.fillStyle = "#d6ecff"; pongCtx.shadowColor = "#0fffff";
    pongCtx.fillRect(x, y, lineWidth, segmentHeight);
  }
}

function drawScore(): void {
  if (!leftPaddle || !rightPaddle || !pongCtx || !canvas) return;
  pongCtx.font = "64px 'Press Start 2P'"; pongCtx.textAlign = "center"; pongCtx.fillStyle = "#d6ecff";
  pongCtx.fillText(`${leftPaddle.score ?? 0}  ${rightPaddle.score ?? 0}`, canvas.width / 2, canvas.height / 6);
}

function drawPaddle(paddle: ClientPaddle): void {
  if (!paddle || !pongCtx || !canvas) return;
  let pulse = Math.sin(Date.now() * 0.4) * 0.5; pongCtx.shadowBlur = pulse;
  pongCtx.fillStyle = paddle.color; pongCtx.shadowColor = "#0fffff";
  roundRect(pongCtx, paddle.x, paddle.y, paddle.width, paddle.height, 10);
  pongCtx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}

let lastSentPaddleY: number | null = null;
const PADDLE_MOVE_SPEED_CLIENT = 7;

function handlePlayerInput(): void {
  if (!playerSide || playerSide === 'spectator' || !socket || socket.readyState !== WebSocket.OPEN || !gameIsRunningClient) return;
  const myPaddle = (playerSide === 'left') ? leftPaddle : rightPaddle;
  if (!myPaddle) return; // Should not happen if playerSide is set
  let moved = false;

  if (playerSide === 'left') {
    if (keyPress['w'] && myPaddle.y > 0) { myPaddle.y -= PADDLE_MOVE_SPEED_CLIENT; moved = true; }
    if (keyPress['s'] && myPaddle.y + myPaddle.height < canvas.height) { myPaddle.y += PADDLE_MOVE_SPEED_CLIENT; moved = true; }
  } else if (playerSide === 'right') {
    if (keyPress['ArrowUp'] && myPaddle.y > 0) { myPaddle.y -= PADDLE_MOVE_SPEED_CLIENT; moved = true; }
    if (keyPress['ArrowDown'] && myPaddle.y + myPaddle.height < canvas.height) { myPaddle.y += PADDLE_MOVE_SPEED_CLIENT; moved = true; }
  }
  
  myPaddle.y = Math.max(0, Math.min(myPaddle.y, canvas.height - myPaddle.height)); // Clamp

  if (moved && myPaddle.y !== lastSentPaddleY) {
    socket.send(JSON.stringify({ type: 'paddle_move', y: myPaddle.y }));
    lastSentPaddleY = myPaddle.y;
  } else if (!moved) {
    lastSentPaddleY = null;
  }
}

function clientGameLoop(): void {
  if (!gameIsRunningClient && !waitingForGameMessage) { // Only stop loop if game not running AND no message to display
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
  }
  if (!canvas) { /* ... stop loop ... */ return; }

  handlePlayerInput();
  draw();
  animationFrameId = requestAnimationFrame(clientGameLoop);
}

function connectToServerPromise(): Promise<{ playerId: number, username: string }> {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.CONNECTING) {
        console.warn("CLIENT_PONG.TS: connectToServerPromise: Already attempting to connect.");
        reject(new Error("Connection attempt already in progress."));
        return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.warn("CLIENT_PONG.TS: connectToServerPromise: Socket already open. This might indicate a logic error or a successful prior connection.");
        // If we have localPlayerId, it implies we might have authenticated.
        // This state should ideally be handled by startPongGame ensuring a clean slate if a *new* connection is desired.
        if (localPlayerId !== null) { // Check if we think we are authenticated from a previous session on this socket
            // This is tricky. For now, we'll let startPongGame handle it by closing this socket first if it wants a fresh one.
            // This promise is for a *new* full connection cycle.
        }
        // For safety, if this function is called when socket is OPEN, let startPongGame close it first if a fresh one is needed.
        // For now, let's reject, assuming startPongGame should have cleaned up.
        reject(new Error("Socket already open. Clean up before new connection."));
        return;
    }

    console.log("CLIENT_PONG.TS: Attempting NEW WebSocket connection to Pong server...");
    waitingForGameMessage = "Connecting to Pong...";
    draw();

    socket = new WebSocket(WEBSOCKET_URL);
    let promiseSettled = false;

    socket.onopen = () => {
      console.log("CLIENT_PONG.TS: WebSocket Connection Opened! Waiting for Pong auth success from server.");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as PongMessage;
        // console.log("CLIENT_PONG.TS: Received message:", message.type, message); // Verbose

        switch (message.type) {
            case 'pong_auth_success':
                if (promiseSettled) return;
                promiseSettled = true;
                localPlayerId = message.playerId as number;
                const username = message.username as string;
                console.log(`CLIENT_PONG.TS: Pong Auth Success! Player ID: ${localPlayerId}, Username: ${username}`);
                waitingForGameMessage = "Authenticated. Waiting for role...";
                resolve({ playerId: localPlayerId, username });
                break;
            case 'assign_side':
                playerSide = message.side!;
                if (playerSide === 'left') leftPaddle.color = '#39FF14'; // Player's paddle color
                else if (playerSide === 'right') rightPaddle.color = '#39FF14';
                waitingForGameMessage = `You are ${playerSide}. Waiting for opponent...`;
                console.log(`CLIENT_PONG.TS: Assigned side: ${playerSide}`);
                break;
            case 'initial_pong_state':
                updateLocalGameState(message.ball, message.paddles);
                playerSide = message.yourSide!;
                localPlayerId = message.yourPlayerId!;
                if (playerSide === 'left') leftPaddle.color = '#39FF14';
                else if (playerSide === 'right') rightPaddle.color = '#39FF14';
                gameIsRunningClient = message.gameIsRunning!;
                const numPlayers = message.playersInGame?.length || 0;
                if (message.gameIsRunning) waitingForGameMessage = null;
                else if (numPlayers < 2) waitingForGameMessage = `You are ${playerSide}. Waiting for ${2 - numPlayers} opponent...`;
                else waitingForGameMessage = `You are ${playerSide}. Ready.`;
                break;
            case 'game_start':
                gameIsRunningClient = true;
                waitingForGameMessage = null;
                updateLocalGameState(message.ball, message.paddles);
                // Server now sends playerSides map with IDs, so client can always know who is who
                if (message.playerSides && localPlayerId !== null) {
                    playerSide = message.playerSides[localPlayerId.toString()] || playerSide; // Update if needed
                    if (playerSide === 'left') leftPaddle.color = '#39FF14';
                    else if (playerSide === 'right') rightPaddle.color = '#39FF14';
                }
                console.log("CLIENT_PONG.TS: Game started!");
                break;
            case 'game_update':
                if (gameIsRunningClient) updateLocalGameState(message.ball, message.paddles);
                break;
            case 'game_over':
                gameIsRunningClient = false;
                waitingForGameMessage = `Game Over! ${message.winnerSide ? message.winnerSide.toUpperCase() + ' WINS!' : (message.reason || '')}.`;
                // (main.ts handles "Press Enter" via its own key listener, looking at waitingForGameMessage)
                console.log("CLIENT_PONG.TS: Game over.");
                break;
            case 'status_update': // Generic status from server
                if (message.context?.startsWith('pong_')) { // Only pong-related status
                    waitingForGameMessage = message.message || "Server update...";
                }
                break;
            case 'player_joined_pong':
            case 'player_left_pong':
                 console.log("CLIENT_PONG.TS: Player joined/left:", message.user);
                 // Potentially update a player list UI here or the waiting message if game not started
                 if(!gameIsRunningClient) { // pongRoom is server-side concept
                    // client needs its own count or rely on server's waiting message
                 }
                 break;
            case 'error':
                if (message.context?.startsWith('pong_')) {
                    console.error("CLIENT_PONG.TS: Pong Server sent an error:", message.message);
                    waitingForGameMessage = `Error: ${message.message}`;
                    if (message.message?.toLowerCase().includes("authentication") && !promiseSettled) {
                        promiseSettled = true;
                        reject(new Error(message.message));
                    }
                }
                break;
            default:
                // console.log("CLIENT_PONG.TS: Unhandled message type:", message.type);
        }
         draw();
      } catch (e) {
        console.error("CLIENT_PONG.TS: Error processing message:", e, event.data);
      }
    };

    socket.onerror = (event) => {
      console.error("CLIENT_PONG.TS: WebSocket Error Event:", event);
      if (!promiseSettled) {
        promiseSettled = true;
        reject(new Error("WebSocket connection error event."));
      }
      socket = null; // Ensure socket is cleared on error
      handleUnexpectedDisconnection();
    };

    socket.onclose = (event) => {
      console.log("CLIENT_PONG.TS: WebSocket Connection Closed for Pong.", `Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
      if (!promiseSettled && event.code !== 1000 /* Normal closure */ && event.code !== 4001 /* Server replaced */) {
        promiseSettled = true;
        reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason || ''}`));
      }
      socket = null; // Ensure socket is cleared on close
      handleUnexpectedDisconnection();
    };
  });
}

export async function startPongGame(): Promise<void> {
  console.log("CLIENT_PONG.TS: startPongGame (multiplayer) called.");

  if (!canvas || !pongCtx) {
    console.error("CLIENT_PONG.TS: Canvas not set. Call setCanvas first.");
    waitingForGameMessage = "Error: Canvas not ready for Pong.";
    if (typeof draw === 'function') draw(); // Attempt to draw error if possible
    throw new Error("Canvas not set for Pong.");
  }
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  
  addKeyListeners();
  initializeClientVisualsDefault();
  draw(); // Draw initial "connecting" or default state
  gameIsRunningClient = false;
  playerSide = null;
  // Do not reset localPlayerId here; it's set upon successful auth via connectToServerPromise

  try{
    // If a previous socket exists and isn't properly closed, explicitly close it.
    if (socket) {
        console.log("CLIENT_PONG.TS: Previous socket instance found in startPongGame. Closing it before new attempt.");
        socket.onclose = null; // Detach old handlers to prevent them from interfering
        socket.onerror = null;
        if(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, "Client re-initiating connection");
        }
        socket = null; // Nullify it so connectToServerPromise creates a new one
    }

    await connectToServerPromise(); // This promise resolves after 'pong_auth_success'
    console.log("CLIENT_PONG.TS: Connection promise resolved. Pong setup successful. Starting game loop.");
    animationFrameId = requestAnimationFrame(clientGameLoop); // Start game loop only on success
  }
  catch (error){
    console.error("CLIENT_PONG.TS: Failed to establish Pong connection in startPongGame:", error);
    waitingForGameMessage = `Pong Connection Failed: ${error.message || "Unknown error"}`;
    if (typeof draw === 'function') draw();
    removeKeyListeners(); // Remove listeners if connection failed
    socket = null; // Ensure socket is null after a failed attempt from connectToServerPromise
    throw error; 
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
    socket.onopen = null; // Detach all listeners to prevent them from firing during/after explicit close
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null; // Crucial: prevent default onclose from calling handleUnexpectedDisconnection again
    
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        console.log("CLIENT_PONG.TS: Closing active WebSocket connection.");
        socket.close(1000, "Client called stopPongGame.");
    }
    socket = null;
  }

  gameIsRunningClient = false;
  playerSide = null;
  // localPlayerId = null; // Decide if user ID should be cleared on stop
  waitingForGameMessage = "Pong game stopped.";
  console.log('CLIENT_PONG.TS: Multiplayer Pong stopped and resources cleaned.');
  initializeClientVisualsDefault(); // Reset to default screen
  draw();
}
