let canvas: HTMLCanvasElement;
let pongCtx: CanvasRenderingContext2D;

interface Paddle { x: number; y: number; width: number; height: number; color: string; }
interface Ball { x: number; y: number; width: number; height: number; vx: number; vy: number; color: string; }

let leftPaddle: Paddle, rightPaddle: Paddle, ball: Ball;
let leftScore = 0;
let rightScore = 0;
const winningScore = 5;

let player1Alias = "Player 1";
let player2Alias = "Player 2";
let onGameOverCallback: ((winnerAlias: string) => void) | null = null;

let animationFrameId: number | null = null;
let gameIsRunning = false;
let isGameOver = false; // <<< FIX: Add game over flag
let flickerPhase = 0;
const keyPress: Record<string, boolean> = {};

document.addEventListener("keydown", (event) => { keyPress[event.key] = true; });
document.addEventListener("keyup", (event) => { keyPress[event.key] = false; });

export function setCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  if (canvas) {
    pongCtx = canvas.getContext("2d")!;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
}

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

function drawMidline() {
    if (!pongCtx || !canvas) return;
    const segmentHeight = 20, gap = 15, lineWidth = 4, x = canvas.width / 2 - lineWidth / 2;
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.shadowColor = "#0fffff";
    for (let y = 0; y < canvas.height; y += segmentHeight + gap) {
        pongCtx.shadowBlur = 2; 
        pongCtx.fillRect(x, y, lineWidth, segmentHeight);
    }
    pongCtx.shadowBlur = 0;
}

function drawScore() {
    if (!pongCtx || !canvas) return;
    pongCtx.font = "64px 'Press Start 2P'";
    pongCtx.fillStyle = "#d6ecff";
    pongCtx.textAlign = "center";
    pongCtx.shadowColor = "#0fffff"; 
    pongCtx.shadowBlur = 3;        
    pongCtx.fillText(`${leftScore}  ${rightScore}`, canvas.width / 2, canvas.height / 6);
    
    pongCtx.font = "24px 'Press Start 2P'";
    pongCtx.fillText(player1Alias, canvas.width / 4, canvas.height - 40);
    pongCtx.fillText(player2Alias, (canvas.width / 4) * 3, canvas.height - 40);

    pongCtx.shadowBlur = 0; 
}

function drawVerticalCRTLines() {
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

function drawPaddle(paddle: Paddle) {
    if (!pongCtx) return;
    let pulse = Math.sin(Date.now() * 0.2) * 1 + 1.5; 
    pongCtx.shadowBlur = pulse;
    pongCtx.shadowColor = "#0fffff";
    pongCtx.fillStyle = paddle.color;
    roundRect(pongCtx, paddle.x, paddle.y, paddle.width, paddle.height, 5); 
    pongCtx.fill();
    pongCtx.shadowBlur = 0;
}

function drawBall() {
    if (!pongCtx) return;
    pongCtx.fillStyle = ball.color;
    pongCtx.fillRect(ball.x, ball.y, ball.width, ball.height);
}

function draw() {
    if (!pongCtx || !canvas) return;

    const bgGradient = pongCtx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, "#1e293b");
    bgGradient.addColorStop(0.5, "#1b3f72");
    bgGradient.addColorStop(1, "#1e293b");
    pongCtx.fillStyle = bgGradient;
    pongCtx.fillRect(0, 0, canvas.width, canvas.height);

    drawVerticalCRTLines();
    drawMidline();
    drawScore();
    drawBall();
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);

    if (!gameIsRunning) {
        pongCtx.font = "24px 'Press Start 2P'";
        pongCtx.fillStyle = "#fff";
        pongCtx.shadowColor = "yellow";
        pongCtx.shadowBlur = 5;
        pongCtx.textAlign = "center";
        pongCtx.fillText("Press W/S and ↑/↓", canvas.width / 2, canvas.height / 2 - 40);
        pongCtx.fillText("Press Enter to Start Match", canvas.width / 2, canvas.height / 2 + 10);
        pongCtx.shadowBlur = 0;
    }
}

