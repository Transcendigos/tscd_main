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

let leftPaddle: Paddle, rightPaddle: Paddle, ball: Ball;
let leftScore = 0;
let rightScore = 0;

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

let flickerPhase = 0;

const keyPress: Record<string, boolean> = {};
document.addEventListener("keydown", (event) => {
  keyPress[event.key] = true;
});
document.addEventListener("keyup", (event) => {
  keyPress[event.key] = false;
});

export function setCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  pongCtx = canvas.getContext("2d")!;
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
}

function resetPos(): void {
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
  pongCtx.fillText(`${leftScore}  ${rightScore}`, canvas.width / 2, canvas.height / 6);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
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
  if (ball.predictY >= paddleCenter && rightPaddle.y + rightPaddle.height < canvas.height) {
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
  if (keyPress["s"] && leftPaddle.y + leftPaddle.height < canvas.height) leftPaddle.y += paddleSpeed;

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
  const delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  draw();
  update(delta);
  requestAnimationFrame(gameLoop);
}

export function startPongGame(): void {
  initGameObjects();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  setInterval(() => {
    if (!aiMode) return;
    if (ball.vx < 0) {
      ball.predictY = canvas.height / 2;
    }
    predictBall(ball, rightPaddle.x);
    ball.paddleCenter = Math.random() * paddleHeight;

    const baseDelay = { 1: 60, 2: 120, 3: 220 }[aiDifficulty] || 120;
    const reactionDelay = baseDelay + Math.random() * 50;
    setTimeout(() => updateAi(500 * 0.016), reactionDelay);
  }, AI_RATE);
}
