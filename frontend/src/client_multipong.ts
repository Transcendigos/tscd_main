// client_localmultipong.ts

interface LMPaddle { y: number; score: number; } // Only need y and score for rendering
interface LMBall { x: number; y: number; }
interface LMMessage {
    type: string;
    ball?: LMBall;
    paddles?: { left: LMPaddle, right: LMPaddle };
    gameIsRunning?: boolean;
    promptStart?: boolean;
    waitingForRestart?: boolean;
    message?: string;
    context?: string;
}

let lmCanvas: HTMLCanvasElement;
let lmPongCtx: CanvasRenderingContext2D;
let lmSocket: WebSocket | null = null;
const LM_WEBSOCKET_URL = 'ws://localhost:3000/ws/localpong'; // Matches server route

// Client-side visual representation (updated by server)
let lmLeftPaddle: { x: number, y: number, width: number, height: number, color: string, score: number };
let lmRightPaddle: { x: number, y: number, width: number, height: number, color: string, score: number };
let lmBall: { x: number, y: number, width: number, height: number, color: string };

// UI state flags
let lmGameIsRunning = false;
let lmPromptStartActive = true; // Client assumes prompt at start
let lmWaitingForRestart = false;
let lmStatusMessage: string | null = "Initializing Local Pong...";


const LM_PADDLE_WIDTH = 8;
const LM_PADDLE_HEIGHT = 70;
const LM_BALL_SIZE = 10;

const lmKeyPress: Record<string, boolean> = {};
let lmAnimationFrameId: number | null = null;

function lmHandleKeyDown(event: KeyboardEvent) { lmKeyPress[event.key.toLowerCase()] = true; } // Use toLowerCase for consistency
function lmHandleKeyUp(event: KeyboardEvent) { lmKeyPress[event.key.toLowerCase()] = false; }

function lmAddKeyListeners() {
    document.removeEventListener("keydown", lmHandleKeyDown); // Remove first to avoid duplicates
    document.addEventListener("keydown", lmHandleKeyDown);
    document.removeEventListener("keyup", lmHandleKeyUp);
    document.addEventListener("keyup", lmHandleKeyUp);
    console.log("CLIENT_LOCALMULTIPONG.TS: Key listeners ADDED.");
}
function lmRemoveKeyListeners() {
    document.removeEventListener("keydown", lmHandleKeyDown);
    document.removeEventListener("keyup", lmHandleKeyUp);
    Object.keys(lmKeyPress).forEach(key => lmKeyPress[key] = false); // Clear current presses
    console.log("CLIENT_LOCALMULTIPONG.TS: Key listeners REMOVED.");
}


export function setCanvas_LM(c: HTMLCanvasElement): void {
  lmCanvas = c;
  if (lmCanvas) {
    lmPongCtx = lmCanvas.getContext('2d')!;
    // Initialize default visual properties
    lmLeftPaddle = { 
        x: 10, y: lmCanvas.height / 2 - LM_PADDLE_HEIGHT / 2, 
        width: LM_PADDLE_WIDTH, height: LM_PADDLE_HEIGHT, color: '#44bece', score: 0 
    };
    lmRightPaddle = { 
        x: lmCanvas.width - LM_PADDLE_WIDTH - 10, y: lmCanvas.height / 2 - LM_PADDLE_HEIGHT / 2, 
        width: LM_PADDLE_WIDTH, height: LM_PADDLE_HEIGHT, color: '#FF69B4', score: 0 
    };
    lmBall = { 
        x: lmCanvas.width / 2 - LM_BALL_SIZE / 2, y: lmCanvas.height / 2 - LM_BALL_SIZE / 2, 
        width: LM_BALL_SIZE, height: LM_BALL_SIZE, color: 'white' 
    };
    console.log("CLIENT_LOCALMULTIPONG.TS: Canvas set and visuals initialized.");
  } else {
    console.error("CLIENT_LOCALMULTIPONG.TS: Attempted to set null canvas.");
  }
}

