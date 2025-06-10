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
const WEBSOCKET_URL = 'ws://localhost:3000/ws/remotepong';

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

function handleKeyDown(event: KeyboardEvent) { keyPress[event.key.toLowerCase()] = true; }
function handleKeyUp(event: KeyboardEvent) { keyPress[event.key.toLowerCase()] = false; }

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
    if (!canvas) { console.warn("CLIENT_PONG.TS: initializeClientVisualsDefault - canvas not ready."); return; }
    const defaultColor = '#44bece';
    const playerHighlightColor = '#39FF14';

    leftPaddle = { x: 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: defaultColor, score: 0 };
    rightPaddle = { x: canvas.width - PADDLE_WIDTH_CLIENT - 10, y: canvas.height / 2 - PADDLE_HEIGHT_CLIENT / 2, width: PADDLE_WIDTH_CLIENT, height: PADDLE_HEIGHT_CLIENT, color: defaultColor, score: 0 };
    
    // Update colors based on playerSide if already known
    if (playerSide === 'left') {
        leftPaddle.color = playerHighlightColor;
        rightPaddle.color = defaultColor;
    } else if (playerSide === 'right') {
        rightPaddle.color = playerHighlightColor;
        leftPaddle.color = defaultColor;
    }

    ball = { x: canvas.width / 2 - BALL_WIDTH_CLIENT / 2, y: canvas.height / 2 - BALL_HEIGHT_CLIENT / 2, width: BALL_WIDTH_CLIENT, height: BALL_HEIGHT_CLIENT, color: 'white' };
    console.log("CLIENT_PONG.TS: Visuals initialized/updated. Player side:", playerSide);
}

function updatePaddleColors() {
    const defaultColor = '#44bece';
    const playerHighlightColor = '#39FF14';

    if (!leftPaddle || !rightPaddle) initializeClientVisualsDefault();

    if (playerSide === 'left') {
        if(leftPaddle) leftPaddle.color = playerHighlightColor;
        if(rightPaddle) rightPaddle.color = defaultColor;
    } else if (playerSide === 'right') {
        if(rightPaddle) rightPaddle.color = playerHighlightColor;
        if(leftPaddle) leftPaddle.color = defaultColor;
    } else { // Spectator or no side assigned yet
        if(leftPaddle) leftPaddle.color = defaultColor;
        if(rightPaddle) rightPaddle.color = defaultColor;
    }
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
  updatePaddleColors(); // Ensure paddle colors are correct after state update
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
  pongCtx.shadowBlur = 0;
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
  if (!myPaddle) return;

  let moved = false;
  
  if (keyPress['w'] && myPaddle.y > 0) {
    myPaddle.y -= PADDLE_MOVE_SPEED_CLIENT;
    moved = true;
  }
  if (keyPress['s'] && myPaddle.y + myPaddle.height < canvas.height) { // 's' for DOWN
    myPaddle.y += PADDLE_MOVE_SPEED_CLIENT;
    moved = true;
  }

  // UNCOMMENT THOS AND COMMENT BLOCK ABOVE TO USE ARROWS INSTEAD OF W AND S
  // if (keyPress['arrowup'] && myPaddle.y > 0) {
  //   myPaddle.y -= PADDLE_MOVE_SPEED_CLIENT;
  //   moved = true;
  // }
  // if (keyPress['arrowdown'] && myPaddle.y + myPaddle.height < canvas.height) {
  //   myPaddle.y += PADDLE_MOVE_SPEED_CLIENT;
  //   moved = true;
  // }
  
  myPaddle.y = Math.max(0, Math.min(myPaddle.y, canvas.height - myPaddle.height));

  if (moved && myPaddle.y !== lastSentPaddleY) {
    socket.send(JSON.stringify({ type: 'paddle_move', y: myPaddle.y }));
    lastSentPaddleY = myPaddle.y;
  } else if (!moved && lastSentPaddleY !== null) {
    lastSentPaddleY = null;
  }
}

