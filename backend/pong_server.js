// backend/pong_game.js

const PADDLE_WIDTH = 8;
const PADDLE_HEIGHT = 70;
const BALL_WIDTH = 10;
const BALL_HEIGHT = 10;
const BALL_START_V = 200;
const MAX_PADDLE_SPEED_PER_SECOND = 500;
const MAX_BALL_SPEED = 500;

const activeGames = new Map();

function createNewGameState(gameId, player1Id, player2Id, options = {}) {
  const canvasWidth = options.canvasWidth || 800;
  const canvasHeight = options.canvasHeight || 600;

  const initialState = {
    gameId,
    players: {
      [player1Id]: {
        id: player1Id,
        paddleY: canvasHeight / 2 - PADDLE_HEIGHT / 2,
        score: 0,
      },
      [player2Id]: {
        id: player2Id,
        paddleY: canvasHeight / 2 - PADDLE_HEIGHT / 2,
        score: 0,
      },
    },
    ball: {
      x: canvasWidth / 2 - BALL_WIDTH / 2,
      y: canvasHeight / 2 - BALL_HEIGHT / 2,
      width: BALL_WIDTH,
      height: BALL_HEIGHT,
      vx: BALL_START_V * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 100 + 50) * (Math.random() > 0.5 ? 1 : -1),
    },
    status: 'in-progress',
    canvasWidth,
    canvasHeight,
    ballStartX: canvasWidth / 2 - BALL_WIDTH / 2,
    ballStartY: canvasHeight / 2 - BALL_HEIGHT / 2,
    paddleStartY: canvasHeight / 2 - PADDLE_HEIGHT / 2,
    lastUpdateTime: Date.now(),
    winningScore: options.winningScore || 5,
  };
  return initialState;
}

function resetPositionsAfterScore(gameState, scoredOnRight) {
  const { ball, players, ballStartX, ballStartY, paddleStartY } = gameState;

  Object.values(players).forEach(player => {
    player.paddleY = paddleStartY;
  });

  ball.x = ballStartX;
  ball.y = ballStartY;
  ball.vx = BALL_START_V * (scoredOnRight ? 1 : -1);
  ball.vy = (Math.random() * 100 + 50) * (Math.random() > 0.5 ? 1 : -1);
}

function isColliding(ballState, paddleY, paddleX, paddleWidth, paddleHeight) {
  return (
    ballState.x < paddleX + paddleWidth &&
    ballState.x + ballState.width > paddleX &&
    ballState.y < paddleY + paddleHeight &&
    ballState.y + ballState.height > paddleY
  );
}

function handlePaddleCollision(ballState, paddleY) {
  ballState.vx *= -1.1;
  ballState.vx = Math.max(Math.min(ballState.vx, MAX_BALL_SPEED), -MAX_BALL_SPEED);

  const hitZone = (ballState.y + ballState.height / 2 - paddleY) / PADDLE_HEIGHT;
  const maxAngleDeflection = Math.PI / 4;
  
  let normalizedHitZone = (hitZone - 0.5) * 2; 
  normalizedHitZone = Math.max(-0.85, Math.min(0.85, normalizedHitZone)); 

  ballState.vy = Math.sin(normalizedHitZone * maxAngleDeflection) * Math.sqrt(ballState.vx**2 + ballState.vy**2) * 0.6;
}