function lmUpdateLocalState(serverBall?: LMBall, serverPaddles?: { left: LMPaddle, right: LMPaddle }) {
  if (!lmBall || !lmLeftPaddle || !lmRightPaddle) { // Should be initialized by setCanvas_LM
    console.warn("CLIENT_LOCALMULTIPONG.TS: Visuals not ready in lmUpdateLocalState.");
    if (lmCanvas) setCanvas_LM(lmCanvas); // Attempt re-init
    else return;
  }
  if (serverBall) {
    lmBall.x = serverBall.x; lmBall.y = serverBall.y;
  }
  if (serverPaddles) {
    if (serverPaddles.left) { lmLeftPaddle.y = serverPaddles.left.y; lmLeftPaddle.score = serverPaddles.left.score; }
    if (serverPaddles.right) { lmRightPaddle.y = serverPaddles.right.y; lmRightPaddle.score = serverPaddles.right.score; }
  }
}

// --- Drawing Functions (similar to client_pong.ts, but prefixed with lm) ---
function lmDraw(): void {
  if (!lmPongCtx || !lmCanvas) return;
  const bgGradient = lmPongCtx.createLinearGradient(0, 0, 0, lmCanvas.height);
  bgGradient.addColorStop(0, "#001c3b"); bgGradient.addColorStop(0.5, "#234461"); bgGradient.addColorStop(1, "#001c3b");
  lmPongCtx.fillStyle = bgGradient; lmPongCtx.fillRect(0, 0, lmCanvas.width, lmCanvas.height);

  if (lmLeftPaddle && lmRightPaddle && lmBall) {
    lmDrawPaddle(lmLeftPaddle); lmDrawPaddle(lmRightPaddle);
    lmPongCtx.fillStyle = lmBall.color;
    lmPongCtx.fillRect(lmBall.x, lmBall.y, lmBall.width, lmBall.height);
    lmDrawMidline(); lmDrawScore();
  }

  if (lmStatusMessage) {
    lmPongCtx.font = "20px 'Press Start 2P'"; lmPongCtx.fillStyle = "#d6ecff";
    lmPongCtx.textAlign = "center";
    lmPongCtx.fillText(lmStatusMessage, lmCanvas.width / 2, lmCanvas.height / 2);
  }
}

function lmDrawMidline(): void {
  const segmentHeight = 20; const gap = 15; const lineWidth = 4;
  const x = lmCanvas.width / 2 - lineWidth / 2;
  for (let y = 0; y < lmCanvas.height; y += segmentHeight + gap) {
    lmPongCtx.fillStyle = "#d6ecff"; lmPongCtx.shadowColor = "#0fffff";
    lmPongCtx.fillRect(x, y, lineWidth, segmentHeight);
  }
}

function lmDrawScore(): void {
  lmPongCtx.font = "64px 'Press Start 2P'"; lmPongCtx.textAlign = "center"; lmPongCtx.fillStyle = "#d6ecff";
  const sL = lmLeftPaddle?.score ?? 0;
  const sR = lmRightPaddle?.score ?? 0;
  lmPongCtx.fillText(`${sL}  ${sR}`, lmCanvas.width / 2, lmCanvas.height / 6);
}

function lmDrawPaddle(paddle: { x: number, y: number, width: number, height: number, color: string }): void {
  let pulse = Math.sin(Date.now() * 0.4) * 0.5; lmPongCtx.shadowBlur = pulse;
  lmPongCtx.fillStyle = paddle.color; lmPongCtx.shadowColor = "#0fffff";
  lmRoundrect(lmPongCtx, paddle.x, paddle.y, paddle.width, paddle.height, 10);
  lmPongCtx.fill();
}

function lmRoundrect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}
// --- End Drawing Functions ---

