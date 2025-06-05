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
  dt: number;
  predictY: number;
  hitZ: number;
  paddleCenter: number;
  bounce: number;
  exchange: number;
  color: string;
}

interface ScorePayload {
  tournamentId: number | null;
  matchId: number;
  userId: number;
  username: string | null;
  score: number;
  scoreAgainst: number;
  won: boolean;
  vsAI: boolean;
  durationSeconds: number;
  opponentId: number | null;
  opponentUsername: string | null;
  isDisconnected: boolean;
  rankDelta: number;
}

type UserInfo = { userId: number; username: string };
let currentUser: UserInfo = { userId: -1, username: "" }; // TEMP invalid default, overwritten on fetch
let matchId: number;
let matchStartTime: number;
let opponentId = -1; // hard-coded for now
let opponentUsername = "AI"; // hard-coded for now
let opponentScore: number;

async function fetchCurrentUser() {
	try {
		const response = await fetch("http://localhost:3000/api/me", {
			credentials: "include",
		});

		if (!response.ok) {
			throw new Error("User not signed in.");
		}

		const data = await response.json();
		console.log("User info:", data);
		currentUser = { 
			userId: data.user.userId,
			username: data.user.username };
	} catch (err) {
		console.error("❌ Failed to fetch user:", err);
		alert("You must be signed in to play.");
		throw err; // force early failure if accessed too soon
	}
}

let leftPaddle: Paddle, rightPaddle: Paddle, ball: Ball;
let leftScore = 0;
let rightScore = 0;
let waitingForRestart = false;

let ballStartX: number, ballStartY: number;
let leftPaddleStart: number, rightPaddleStart: number;

const paddleWidth = 8;
const paddleHeight = 70;
const maxSpeed = 500;

const ballWidth = 10;
const ballHeight = 10;
const ballStartV = 200;

let aiDifficulty = 1;
let aiPrecision = 5;

let lastTime: number;
let aiMode = true;
const AI_RATE = 1000;

let animationFrameId: number | null = null;
let aiIntervalId: number | null = null;
let gameIsRunning = false;

let flickerPhase = 0;

const keyPress: Record<string, boolean> = {};
document.addEventListener("keydown", (event) => {
  keyPress[event.key] = true;
});
document.addEventListener("keydown", (event) => {
  if (waitingForRestart && event.key === "Enter") {
    // waitingForRestart = false;
    // leftScore = 0;
    // rightScore = 0;
    // resetPos();
    // lastTime = performance.now();
    // requestAnimationFrame(gameLoop);
    startPongGame();
  }
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
    dt: 0,
    predictY: 0,
    hitZ: 0,
    paddleCenter: 1,
    bounce: 0,
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

  if (rightScore - leftScore < 0) aiDifficulty = 1;
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
  pongCtx.clearRect(0, 0, canvas.width, canvas.height);

  const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
  bgGradient.addColorStop(0, "#001c3b");
  bgGradient.addColorStop(0.5, "#234461");
  bgGradient.addColorStop(1, "#001c3b");

  pongCtx.fillStyle = bgGradient;
  pongCtx.fillRect(0, 0, canvas.width, canvas.height);

  pongCtx.fillStyle = "#ffffff";
  pongCtx.fillRect(ball.x, ball.y, ball.width, ball.height);

  drawPaddle(leftPaddle);
  drawPaddle(rightPaddle);

  drawMidline();
  drawScore();
  drawVerticalCRTLines();
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
  if (ball.exchange > 5 && aiDifficulty < 3) aiDifficulty++;
}

function updateDifficulty(): void {
  const gap = rightScore - leftScore;
  if (gap <= 0 && aiDifficulty > 1) aiDifficulty--;
  else if (gap > 0 && aiDifficulty < 3) aiDifficulty++;
  aiPrecision = 10 + 15 * (aiDifficulty - 1);
}

function updateAi(paddleSpeed: number): void {
  let aimZone = aiPrecision + aiPrecision * ball.bounce;
  let paddleCenter = rightPaddle.y + ball.paddleCenter;

  if (aiDifficulty === 3 && ball.vx < 0) return;

  if (
    ball.predictY >= paddleCenter - aimZone &&
    ball.predictY <= paddleCenter + aimZone
  ) {
    return;
  }
  if (ball.predictY <= paddleCenter && rightPaddle.y > 0) {
    rightPaddle.y -= paddleSpeed;
  }
  if (
    ball.predictY >= paddleCenter &&
    rightPaddle.y + rightPaddle.height < canvas.height
  ) {
    rightPaddle.y += paddleSpeed;
  }
}

function predictBall(ball: Ball, paddleX: number): void {
  let simX = ball.x;
  let simY = ball.y;
  let simDx = ball.vx * ball.dt;
  let simDy = ball.vy * ball.dt;
  ball.bounce = 0;

  while ((simDx > 0 && simX < paddleX) || (simDx < 0 && simX > paddleX)) {
    simX += simDx;
    simY += simDy;

    if (simY < 0 || simY > canvas.height) {
      simDy = -simDy;
      simY = Math.max(0, Math.min(canvas.height, simY));
      ball.bounce++;
    }
  }

  ball.predictY = simY;
}

function update(dt: number): void {
  const paddleSpeed = 500 * dt;

  if (keyPress["w"] && leftPaddle.y > 0) leftPaddle.y -= paddleSpeed;
  if (keyPress["s"] && leftPaddle.y + leftPaddle.height < canvas.height)
    leftPaddle.y += paddleSpeed;

  if (aiMode) updateAi(paddleSpeed);

  leftPaddle.dv = leftPaddle.y - leftPaddle.prevY;
  leftPaddle.prevY = leftPaddle.y;
  rightPaddle.dv = rightPaddle.y - rightPaddle.prevY;
  rightPaddle.prevY = rightPaddle.y;

  ball.dt = dt;
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
    if (aiMode) updateDifficulty();
    resetPos();
  }

  if (ball.x > canvas.width) {
    leftScore++;
    if (aiMode) updateDifficulty();
    resetPos();
  }
}

