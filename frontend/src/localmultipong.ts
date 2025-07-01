let canvas: HTMLCanvasElement;
let pongCtx: CanvasRenderingContext2D;

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  prevY: number;
  dv: number;
  color: string;
}

interface Ball {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hitZ: number;
  exchange: number;
  color: string;
}

interface UserInfo {
  signedIn: boolean;
  userId?: number;
}

let currentUser: UserInfo = { signedIn: false };

function getApiUrl(path: string) {
  const base = import.meta.env.VITE_API_URL || '';
  return base + path;
}

async function fetchCurrentUser() {
  try {
    const response = await fetch(getApiUrl("/api/me"), {
      credentials: "include",
    });
    if (!response.ok) {
      console.log("User not signed in.");
      currentUser = { signedIn: false };
      return;
    }

    const data = await response.json();
    console.log("User info:", data);

    currentUser = {
      signedIn: data.signedIn,
      userId: data.user?.userId,
    };
  } catch (err) {
    console.error("Error fetching user info:", err);
    currentUser = { signedIn: false };
  }
}

async function postScore(tournamentId: number, userId: number, score: number) {
  try {
    const response = await fetch(getApiUrl("/api/scores"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournament_id: tournamentId,
        user_id: userId,
        score: score,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save score");
    }

    const data = await response.json();
    console.log("Score saved!", data);
  } catch (err) {
    console.error("Error saving score:", err);
  }
}

let leftPaddle: Paddle, rightPaddle: Paddle, ball: Ball;
let leftScore = 0;
let rightScore = 0;
let waitingForRestart = false;
let promptStartMessageActive = false;

let ballStartX: number, ballStartY: number;
let leftPaddleStart: number, rightPaddleStart: number;

const paddleWidth = 8;
const paddleHeight = 70;
const maxSpeed = 500;

const ballWidth = 10;
const ballHeight = 10;
const ballStartV = 200;

let lastTime: number;

let animationFrameId: number | null = null;
let gameIsRunning = false;

let flickerPhase = 0;

const keyPress: Record<string, boolean> = {};


document.addEventListener("keydown", (event) => {
  if (promptStartMessageActive && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault(); // Prevent default browser action (e.g., space scrolling)
    promptStartMessageActive = false;
    gameIsRunning = true;
    lastTime = performance.now();
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);//good practice
    }
    animationFrameId = requestAnimationFrame(gameLoop); // Start the game
    return; // Event handled
  }

  // Handle restart after game over
  if (waitingForRestart && event.key === "Enter") {
    event.preventDefault();
    startPongGame();
    return;
  }

  keyPress[event.key] = true;
});

document.addEventListener("keyup", (event) => {
  keyPress[event.key] = false;
});

export function setCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  if (canvas) pongCtx = canvas.getContext("2d")!;
}

function initGameObjects(): void {
  leftPaddle = {
    x: 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    prevY: 0,
    dv: 0,
    color: "#44bece",
  };

  rightPaddle = {
    x: canvas.width - paddleWidth - 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    prevY: 0,
    dv: 0,
    color: "#44bece",
  };

  ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: ballWidth,
    height: ballHeight,
    vx: 200,
    vy: 200,
    hitZ: 0,
    exchange: 0,
    color: "white",
  };

  ballStartX = canvas.width / 2 - ball.width / 2;
  ballStartY = canvas.height / 2 - ball.height / 2;

  leftPaddleStart = canvas.height / 2 - paddleHeight / 2;
  rightPaddleStart = canvas.height / 2 - paddleHeight / 2;

  resetPos();
}

function resetPos(): void {
  if (!leftPaddle || !rightPaddle || !ball) {
    console.warn("Game objects not initialized before resetPos");
    return;
  }

  leftPaddle.y = leftPaddleStart;
  rightPaddle.y = rightPaddleStart;

  ball.x = ballStartX;
  ball.y = ballStartY;

  ball.vx = ballStartV * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = (Math.random() > 0.5 ? 1 : -1) * 100;
  ball.exchange = 0;
}

function drawMidline(): void {
  const segmentHeight = 20;
  const gap = 15;
  const lineWidth = 4;
  const x = canvas.width / 2 - lineWidth / 2;
  for (let y = 0; y < canvas.height; y += segmentHeight + gap) {
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.shadowColor = "#0fffff";
    pongCtx.fillRect(x, y, lineWidth, segmentHeight);
  }
}

function drawScore(): void {
  pongCtx.font = "64px 'Press Start 2P'";
  pongCtx.fillStyle = "#d6ecff";
  pongCtx.textAlign = "center";
  pongCtx.fillText(
    `${leftScore}  ${rightScore}`,
    canvas.width / 2,
    canvas.height / 6
  );
}