function lmHandlePlayerInput(): void {
  if (!lmSocket || lmSocket.readyState !== WebSocket.OPEN || !lmGameIsRunning) return;

  // Left paddle (W, S)
  if (lmKeyPress['w']) {
    lmSocket.send(JSON.stringify({ type: 'local_paddle_move', side: 'left', direction: 'up' }));
  } else if (lmKeyPress['s']) {
    lmSocket.send(JSON.stringify({ type: 'local_paddle_move', side: 'left', direction: 'down' }));
  }

  // Right paddle (ArrowUp, ArrowDown)
  if (lmKeyPress['arrowup']) {
    lmSocket.send(JSON.stringify({ type: 'local_paddle_move', side: 'right', direction: 'up' }));
  } else if (lmKeyPress['arrowdown']) {
    lmSocket.send(JSON.stringify({ type: 'local_paddle_move', side: 'right', direction: 'down' }));
  }
}

function lmClientGameLoop(): void {
    if (!lmCanvas || !lmPongCtx) {
        console.warn("CLIENT_LOCALMULTIPONG.TS: Canvas/Context not available in game loop. Stopping.");
        if (lmAnimationFrameId) cancelAnimationFrame(lmAnimationFrameId);
        lmAnimationFrameId = null;
        return;
    }
    
    if (lmGameIsRunning) {
        lmHandlePlayerInput(); // Send inputs if game is running
    } else {
        // Handle "Press Enter/Space to Start" when not running but prompts are active
        if ((lmPromptStartActive || lmWaitingForRestart) && (lmKeyPress['enter'] || lmKeyPress[' '])) {
            if (lmSocket && lmSocket.readyState === WebSocket.OPEN) {
                lmSocket.send(JSON.stringify({ type: 'request_start_local_game' }));
                lmKeyPress['enter'] = false; // Consume key press
                lmKeyPress[' '] = false;     // Consume key press
            }
        }
    }
    lmDraw();
    lmAnimationFrameId = requestAnimationFrame(lmClientGameLoop);
}