function gameLoop(currentTime: number): void {
	if (!gameIsRunning) return;

	const delta = (currentTime - lastTime) / 1000;
	lastTime = currentTime;
	update(delta);
	draw();

	const winningScore = 1; // hard-coded for now

	if (leftScore >= winningScore || rightScore >= winningScore) {
		const finalScore = Math.max(leftScore, rightScore);
		opponentScore = Math.min(leftScore, rightScore);

		const won = leftScore > rightScore; // assume user always controls left


		const winnerId = won ? currentUser!.userId : opponentId;
		const loserId = won ? opponentId : currentUser!.userId;

		gameIsRunning = false;

		animationFrameId = requestAnimationFrame(() => {
		endGame(winnerId, loserId, finalScore);
		});
		return;
	}
	animationFrameId = requestAnimationFrame(gameLoop);
}

async function postScore(payload: ScorePayload): Promise<void> {
	try {
		const response = await fetch("http://localhost:3000/api/scores", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			tournament_id: payload.tournamentId,
			match_id: payload.matchId,
			user_id: payload.userId,
			username: payload.username,
			score: payload.score,
			score_against: payload.scoreAgainst,
			won: payload.won,
			vs_ai: payload.vsAI,
			duration_seconds: payload.durationSeconds,
			opponent_id: payload.opponentId,
			opponent_username: payload.opponentUsername,
			is_disconnected: payload.isDisconnected,
			rank_delta: payload.rankDelta
		})
		});

		if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`❌ Failed to save score: ${response.status} ${errorText}`);
		}

		console.log("✅ Score saved!", payload);
	} catch (err) {
		console.error("❌ Error saving score:", err);
	}
}

async function endGame(winnerId: number, loserId: number, finalScore: number) {
	console.log(`Game Over! Winner: ${winnerId}, Score: ${finalScore}`);
	
	const durationSeconds = Math.floor((performance.now() - matchStartTime) / 1000);
	const isWinner = currentUser!.userId === winnerId;
	const myScore = isWinner ? finalScore : opponentScore;
	const theirScore = isWinner ? opponentScore : finalScore;

	try {
		await postScore({
			tournamentId: null,
			matchId,
			userId: currentUser.userId,
			username: currentUser.username,
			score: myScore,
			scoreAgainst: theirScore,
			won: isWinner,
			vsAI: true, // hard-coded for now
			durationSeconds,
			opponentId: null, // hard-coded for now because AI opponent only
			opponentUsername,
			isDisconnected: false,
			rankDelta: 0 // hard-coded for now
			});
	} catch (err) {
		console.error("❌ Error saving score:", err);
	}

	if (pongCtx && canvas) {
		pongCtx.font = "32px 'Press Start 2P'";
		pongCtx.fillStyle = "#d6ecff";
		pongCtx.textAlign = "center";
		pongCtx.fillText(
		"Press Enter to play a new match",
		canvas.width / 2,
		canvas.height / 2
		);
	}
	waitingForRestart = true;
}

export async function startPongGame(): Promise<void> {
  if (gameIsRunning) {
    console.log("Pong game is already running. Stopping previous instance.");
    stopPongGame();
  }
  if (!canvas || !pongCtx) {
    console.error("Canvas or context not initialized. Cannot start Pong game.");
    const localCanvas = document.getElementById(
      "pongCanvas"
    ) as HTMLCanvasElement;
    if (localCanvas) setCanvas(localCanvas);
    else return;
    if (!pongCtx) return;
  }

  console.log("Starting Pong game...");
  await fetchCurrentUser();
  matchId = Date.now(); // temporary id, later use a backend-generated id
  matchStartTime = performance.now();

  initGameObjects();
  leftScore = 0;
  rightScore = 0;
  waitingForRestart = false;
  gameIsRunning = true;

  lastTime = performance.now();

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(gameLoop);

  if (aiIntervalId !== null) {
    clearInterval(aiIntervalId);
  }
  aiIntervalId = setInterval(() => {
    if (!gameIsRunning || !aiMode || !ball || !rightPaddle || !canvas) return;
    if (ball.vx < 0) {
      ball.predictY = canvas.height / 2;
    } else {
      predictBall(ball, rightPaddle.x);
    }
    ball.paddleCenter = Math.random() * paddleHeight;

    const baseDelay = { 1: 60, 2: 120, 3: 220 }[aiDifficulty] || 120;
    const reactionDelay = baseDelay + Math.random() * 50;
  }, AI_RATE);
}

export function stopPongGame(): void {
  console.log("Stopping Pong game...");
  gameIsRunning = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (aiIntervalId !== null) {
    clearInterval(aiIntervalId);
    aiIntervalId = null;
  }

  leftScore = 0;
  rightScore = 0;
  waitingForRestart = false;

  
  if (pongCtx && canvas) {
    pongCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
  console.log("Pong game stopped and resources cleaned.");
}