function clientGameLoop(): void {
  if (!gameIsRunningClient && !waitingForGameMessage) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
  }
  if (!canvas || !pongCtx) {
      console.error("CLIENT_PONG.TS: Canvas or context not available in game loop. Stopping.");
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      waitingForGameMessage = "Error: Canvas unavailable.";
      return;
  }

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
        console.warn("CLIENT_PONG.TS: connectToServerPromise: Socket already open, but a new connection was requested. This is unexpected if startPongGame is used correctly.");
        reject(new Error("Socket already open. Ensure old socket is closed before new connection."));
        return;
    }

    console.log("CLIENT_PONG.TS: Attempting NEW WebSocket connection to Pong server...");
    waitingForGameMessage = "Connecting to Pong...";
    if (typeof draw === 'function') draw();


    const newSocket = new WebSocket(WEBSOCKET_URL);
    let promiseSettled = false;

    const onOpenHandler = () => {
      if (promiseSettled) return;
      socket = newSocket;
      console.log("CLIENT_PONG.TS: WebSocket Connection Opened! Waiting for Pong auth success from server.");
    };

    const onMessageHandler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as PongMessage;

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
                updatePaddleColors();
                waitingForGameMessage = `You are ${playerSide}. Waiting for opponent...`;
                console.log(`CLIENT_PONG.TS: Assigned side: ${playerSide}`);
                break;
            case 'initial_pong_state':
                playerSide = message.yourSide!;
                localPlayerId = message.yourPlayerId!;
                updateLocalGameState(message.ball, message.paddles);
                gameIsRunningClient = message.gameIsRunning!;
                const numPlayers = message.playersInGame?.length || 0;
                if (message.gameIsRunning) {
                    waitingForGameMessage = null;
                } else if (numPlayers < 2) {
                    waitingForGameMessage = `You are ${playerSide}. Waiting for ${2 - numPlayers} opponent...`;
                } else {
                    waitingForGameMessage = `You are ${playerSide}. Ready to play.`;
                }
                break;
            case 'game_start':
                gameIsRunningClient = true;
                waitingForGameMessage = null;
                if (message.playerSides && localPlayerId !== null) {
                    playerSide = message.playerSides[localPlayerId.toString()] || playerSide;
                }
                updateLocalGameState(message.ball, message.paddles);
                console.log("CLIENT_PONG.TS: Game started!");
                break;
            case 'game_update':
                if (gameIsRunningClient) updateLocalGameState(message.ball, message.paddles);
                break;
            case 'game_over':
                gameIsRunningClient = false;
                waitingForGameMessage = `Game Over! ${message.winnerSide ? message.winnerSide.toUpperCase() + ' WINS!' : (message.reason || '')}.`;
                console.log("CLIENT_PONG.TS: Game over.");
                break;
            case 'status_update':
                if (message.context?.startsWith('pong_')) {
                    waitingForGameMessage = message.message || "Server update...";
                }
                break;
            case 'player_joined_pong':
            case 'player_left_pong':
                 console.log("CLIENT_PONG.TS: Player joined/left:", message.user);
                 if(!gameIsRunningClient && message.type === 'player_left_pong' && waitingForGameMessage && !waitingForGameMessage.toLowerCase().includes("error") && !waitingForGameMessage.toLowerCase().includes("lost")) {
                 }
                 break;
            case 'error':
                if (message.context?.startsWith('pong_')) {
                    console.error("CLIENT_PONG.TS: Pong Server sent an error:", message.message);
                    waitingForGameMessage = `Error: ${message.message}`;
                    if (message.message?.toLowerCase().includes("authentication") && !promiseSettled) {
                        promiseSettled = true;
                        if (socket !== newSocket) newSocket.close(1000, "Auth error before socket fully assigned");
                        reject(new Error(message.message));
                    }
                }
                break;
            default:
                // console.log("CLIENT_PONG.TS: Unhandled message type:", message.type);
        }
        if (typeof draw === 'function') draw();
      } catch (e) {
        console.error("CLIENT_PONG.TS: Error processing message:", e, event.data);
      }
    };

    const onErrorHandler = (event: Event) => {
      console.error("CLIENT_PONG.TS: WebSocket Error Event:", event);
      if (!promiseSettled) {
        promiseSettled = true;
        reject(new Error("WebSocket connection error event."));
      }
      if (newSocket.readyState !== WebSocket.CLOSED) {
          newSocket.close();
      }
      if (socket === newSocket) {
          socket = null;
      }
      handleUnexpectedDisconnection();
    };

    const onCloseHandler = (event: CloseEvent) => {
      console.log("CLIENT_PONG.TS: WebSocket Connection Closed for Pong.", `Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
      if (!promiseSettled && event.code !== 1000 && event.code !== 4001 && !event.wasClean) {
        promiseSettled = true;
        reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason || ''}`));
      }
      newSocket.onopen = null;
      newSocket.onmessage = null;
      newSocket.onerror = null;
      newSocket.onclose = null;

      if (socket === newSocket) {
          socket = null; 
          handleUnexpectedDisconnection();
      } else if (!promiseSettled && !gameIsRunningClient) { 
          handleUnexpectedDisconnection();
      }
    };

    newSocket.onopen = onOpenHandler;
    newSocket.onmessage = onMessageHandler;
    newSocket.onerror = onErrorHandler;
    newSocket.onclose = onCloseHandler;
  });
}

export async function startPongGame(): Promise<void> {
  console.log("CLIENT_PONG.TS: startPongGame (multiplayer) called.");

  if (!canvas || !pongCtx) {
    console.error("CLIENT_PONG.TS: Canvas not set. Call setCanvas first.");
    waitingForGameMessage = "Error: Canvas not ready for Pong.";
    if (typeof draw === 'function') draw();
    throw new Error("Canvas not set for Pong.");
  }
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  
  addKeyListeners();
  gameIsRunningClient = false;
  playerSide = null; 
  
  initializeClientVisualsDefault();
  if (typeof draw === 'function') draw();


  try{
    if (socket) {
        console.log("CLIENT_PONG.TS: Previous socket instance found in startPongGame. Closing it before new attempt.");
        socket.onclose = null; 
        socket.onerror = null;
        if(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, "Client re-initiating connection");
        }
        socket = null; 
    }

    await connectToServerPromise(); 
    console.log("CLIENT_PONG.TS: Connection promise resolved. Pong setup successful. Starting game loop.");
    if (canvas && pongCtx) {
        animationFrameId = requestAnimationFrame(clientGameLoop);
    } else {
        throw new Error("Canvas became unavailable after connection.");
    }

  }
  catch (error: any){
    console.error("CLIENT_PONG.TS: Failed to establish Pong connection in startPongGame:", error);
    waitingForGameMessage = `Pong Connection Failed: ${error.message || "Unknown error"}`;
    if (typeof draw === 'function') draw();
    removeKeyListeners(); 
    if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, "Connection failed during setup");
        }
        socket = null;
    }
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
    socket.onopen = null; 
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null; 
    
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        console.log("CLIENT_PONG.TS: Closing active WebSocket connection from stopPongGame.");
        socket.close(1000, "Client called stopPongGame.");
    }
    socket = null;
  }

  gameIsRunningClient = false;
  playerSide = null;
  // localPlayerId = null; // Decide if user ID should be cleared
  waitingForGameMessage = "Pong game stopped.";
  console.log('CLIENT_PONG.TS: Multiplayer Pong stopped and resources cleaned.');
  initializeClientVisualsDefault();
  if (typeof draw === 'function') draw();
}