function initGameObjects(): void {
  const paddleWidth = 10;
  const paddleHeight = 80;
  const ballSize = 12;

  leftPaddle = { x: 20, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, color: "#d6ecff" };
  rightPaddle = { x: canvas.width - paddleWidth - 20, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, color: "#d6ecff" };
  ball = { x: canvas.width / 2, y: canvas.height / 2, width: ballSize, height: ballSize, vx: 0, vy: 0, color: "white" };
  
  resetBall(0);
}

function resetBall(direction: number): void {
  ball.x = canvas.width / 2 - ball.width / 2;
  ball.y = canvas.height / 2 - ball.height / 2;
  
  if (direction === 0) {
      ball.vx = 0;
      ball.vy = 0;
  } else {
      const ballStartV = 350;
      ball.vx = ballStartV * direction;
      ball.vy = (Math.random() - 0.5) * 300;
  }
}

function update(dt: number): void {
    if (keyPress["Enter"] && !gameIsRunning) {
        gameIsRunning = true;
        resetBall(Math.random() > 0.5 ? 1 : -1);
    }
    if (!gameIsRunning) return;

    const paddleSpeed = 500 * dt;
    if (keyPress["w"] && leftPaddle.y > 0) leftPaddle.y -= paddleSpeed;
    if (keyPress["s"] && leftPaddle.y + leftPaddle.height < canvas.height) leftPaddle.y += paddleSpeed;
    if (keyPress["ArrowUp"] && rightPaddle.y > 0) rightPaddle.y -= paddleSpeed;
    if (keyPress["ArrowDown"] && rightPaddle.y + rightPaddle.height < canvas.height) rightPaddle.y += paddleSpeed;
    
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y <= 0 || ball.y + ball.height >= canvas.height) ball.vy *= -1;

    if (ball.vx < 0 && ball.x < leftPaddle.x + leftPaddle.width && ball.x > leftPaddle.x && ball.y + ball.height > leftPaddle.y && ball.y < leftPaddle.y + leftPaddle.height) {
        ball.vx *= -1.1;
        const hitPoint = (ball.y + ball.height / 2 - leftPaddle.y) / leftPaddle.height;
        ball.vy = (hitPoint - 0.5) * 500;
    }
    if (ball.vx > 0 && ball.x + ball.width > rightPaddle.x && ball.x < rightPaddle.x + rightPaddle.width && ball.y + ball.height > rightPaddle.y && ball.y < rightPaddle.y + rightPaddle.height) {
        ball.vx *= -1.1;
        const hitPoint = (ball.y + ball.height / 2 - rightPaddle.y) / rightPaddle.height;
        ball.vy = (hitPoint - 0.5) * 500;
    }
    
    if (ball.x < -ball.width) {
        rightScore++;
        resetBall(1);
    } else if (ball.x > canvas.width) {
        leftScore++;
        resetBall(-1);
    }

    if (leftScore >= winningScore) endGame(player1Alias);
    if (rightScore >= winningScore) endGame(player2Alias);
}

function gameLoop(): void {
    if (isGameOver) return; // <<< FIX: Don't loop if game is over
    const dt = 1 / 60;
    update(dt);
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame(winnerAlias: string): void {
  if (isGameOver) return; // <<< FIX: Prevent this function from running more than once
  isGameOver = true; // <<< FIX: Set the flag

  stopPongGame();
  if (onGameOverCallback) {
      onGameOverCallback(winnerAlias);
  }
}

export function startPongGame(p1Alias: string, p2Alias: string, onEndCallback: (winner: string) => void): void {
  if (animationFrameId) stopPongGame();
  
  if (canvas) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  
  player1Alias = p1Alias;
  player2Alias = p2Alias;
  onGameOverCallback = onEndCallback;
  
  leftScore = 0;
  rightScore = 0;
  gameIsRunning = false;
  isGameOver = false; // <<< FIX: Reset the flag for the new game
  
  initGameObjects();
  animationFrameId = requestAnimationFrame(gameLoop);
}

export function stopPongGame(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}