// backend/pong_server.js
// chatMulti


const PADDLE_WIDTH = 8;
const PADDLE_HEIGHT = 70;
const BALL_WIDTH = 10;
const BALL_HEIGHT = 10;
const BALL_START_V = 200;
const MAX_PADDLE_SPEED_PER_SECOND = 500;
const MAX_BALL_SPEED = 500;

const activeGames = new Map();
const playerCurrentGame = new Map(); //->map of players currently in game Map<playerId, gameId>

// NEW: Add the generateGameId function here
export function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function isPlayerInActiveGame(playerId)
{
    const gameId = playerCurrentGame.get(playerId);
    if (gameId) {
        const game = activeGames.get(gameId);
        return !!(game && (game.status === 'in-progress' || game.status === 'waiting_for_ready'));
    }
    return false;
}

export function getPlayerCurrentGameId(playerId) {
    return playerCurrentGame.get(playerId);
}

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
        username: options.player1Username || player1Id,
        isReady: false
      },
      [player2Id]: {
        id: player2Id,
        paddleY: canvasHeight / 2 - PADDLE_HEIGHT / 2,
        score: 0,
        username: options.player2Username || player2Id,
        isReady: false
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
    status: 'waiting_for_ready',
    canvasWidth,
    canvasHeight,
    ballStartX: canvasWidth / 2 - BALL_WIDTH / 2,
    ballStartY: canvasHeight / 2 - BALL_HEIGHT / 2,
    paddleStartY: canvasHeight / 2 - PADDLE_HEIGHT / 2,
    lastUpdateTime: Date.now(),
    winningScore: options.winningScore || 5,
    player1Id: player1Id,
    player2Id: player2Id
  };
  // *** SAFEST LOG: Log initial scores and ball start ***
  console.log(`[pong_server.js - ${initialState.gameId}] CREATED: P1 Score: ${initialState.players[player1Id].score}, P2 Score: ${initialState.players[player2Id].score}, Ball X: ${initialState.ball.x.toFixed(0)}, Ball VX: ${initialState.ball.vx.toFixed(0)}`);
  return initialState;
}

function resetPositionsAfterScore(gameState, scoredOnRight) {
  const { ball, players, ballStartX, ballStartY, paddleStartY, player1Id, player2Id } = gameState;

  players[player1Id].paddleY = paddleStartY;
  players[player2Id].paddleY = paddleStartY;

  ball.x = ballStartX;
  ball.y = ballStartY;
  ball.vx = BALL_START_V * (scoredOnRight ? 1 : -1);
  ball.vy = (Math.random() * 100 + 50) * (Math.random() > 0.5 ? 1 : -1);
}