function updateGameState(gameId) {
    const gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'in-progress') {
        return null;
    }

    const now = Date.now();
    const dt = (now - gameState.lastUpdateTime) / 1000;
    gameState.lastUpdateTime = now;

    const { players, ball, canvasWidth, canvasHeight } = gameState;
    const paddleSpeedForFrame = MAX_PADDLE_SPEED_PER_SECOND * dt;

    for (const playerId in players) {
        const player = players[playerId];
        const input = player.currentInput;

        if (input === 'up' && player.paddleY > 0) {
            player.paddleY -= paddleSpeedForFrame;
        } else if (input === 'down' && player.paddleY + PADDLE_HEIGHT < canvasHeight) {
            player.paddleY += paddleSpeedForFrame;
        }
        player.paddleY = Math.max(0, Math.min(player.paddleY, canvasHeight - PADDLE_HEIGHT));
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y <= 0) {
        ball.y = 0;
        ball.vy *= -1;
    } else if (ball.y + ball.height >= canvasHeight) {
        ball.y = canvasHeight - ball.height;
        ball.vy *= -1;
    }
    
    const playerIds = Object.keys(players);
    const player1 = players[playerIds[0]];
    const player2 = players[playerIds[1]];

    const PADDLE1_X = 10;
    const PADDLE2_X = canvasWidth - PADDLE_WIDTH - 10;

    if (ball.vx < 0) {
        if (isColliding(ball, player1.paddleY, PADDLE1_X, PADDLE_WIDTH, PADDLE_HEIGHT)) {
            ball.x = PADDLE1_X + PADDLE_WIDTH;
            handlePaddleCollision(ball, player1.paddleY);
        }
    } else {
        if (isColliding(ball, player2.paddleY, PADDLE2_X, PADDLE_WIDTH, PADDLE_HEIGHT)) {
            ball.x = PADDLE2_X - ball.width;
            handlePaddleCollision(ball, player2.paddleY);
        }
    }

    let scored = false;
    if (ball.x + ball.width < 0) {
        player2.score++;
        resetPositionsAfterScore(gameState, false);
        scored = true;
    } else if (ball.x > canvasWidth) {
        player1.score++;
        resetPositionsAfterScore(gameState, true);
        scored = true;
    }

    if (scored) {
      if (player1.score >= gameState.winningScore || player2.score >= gameState.winningScore) {
        gameState.status = 'finished';
        console.log(`Game ${gameId} finished. Winner: ${player1.score >= gameState.winningScore ? player1.id : player2.id}`);
      }
    }
    return gameState;
}

function startGame(gameId, player1Id, player2Id, options = {}, broadcaster) {
    if (activeGames.has(gameId)) {
        console.warn(`Game ${gameId} already exists.`);
        return activeGames.get(gameId);
    }
    const newGame = createNewGameState(gameId, player1Id, player2Id, options);
    // Store usernames if available, assuming player1Id/player2Id are like "user_ID"
    // need proper user data fetching if not passed in options
    newGame.players[player1Id].username = options.player1Username || player1Id;
    newGame.players[player2Id].username = options.player2Username || player2Id;

    activeGames.set(gameId, newGame);
    
    newGame.loopInterval = setInterval(() => {
        const updatedState = updateGameState(gameId);
        if (updatedState && broadcaster) {
            const stateToSend = {
                type: 'PONG_GAME_STATE_UPDATE',
                gameId: updatedState.gameId,
                ball: updatedState.ball,
                players: updatedState.players,
                status: updatedState.status
            };
            broadcaster(gameId, stateToSend);

            if (updatedState.status === 'finished') {
                const winnerEntry = Object.entries(updatedState.players).find(([id, data]) => data.score >= updatedState.winningScore);
                const winnerId = winnerEntry ? winnerEntry[0] : null;
                broadcaster(gameId, {
                    type: 'PONG_GAME_OVER',
                    gameId: updatedState.gameId,
                    winnerId: winnerId,
                    scores: {
                        [player1Id]: updatedState.players[player1Id].score,
                        [player2Id]: updatedState.players[player2Id].score,
                    }
                });
                stopGame(gameId);
            }
        }
    }, 1000 / 30); // 30 FPS right, may increase later idk

    console.log(`Game ${gameId} started with players ${player1Id} and ${player2Id}.`);
    return newGame;
}

function stopGame(gameId) {
    const game = activeGames.get(gameId);
    if (game) {
        if (game.loopInterval) {
            clearInterval(game.loopInterval);
        }
        console.log(`Game ${gameId} stopped.`);
    }
}

function handlePlayerInput(gameId, playerId, input) {
    const game = activeGames.get(gameId);
    if (game && game.players[playerId]) {
        if (input === 'up' || input === 'down') {
            game.players[playerId].currentInput = input;
        } else if (input === 'stop_up' && game.players[playerId].currentInput === 'up') {
            game.players[playerId].currentInput = null;
        } else if (input === 'stop_down' && game.players[playerId].currentInput === 'down') {
            game.players[playerId].currentInput = null;
        }
    }
}

export {
    startGame,
    stopGame,
    handlePlayerInput,
    activeGames
};