export async function startPongGame_LM(): Promise<void> { // Renamed to avoid conflict
  console.log("CLIENT_LOCALMULTIPONG.TS: startPongGame_LM called.");

  if (!lmCanvas || !lmPongCtx) {
    console.error("CLIENT_LOCALMULTIPONG.TS: Canvas not set. Call setCanvas_LM first.");
    lmStatusMessage = "Error: Canvas not ready.";
    if (typeof lmDraw === 'function') lmDraw();
    throw new Error("Canvas not set for Local Multiplayer Pong.");
  }

  if (lmAnimationFrameId) cancelAnimationFrame(lmAnimationFrameId);
  lmAnimationFrameId = null;
  
  // Ensure default visuals are set based on current canvas dimensions
  setCanvas_LM(lmCanvas); // This re-initializes paddle/ball objects too

  lmAddKeyListeners();
  lmGameIsRunning = false;
  lmPromptStartActive = true;
  lmWaitingForRestart = false;
  lmStatusMessage = "Connecting to Local Pong...";
  lmDraw();

  return new Promise((resolve, reject) => {
    if (lmSocket && (lmSocket.readyState === WebSocket.OPEN || lmSocket.readyState === WebSocket.CONNECTING)) {
        console.log("CLIENT_LOCALMULTIPONG.TS: Closing existing socket before new attempt.");
        lmSocket.onclose = null; // Prevent old onclose from firing
        lmSocket.onerror = null;
        lmSocket.close(1000, "Client re-initiating local pong session");
        lmSocket = null;
    }

    lmSocket = new WebSocket(LM_WEBSOCKET_URL);

    lmSocket.onopen = () => {
      console.log("CLIENT_LOCALMULTIPONG.TS: WebSocket Connection Opened!");
      lmStatusMessage = "Connected! Waiting for server..."; // Initial state often promptStart
      // No specific auth message for local pong, server sends state directly
      if (!lmAnimationFrameId) lmAnimationFrameId = requestAnimationFrame(lmClientGameLoop);
      resolve(); // Resolve promise on successful connection
    };

    lmSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as LMMessage;
        // console.log("CLIENT_LOCALMULTIPONG.TS: Received message:", message.type, message);

        switch (message.type) {
            case 'local_game_state':
                lmUpdateLocalState(message.ball, message.paddles);
                lmGameIsRunning = message.gameIsRunning!;
                lmPromptStartActive = message.promptStart!;
                lmWaitingForRestart = message.waitingForRestart!;

                if (lmPromptStartActive) lmStatusMessage = "Press Enter or Space to Start";
                else if (lmWaitingForRestart) {
                    const winner = lmLeftPaddle.score >= WINNING_SCORE_LM ? "Left Player" : (lmRightPaddle.score >= WINNING_SCORE_LM ? "Right Player" : "Someone");
                    lmStatusMessage = `${winner} Wins! Press Enter/Space`;
                }
                else if (lmGameIsRunning) lmStatusMessage = null; // Game is on, no message
                else lmStatusMessage = "Waiting for server..."; // Default fallback
                break;
            // 'game_start' and 'game_over' implicit via local_game_state flags for simplicity in local version
            case 'error':
                 console.error("CLIENT_LOCALMULTIPONG.TS: Server error:", message.message);
                 lmStatusMessage = `Error: ${message.message}`;
                 break;
            default:
                // console.log("CLIENT_LOCALMULTIPONG.TS: Unhandled message type:", message.type);
        }
        // lmDraw(); // Drawing is handled by the game loop
      } catch (e) {
        console.error("CLIENT_LOCALMULTIPONG.TS: Error processing message:", e, event.data);
      }
    };

    lmSocket.onerror = (event) => {
      console.error("CLIENT_LOCALMULTIPONG.TS: WebSocket Error:", event);
      lmStatusMessage = "Connection Error. Please Retry.";
      if (lmAnimationFrameId) cancelAnimationFrame(lmAnimationFrameId); lmAnimationFrameId = null;
      lmRemoveKeyListeners();
      lmDraw(); // Draw error state
      lmSocket = null;
      reject(new Error("WebSocket connection error for Local Pong."));
    };

    lmSocket.onclose = (event) => {
      console.log(`CLIENT_LOCALMULTIPONG.TS: WebSocket Closed. Code: ${event.code}, Clean: ${event.wasClean}`);
      lmStatusMessage = "Disconnected. Click button to retry.";
      lmGameIsRunning = false; lmPromptStartActive = false; lmWaitingForRestart = false;
      if (lmAnimationFrameId) cancelAnimationFrame(lmAnimationFrameId); lmAnimationFrameId = null;
      lmRemoveKeyListeners();
      lmDraw(); // Draw disconnected state
      lmSocket = null;
      // Don't reject here if resolve was already called, or handle based on event.wasClean
      if (!event.wasClean && typeof reject === 'function' ) { /* reject if needed */ }
    };
  }).catch(err => { // Catch errors from the new Promise itself (e.g., if WebSocket constructor fails)
    console.error("CLIENT_LOCALMULTIPONG.TS: Promise error during connection setup:", err);
    lmStatusMessage = `Setup Failed: ${err.message || "Unknown"}`;
    if (typeof lmDraw === 'function') lmDraw();
    throw err; // Re-throw to be caught by main.ts
  });
}

export function stopPongGame_LM(): void { // Renamed
  console.log('CLIENT_LOCALMULTIPONG.TS: stopPongGame_LM called.');
  lmRemoveKeyListeners();
  if (lmAnimationFrameId) {
    cancelAnimationFrame(lmAnimationFrameId);
    lmAnimationFrameId = null;
  }
  if (lmSocket) {
    lmSocket.onopen = null; lmSocket.onmessage = null; lmSocket.onerror = null; lmSocket.onclose = null;
    if (lmSocket.readyState === WebSocket.OPEN || lmSocket.readyState === WebSocket.CONNECTING) {
      lmSocket.close(1000, "Client stopped local pong game.");
    }
    lmSocket = null;
  }
  lmGameIsRunning = false;
  lmPromptStartActive = true; // Reset to initial state for display
  lmWaitingForRestart = false;
  lmStatusMessage = "Local Pong stopped.";
  console.log('CLIENT_LOCALMULTIPONG.TS: Local Multiplayer Pong stopped.');
  if (lmCanvas) { // Re-initialize visuals to default if canvas exists
    setCanvas_LM(lmCanvas); 
    lmDraw();
  }
}