function isColliding(ballState, paddleY, paddleX, currentPaddleWidth, currentPaddleHeight) {
  return (
    ballState.x < paddleX + currentPaddleWidth &&
    ballState.x + ballState.width > paddleX &&
    ballState.y < paddleY + currentPaddleHeight &&
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
  const ballSpeedMagnitude = Math.sqrt(ballState.vx**2 + ballState.vy**2); // Use previous vx for speed calc before modifying vy too much
  ballState.vy = Math.sin(normalizedHitZone * maxAngleDeflection) * ballSpeedMagnitude * 0.8; // factor to control influence
}

function updateGameState(gameId) {
    const gameState = activeGames.get(gameId);
    if (!gameState) {
        console.log(`[pong_server.js - ${gameId}] updateGameState: Game not found in activeGames.`);
        return null;
    }
    if (gameState.status === 'finished' || gameState.status === 'aborted') {
        console.log(`[pong_server.js - ${gameId}] updateGameState: Game status is ${gameState.status}, no updates.`);
        return gameState;
    }


    let allPlayersReady = true;
    if (gameState.status === 'waiting_for_ready') {
        for (const playerId in gameState.players) {
            if (!gameState.players[playerId].isReady) {
                allPlayersReady = false;
                break;
            }
        }
        if (allPlayersReady) {
            gameState.status = 'in-progress';
            console.log(`[pong_server.js - ${gameId}] All players READY! Game status changing to 'in-progress'.`);
            gameState.lastUpdateTime = Date.now();
        }
    }

    if (gameState.status === 'in-progress') {
        const now = Date.now();
        const dt = (now - gameState.lastUpdateTime) / 1000;
        gameState.lastUpdateTime = now;

        const { players, ball, canvasWidth, canvasHeight, winningScore, player1Id, player2Id } = gameState;
        const paddleSpeedForFrame = MAX_PADDLE_SPEED_PER_SECOND * dt;

        for (const pId in players) {
            const player = players[pId];
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

        if (ball.y <= 0) { ball.y = 0; ball.vy *= -1; }
        else if (ball.y + ball.height >= canvasHeight) { ball.y = canvasHeight - ball.height; ball.vy *= -1; }

        const p1 = players[player1Id];
        const p2 = players[player2Id];
        const PADDLE1_X = 10;
        const PADDLE2_X = canvasWidth - PADDLE_WIDTH - 10;

        if (ball.vx < 0) {
            if (isColliding(ball, p1.paddleY, PADDLE1_X, PADDLE_WIDTH, PADDLE_HEIGHT)) {
                ball.x = PADDLE1_X + PADDLE_WIDTH; handlePaddleCollision(ball, p1.paddleY);
            }
        } else {
            if (isColliding(ball, p2.paddleY, PADDLE2_X, PADDLE_WIDTH, PADDLE_HEIGHT)) {
                ball.x = PADDLE2_X - ball.width; handlePaddleCollision(ball, p2.paddleY);
            }
        }

        let scored = false;
        if (ball.x + ball.width < 0) {
            p2.score++;
            console.log(`[pong_server.js - ${gameId}] POINT P2! Score: ${p1.score}-${p2.score}. BallX: ${ball.x.toFixed(0)}`);
            resetPositionsAfterScore(gameState, false); scored = true;
        } else if (ball.x > canvasWidth) {
            p1.score++;
            console.log(`[pong_server.js - ${gameId}] POINT P1! Score: ${p1.score}-${p2.score}. BallX: ${ball.x.toFixed(0)}`);
            resetPositionsAfterScore(gameState, true); scored = true;
        }

        if (scored) {
          if (p1.score >= winningScore || p2.score >= winningScore) {
            gameState.status = 'finished';
            console.log(`[pong_server.js - ${gameId}] FINISHED! Final Score: ${p1.score}-${p2.score}. Winner: ${p1.score >= winningScore ? p1.id : p2.id}`);
          }
        }
    }

    const p1 = gameState.players[gameState.player1Id];
    const p2 = gameState.players[gameState.player2Id];
    console.log(`[pong_server.js - ${gameId}] UPDATE_GameStateEnd: Ball(${gameState.ball.x.toFixed(0)},${gameState.ball.y.toFixed(0)}) P1(R:${p1.isReady},S:${p1.score}) P2(R:${p2.isReady},S:${p2.score}) Status:${gameState.status}`);

    return gameState;
}

function startGame(gameId, player1Id, player2Id, options = {}, broadcasterFromCaller) {
    console.log(`--- PONG_SERVER.JS - startGame CALLED for gameId: ${gameId} ---`);
    console.log(`--- PONG_SERVER.JS - [${gameId}] Broadcaster type received: ${typeof broadcasterFromCaller} ---`);

    if (typeof broadcasterFromCaller !== 'function') {
        console.error(`--- PONG_SERVER.JS - [${gameId}] FATAL: broadcasterFromCaller is NOT A FUNCTION. Type: ${typeof broadcasterFromCaller} ---`);
    }

    if (activeGames.has(gameId)) {
        console.warn(`[pong_server.js - ${gameId}] Game already exists.`);
        return activeGames.get(gameId);
    }

    if (isPlayerInActiveGame(player1Id) || isPlayerInActiveGame(player2Id)) {
        console.warn(`[pong_server.js - ${gameId}] Attempt to start game when a player is already in another active game. P1 busy: ${isPlayerInActiveGame(player1Id)}, P2 busy: ${isPlayerInActiveGame(player2Id)}`);
    }

    const newGame = createNewGameState(gameId, player1Id, player2Id, options);
    activeGames.set(gameId, newGame);

    playerCurrentGame.set(player1Id, gameId);
    playerCurrentGame.set(player2Id, gameId);

    console.log(`[pong_server.js - ${gameId}] LOOP STARTING. P1: ${player1Id}(${newGame.players[player1Id].score}), P2: ${player2Id}(${newGame.players[player2Id].score})`);

    const gameBroadcaster = broadcasterFromCaller;

    newGame.loopInterval = setInterval(() => {
    const updatedState = updateGameState(gameId);

    if (updatedState && typeof gameBroadcaster === 'function') {

        const p1Score = updatedState.players[player1Id]?.score;
        const p2Score = updatedState.players[player2Id]?.score;


        const stateToSend = {
            type: 'PONG_GAME_STATE_UPDATE',
            gameId: updatedState.gameId,
            ball: {
                x: parseFloat(updatedState.ball.x.toFixed(1)),
                y: parseFloat(updatedState.ball.y.toFixed(1)),
                vx: parseFloat(updatedState.ball.vx.toFixed(1)),
                vy: parseFloat(updatedState.ball.vy.toFixed(1))
            },
            players: updatedState.players,
            status: updatedState.status
        };


        try {
            gameBroadcaster(gameId, stateToSend);
        } catch (e) {
            console.error(`--- PONG_SERVER.JS - [${gameId}] ERROR during game state broadcast: ---`, e);
        }

        if (updatedState.status === 'finished') {
            const finalP1s = updatedState.players[player1Id]?.score;
            const finalP2s = updatedState.players[player2Id]?.score;
            const winnerId = finalP1s >= updatedState.winningScore ? player1Id : (finalP2s >= updatedState.winningScore ? player2Id : null);

            const gameOverPayload = {
                type: 'PONG_GAME_OVER',
                gameId: updatedState.gameId,
                winnerId: winnerId,
                scores: { [player1Id]: finalP1s, [player2Id]: finalP2s }
            };
            try {
                gameBroadcaster(gameId, gameOverPayload);
            } catch (e) {
                console.error(`--- PONG_SERVER.JS - [${gameId}] ERROR during GAME_OVER broadcast: ---`, e);
            }
            stopGame(gameId);
        }
    } else if (!updatedState) {
        stopGame(gameId);
    } else if (typeof gameBroadcaster !== 'function') {
        console.warn(`--- PONG_SERVER.JS - [${gameId}] Loop: gameBroadcaster is UNDEFINED or NOT A FUNCTION in tick. Type: ${typeof gameBroadcaster} ---`);
    }
    }, 1000/60); // => 60 fps / TickRate

    return newGame;
}

function stopGame(gameId) {
    const game = activeGames.get(gameId);
    if (game) {
        if (game.loopInterval) {
            clearInterval(game.loopInterval);
            game.loopInterval = null;
        }

        if(game.status !== 'finished') game.status = 'aborted';
        console.log(`[pong_server.js - ${gameId}] Game loop stopped. Status: ${game.status}`);

        if (game.player1Id) playerCurrentGame.delete(game.player1Id);
        if (game.player2Id) playerCurrentGame.delete(game.player2Id);
        activeGames.delete(gameId);
    }
}

function handlePlayerInput(gameId, playerId, input) {
    const game = activeGames.get(gameId);
    if (game && game.players[playerId] && game.status === 'in-progress') {
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