import jwt from 'jsonwebtoken';
// *** 1. IMPORT the central game completion handler ***
import { processGameCompletion } from "./tournament_logic.js";

// Game constants
const PADDLE_HEIGHT = 70;
const PADDLE_WIDTH = 8;
const BALL_SIZE = 10;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BALL_START_VX = 4;
const BALL_START_VY = 2;
const MAX_BALL_SPEED_X = 10;
const MAX_BALL_SPEED_Y = 8;
const PADDLE_HIT_ANGLE_FACTOR = 4;
const BALL_SPEED_INCREASE_FACTOR = -1.05;
const WINNING_SCORE = 5;
const PADDLE_SPEED_PER_SECOND = 400;

const pongRoom = {
    players: [],
    // *** 2. ADD a gameId to track the current match ***
    gameId: null,
    ball: {
        x: CANVAS_WIDTH / 2 - BALL_SIZE / 2,
        y: CANVAS_HEIGHT / 2 - BALL_SIZE / 2,
        width: BALL_SIZE,
        height: BALL_SIZE,
        vx: BALL_START_VX * (Math.random() > 0.5 ? 1 : -1),
        vy: BALL_START_VY * (Math.random() > 0.5 ? 1 : -1)
    },
    paddles: {
        left: { x: 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, playerId: null, currentInput: null, lastUpdateTime: null },
        right: { x: CANVAS_WIDTH - PADDLE_WIDTH - 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, playerId: null, currentInput: null, lastUpdateTime: null }
    },
    gameIsRunning: false,
    gameInterval: null,
    playerCount: 0
};

// --- Helper Functions ---
function broadcastPongMessage(message, serverInstance) {
    const stringifiedMessage = JSON.stringify(message);
    pongRoom.players.forEach(player => {
        if (player.ws && typeof player.ws.send === 'function' && player.ws.readyState === 1) {
            try {
                player.ws.send(stringifiedMessage);
            } catch (e) {
                const logger = serverInstance?.log || console;
                logger.error({ err: e, userId: player.id }, "Pong: Error sending message during broadcast.");
            }
        }
    });
}

function resetBall(serverInitiated = false) {
    pongRoom.ball.x = CANVAS_WIDTH / 2 - BALL_SIZE / 2;
    pongRoom.ball.y = CANVAS_HEIGHT / 2 - BALL_SIZE / 2;
    const lastVxSign = Math.sign(pongRoom.ball.vx);
    pongRoom.ball.vx = BALL_START_VX * (serverInitiated ? (Math.random() > 0.5 ? 1 : -1) : -lastVxSign || (Math.random() > 0.5 ? 1 : -1));
    let newVy = BALL_START_VY * (Math.random() > 0.5 ? 1 : -1);
    if (Math.abs(newVy) < 1 && newVy !== 0) newVy = Math.sign(newVy) * 1;
    else if (newVy === 0) newVy = (Math.random() > 0.5 ? 1 : -1) * 1;
    pongRoom.ball.vy = newVy;
}

function resetPaddles() {
    pongRoom.paddles.left.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    pongRoom.paddles.right.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    pongRoom.paddles.left.currentInput = null;
    pongRoom.paddles.right.currentInput = null;
}

function resetScores() {
    pongRoom.paddles.left.score = 0;
    pongRoom.paddles.right.score = 0;
}

function updateGame(serverInstance) {
    if (!pongRoom.gameIsRunning) return;
    const now = Date.now();

    ['left', 'right'].forEach(side => {
        const paddle = pongRoom.paddles[side];
        if (paddle.currentInput && paddle.lastUpdateTime) {
            const dt = (now - paddle.lastUpdateTime) / 1000;
            const paddleSpeedForFrame = PADDLE_SPEED_PER_SECOND * dt;
            if (paddle.currentInput === 'up') {
                paddle.y = Math.max(0, paddle.y - paddleSpeedForFrame);
            } else if (paddle.currentInput === 'down') {
                paddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddle.y + paddleSpeedForFrame);
            }
        }
        paddle.lastUpdateTime = now;
    });

    pongRoom.ball.x += pongRoom.ball.vx;
    pongRoom.ball.y += pongRoom.ball.vy;

    if (pongRoom.ball.y <= 0) { pongRoom.ball.y = 0; pongRoom.ball.vy *= -1; }
    else if (pongRoom.ball.y + pongRoom.ball.height >= CANVAS_HEIGHT) { pongRoom.ball.y = CANVAS_HEIGHT - pongRoom.ball.height; pongRoom.ball.vy *= -1; }

    let paddleHit = null;
    if (pongRoom.ball.vx < 0 && isColliding(pongRoom.ball, pongRoom.paddles.left)) {
        paddleHit = pongRoom.paddles.left;
        handlePaddleCollision(pongRoom.ball, paddleHit);
    } else if (pongRoom.ball.vx > 0 && isColliding(pongRoom.ball, pongRoom.paddles.right)) {
        paddleHit = pongRoom.paddles.right;
        handlePaddleCollision(pongRoom.ball, paddleHit);
    }

    let scored = false;
    if (pongRoom.ball.x + pongRoom.ball.width < 0) {
        pongRoom.paddles.right.score++;
        scored = true;
    } else if (pongRoom.ball.x > CANVAS_WIDTH) {
        pongRoom.paddles.left.score++;
        scored = true;
    }

    if (scored) {
        if (pongRoom.paddles.left.score >= WINNING_SCORE) {
            stopGame(pongRoom.paddles.left.playerId, "win", serverInstance);
        } else if (pongRoom.paddles.right.score >= WINNING_SCORE) {
            stopGame(pongRoom.paddles.right.playerId, "win", serverInstance);
        } else {
            resetBall();
        }
    }

    if (pongRoom.gameIsRunning) {
        broadcastPongMessage({
            type: 'game_update',
            ball: { x: pongRoom.ball.x, y: pongRoom.ball.y },
            paddles: {
                left: { y: pongRoom.paddles.left.y, score: pongRoom.paddles.left.score },
                right: { y: pongRoom.paddles.right.y, score: pongRoom.paddles.right.score }
            }
        }, serverInstance);
    }
}