function drawVerticalCRTLines(): void {
  let pulse = Math.sin(Date.now() * 0.1) * 3;
  pongCtx.shadowBlur = pulse;

  pongCtx.shadowColor = "#000fff";

  flickerPhase += 0.1;
  const flickerAlpha = 0.04 + 0.01 * Math.sin(flickerPhase);

  pongCtx.save();
  pongCtx.globalAlpha = flickerAlpha + 0.1;
  pongCtx.strokeStyle = "#00ffff";
  pongCtx.lineWidth = 1;

  for (let y = 0; y < canvas.height; y += 3) {
    pongCtx.beginPath();
    pongCtx.moveTo(0, y);
    pongCtx.lineTo(canvas.width, y);
    pongCtx.stroke();
  }

  pongCtx.restore();
}

function drawPaddle(paddle: Paddle): void {
  let pulse = Math.sin(Date.now() * 0.4) * 0.5;
  pongCtx.shadowBlur = pulse;

  pongCtx.fillStyle = "#d6ecff";
  pongCtx.shadowColor = "#0fffff";

  roundRect(pongCtx, paddle.x, paddle.y, paddle.width, paddle.height, 10);
  pongCtx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
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

function draw(): void {
  if (!pongCtx || !canvas) return;

  pongCtx.clearRect(0, 0, canvas.width, canvas.height);

  const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
  bgGradient.addColorStop(0, "#001c3b");
  bgGradient.addColorStop(0.5, "#234461");
  bgGradient.addColorStop(1, "#001c3b");

  pongCtx.fillStyle = bgGradient;
  pongCtx.fillRect(0, 0, canvas.width, canvas.height);

  drawVerticalCRTLines();

  pongCtx.fillStyle = "#ffffff";
  if (ball) {
    pongCtx.fillRect(ball.x, ball.y, ball.width, ball.height);
  }


  if (leftPaddle && rightPaddle) {
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);
  }


  drawMidline();
  drawScore();

  if (promptStartMessageActive) {
    pongCtx.font = "24px 'Press Start 2P'";
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.textAlign = "center";
    pongCtx.fillText(
      "Press Enter or Space to Start",
      canvas.width / 2,
      canvas.height / 2
    );
  }
}

function isColliding(ball: Ball, paddle: Paddle): boolean {
  return (
    ball.x < paddle.x + paddle.width &&
    ball.x + ball.width > paddle.x &&
    ball.y < paddle.y + paddle.height &&
    ball.y + ball.height > paddle.y
  );
}

function handleCollision(ball: Ball, paddle: Paddle): void {
  ball.vx *= -1.1;
  ball.vx = Math.max(Math.min(ball.vx, maxSpeed), -maxSpeed);

  const hitZone = (ball.y - paddle.y) / paddleHeight;
  ball.hitZ = hitZone;

  const maxAngle = 250;
  const deflect = (hitZone - 0.5) * 2 * maxAngle;

  if (hitZone >= 0.4 && hitZone <= 0.6) {
    ball.vy = 0;
    ball.vx *= 1.3;
  } else {
    ball.vy = deflect + paddle.dv * 15;
  }

  ball.exchange++;
}

function update(dt: number): void {
  const paddleSpeed = 500 * dt;

  if (!leftPaddle || !rightPaddle || !ball) return;

  // Left paddle controls
  if (keyPress["w"] && leftPaddle.y > 0) leftPaddle.y -= paddleSpeed;
  if (keyPress["s"] && leftPaddle.y + leftPaddle.height < canvas.height)
    leftPaddle.y += paddleSpeed;

  // Right paddle controls
  if (keyPress["ArrowUp"] && rightPaddle.y > 0) rightPaddle.y -= paddleSpeed;
  if (keyPress["ArrowDown"] && rightPaddle.y + rightPaddle.height < canvas.height)
    rightPaddle.y += paddleSpeed;


  leftPaddle.dv = leftPaddle.y - leftPaddle.prevY;
  leftPaddle.prevY = leftPaddle.y;
  rightPaddle.dv = rightPaddle.y - rightPaddle.prevY;
  rightPaddle.prevY = rightPaddle.y;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y <= 0 || ball.y + ball.height >= canvas.height) {
    ball.vy *= -1;
    ball.y = Math.max(0, Math.min(canvas.height - ball.height, ball.y));
  }

  if (isColliding(ball, leftPaddle)) {
    ball.x = leftPaddle.x + ball.width;
    handleCollision(ball, leftPaddle);
  }

  if (isColliding(ball, rightPaddle)) {
    ball.x = rightPaddle.x - ball.width;
    handleCollision(ball, rightPaddle);
  }

  if (ball.x + ball.width + 5 < 0) {
    rightScore++;
    resetPos();
  }

  if (ball.x > canvas.width) {
    leftScore++;
    resetPos();
  }
}