function isColliding(ball, paddle) {
    return (
        ball.x < paddle.x + paddle.width &&
        ball.x + ball.width > paddle.x &&
        ball.y < paddle.y + paddle.height &&
        ball.y + ball.height > paddle.y
    );
}

function handlePaddleCollision(ball, paddle) {
    ball.x = (paddle.x < CANVAS_WIDTH / 2) ? (paddle.x + paddle.width) : (paddle.x - ball.width);
    ball.vx *= BALL_SPEED_INCREASE_FACTOR;
    const hitPositionRatio = (ball.y + ball.height / 2 - paddle.y) / paddle.height;
    ball.vy += (hitPositionRatio - 0.5) * PADDLE_HIT_ANGLE_FACTOR;
    ball.vx = Math.max(-MAX_BALL_SPEED_X, Math.min(MAX_BALL_SPEED_X, ball.vx));
    ball.vy = Math.max(-MAX_BALL_SPEED_Y, Math.min(MAX_BALL_SPEED_Y, ball.vy));
}

function startGame(serverInstance) {
    const logger = serverInstance?.log || console;
    if (pongRoom.playerCount !== 2 || pongRoom.gameIsRunning) {
        logger.warn({ playerCount: pongRoom.playerCount, gameIsRunning: pongRoom.gameIsRunning }, "Pong: Start game prerequisites not met.");
        return;
    }
    if (!pongRoom.paddles.left.playerId || !pongRoom.paddles.right.playerId) {
        logger.error("Pong: Attempting to start game but paddle player IDs are not fully assigned.");
        return;
    }
    
    // *** 3. ASSIGN a unique ID to the game when it starts ***
    pongRoom.gameId = `quickplay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info({ gameId: pongRoom.gameId, player1: pongRoom.paddles.left.playerId, player2: pongRoom.paddles.right.playerId }, "Pong: Starting game.");
    pongRoom.gameIsRunning = true;
    resetScores();
    resetBall(true);
    resetPaddles();

    const now = Date.now();
    pongRoom.paddles.left.lastUpdateTime = now;
    pongRoom.paddles.right.lastUpdateTime = now;

    if (pongRoom.gameInterval) clearInterval(pongRoom.gameInterval);
    pongRoom.gameInterval = setInterval(() => updateGame(serverInstance), 1000 / 60);

    const playerSides = {};
    pongRoom.players.forEach(p => { if(p.side) playerSides[p.id] = p.side });

    broadcastPongMessage({
        type: 'game_start',
        playerSides
    }, serverInstance);
}

function stopGame(winnerId, reason = "win", serverInstance) {
    const logger = serverInstance?.log || console;
    if (!pongRoom.gameIsRunning) return;

    logger.info({ gameId: pongRoom.gameId, winnerId, reason }, `Pong: Stopping game.`);
    pongRoom.gameIsRunning = false;
    if (pongRoom.gameInterval) {
        clearInterval(pongRoom.gameInterval);
        pongRoom.gameInterval = null;
    }

    const p1_id = pongRoom.paddles.left.playerId;
    const p2_id = pongRoom.paddles.right.playerId;
    
    // Make sure we have a valid winner before saving stats
    if (winnerId && p1_id && p2_id) {
        const winnerPrefixedId = `user_${winnerId}`;
        const p1_prefixedId = `user_${p1_id}`;
        const p2_prefixedId = `user_${p2_id}`;

        const finalScores = {
            [p1_prefixedId]: pongRoom.paddles.left.score,
            [p2_prefixedId]: pongRoom.paddles.right.score
        };

        // *** THE FIX IS HERE: We now explicitly pass 'Quick Play' as the game mode ***
        processGameCompletion(pongRoom.gameId, winnerPrefixedId, finalScores, 'Quick Play').catch(err => {
            logger.error({ err, gameId: pongRoom.gameId }, "Error processing Quick Play game completion.");
        });
    }

    const winnerSide = pongRoom.paddles.left.playerId === winnerId ? 'left' : (pongRoom.paddles.right.playerId === winnerId ? 'right' : null);
    broadcastPongMessage({
        type: 'game_over',
        winnerSide: winnerSide,
        scores: { left: pongRoom.paddles.left.score, right: pongRoom.paddles.right.score },
        reason: reason
    }, serverInstance);
    
    // Reset gameId after processing
    pongRoom.gameId = null;
    resetPaddles();
}

// --- WebSocket Handler ---

export default async function pongWsRoutes(server, options) {
  server.route({
    method: 'GET',
    url: '/ws/remotepong',
    handler: (req, reply) => {
        reply.code(400).send({ error: 'This is a WebSocket endpoint for Pong. Please connect using a WebSocket client.' });
    },
    wsHandler: (connection, req) => {
        if (!connection) {
            server.log.error({ connectionId: req.id, ip: req.ip }, "Pong: CRITICAL - 'connection' object is undefined in wsHandler. Cannot proceed.");
            return;
        }
        const ws = connection;
        server.log.info({ connectionId: req.id, ip: req.ip }, 'Pong: New WebSocket connection attempt to /ws/remotepong.');

        let authenticatedUserId = null;
        let userJWTPayload = null;

        const token = req.cookies.auth_token;
        if (!token) {
            ws.close(1008, "Missing authentication token for Pong");
            return;
        }

        try {
            userJWTPayload = jwt.verify(token, server.jwt_secret);
            if (!userJWTPayload.userId || !userJWTPayload.username) {
                ws.close(1008, "Invalid token data for Pong");
                return;
            }
            authenticatedUserId = userJWTPayload.userId;
        } catch (err) {
            ws.close(1008, "Authentication failed for Pong");
            return;
        }

        server.log.info({ userId: authenticatedUserId }, "Pong: Token verified.");

        if (pongRoom.players.some(p => p.id === authenticatedUserId)) {
             ws.close(4001, "Newer Pong connection by same user.");
             return;
        }

        if (pongRoom.playerCount >= 2) {
            ws.close(1000, "Pong room full");
            return;
        }
        
        const newPlayer = { ws, id: authenticatedUserId, username: userJWTPayload.username, side: null };
        pongRoom.players.push(newPlayer);
        pongRoom.playerCount = pongRoom.players.length;

        let assignedSide = null;
        if (!pongRoom.paddles.left.playerId) {
            newPlayer.side = 'left'; 
            pongRoom.paddles.left.playerId = newPlayer.id;
            assignedSide = 'left';
        } else if (!pongRoom.paddles.right.playerId) {
            newPlayer.side = 'right'; 
            pongRoom.paddles.right.playerId = newPlayer.id;
            assignedSide = 'right';
        }
        
        ws.send(JSON.stringify({ type: 'assign_side', side: assignedSide }));

        if (pongRoom.playerCount === 2) {
            startGame(server);
        } else {
            broadcastPongMessage({ type: 'status_update', message: `Waiting for 1 more player...` }, server);
        }

        ws.on('message', (messageBuffer) => {
            const messageString = messageBuffer.toString();
            let data;
            try {
                data = JSON.parse(messageString);
            } catch (e) { return; }

            const currentPlayer = pongRoom.players.find(p => p.ws === ws);
            if (!currentPlayer || !currentPlayer.side) return;

            const paddle = pongRoom.paddles[currentPlayer.side];

            if (data.type === 'PADDLE_INPUT') {
                if (['up', 'down'].includes(data.input)) {
                    paddle.currentInput = data.input;
                    paddle.lastUpdateTime = Date.now();
                } else if (data.input === 'stop_up' && paddle.currentInput === 'up') {
                    paddle.currentInput = null;
                } else if (data.input === 'stop_down' && paddle.currentInput === 'down') {
                    paddle.currentInput = null;
                }
            } else if (data.type === 'request_restart' && !pongRoom.gameIsRunning) {
                if (pongRoom.playerCount === 2) {
                    startGame(server);
                }
            }
        });

        ws.on('close', (code, reason) => {
            const playerIndex = pongRoom.players.findIndex(p => p.ws === ws);
            if (playerIndex !== -1) {
                const disconnectedPlayer = pongRoom.players.splice(playerIndex, 1)[0];
                pongRoom.playerCount = pongRoom.players.length;

                if (disconnectedPlayer.side) {
                    const paddle = pongRoom.paddles[disconnectedPlayer.side];
                    paddle.playerId = null;
                    paddle.currentInput = null;
                }
                server.log.info({ userId: disconnectedPlayer.id }, "Pong: Player removed.");
            }

            if (pongRoom.gameIsRunning) {
                const remainingPlayer = pongRoom.players.length > 0 ? pongRoom.players[0] : null;
                stopGame(remainingPlayer ? remainingPlayer.id : null, "opponent_disconnected", server);
            }
        });

        ws.on('error', (err) => {
            server.log.error({ err }, 'Pong: WebSocket error.');
        });
    }
  });
}