function gameLoop(currentTime: number): void {
  if (!gameIsRunning) return; // Don't run if game isn't active

  const delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  update(delta);
  draw();

  const winningScore = 2; 

  if (leftScore >= winningScore || rightScore >= winningScore) {
    const winnerId = leftScore >= winningScore ? 1 : 2; 
    const finalScore = Math.max(leftScore, rightScore);

    endGame(winnerId, finalScore);
    return;
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

async function endGame(winnerId: number, finalScore: number) {
  console.log(`Game Over! Player ${winnerId} wins! Score: ${finalScore}`);
  gameIsRunning = false; // Stop the game logic

  // Post score if the current user is the winner
  if (currentUser.signedIn && currentUser.userId === winnerId) {
    try {
      await postScore(1, currentUser.userId, finalScore); // Assuming tournamentId is 1
    } catch (err) {
      console.error("Error saving score:", err);
    }
  } else if (currentUser.signedIn && currentUser.userId !== winnerId) {
    console.log("Current user is not the winner; skipping score saving for this player.");
  } else {
     console.log("User not signed in; skipping score saving.");
  }

  // Use a new animation frame to draw the end game screen to ensure it's rendered
  if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId); // Cancel the main game loop
      animationFrameId = null;
  }
  
  animationFrameId = requestAnimationFrame(() => {
    if (pongCtx && canvas) {
      pongCtx.clearRect(0, 0, canvas.width, canvas.height);
      const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, "#001c3b");
      bgGradient.addColorStop(0.5, "#234461");
      bgGradient.addColorStop(1, "#001c3b");
      pongCtx.fillStyle = bgGradient;
      pongCtx.fillRect(0, 0, canvas.width, canvas.height);
      drawVerticalCRTLines();

      pongCtx.font = "32px 'Press Start 2P'";
      pongCtx.fillStyle = "#d6ecff";
      pongCtx.textAlign = "center";
      pongCtx.fillText(
        `Player ${winnerId} Wins!`,
        canvas.width / 2,
        canvas.height / 2 - 40
      );
      pongCtx.fillText(
        "Press Enter to play a new match",
        canvas.width / 2,
        canvas.height / 2 + 20
      );
    }
  });
  waitingForRestart = true;
}

export async function startPongGame(): Promise<void> {
  // Stop any existing game animation frame (gameLoop or endGame screen)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (gameIsRunning) {
     console.log("Pong game was running. Stopping previous instance.");
  }

  gameIsRunning = false;

  if (!canvas || !pongCtx) {
    console.error("Canvas or context not initialized. Attempting to find #pongCanvas.");
    const localCanvas = document.getElementById(
      "pongCanvas"
    ) as HTMLCanvasElement;
    if (localCanvas) {
        setCanvas(localCanvas);
    } else {
        console.error("Essential canvas #pongCanvas not found. Cannot start Pong game.");
        return;
    }
    if (!pongCtx) { 
        console.error("Canvas context could not be obtained. Cannot start Pong game.");
        return;
    }
  }

  console.log("Setting up Pong game for start prompt...");
  await fetchCurrentUser();

  initGameObjects(); 
  leftScore = 0;
  rightScore = 0;
  waitingForRestart = false; 
  promptStartMessageActive = true;

  draw();
}

export function stopPongGame(): void {
  console.log("Stopping Pong game...");
  gameIsRunning = false;
  promptStartMessageActive = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  leftScore = 0;
  rightScore = 0;
  waitingForRestart = false;

  if (pongCtx && canvas) {
    pongCtx.clearRect(0, 0, canvas.width, canvas.height);
    // Optionally draw a "Game Stopped" or initial screen here
    // For example, you could draw a simple background:
    // const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
    // bgGradient.addColorStop(0, "#001c3b");
    // bgGradient.addColorStop(0.5, "#234461");
    // bgGradient.addColorStop(1, "#001c3b");
    // pongCtx.fillStyle = bgGradient;
    // pongCtx.fillRect(0, 0, canvas.width, canvas.height);
    // pongCtx.font = "24px 'Press Start 2P'";
    // pongCtx.fillStyle = "#d6ecff";
    // pongCtx.textAlign = "center";
    // pongCtx.fillText("Game Stopped", canvas.width / 2, canvas.height / 2);
  }
  console.log("Pong game stopped and resources cleaned.");
}
