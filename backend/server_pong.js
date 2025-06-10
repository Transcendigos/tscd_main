// pongWsRoutes.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

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

const pongRoom = {
    players: [],
    ball: {
        x: CANVAS_WIDTH / 2 - BALL_SIZE / 2,
        y: CANVAS_HEIGHT / 2 - BALL_SIZE / 2,
        width: BALL_SIZE,
        height: BALL_SIZE,
        vx: BALL_START_VX * (Math.random() > 0.5 ? 1 : -1),
        vy: BALL_START_VY * (Math.random() > 0.5 ? 1 : -1)
    },
    paddles: {
        left: { x: 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, playerId: null },
        right: { x: CANVAS_WIDTH - PADDLE_WIDTH - 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, playerId: null }
    },
    gameIsRunning: false,
    gameInterval: null,
    playerCount: 0 
};

// --- Helper Functions ---
function broadcastPongMessage(message, serverInstance) {
    const stringifiedMessage = JSON.stringify(message);
    pongRoom.players.forEach(player => {
        if (player.ws && typeof player.ws.send === 'function' && player.ws.readyState === 1 /* WebSocket.OPEN */) {
            try {
                player.ws.send(stringifiedMessage);
            } catch (e) {
                const logger = serverInstance?.log || console;
                logger.error({ err: e, userId: player.id }, "Pong: Error sending message during broadcast.");
            }
        } else {
            const logger = serverInstance?.log || console;
            logger.warn({ userId: player.id, wsExists: !!player.ws, wsState: player.ws ? player.ws.readyState : 'N/A' }, "Pong: Skipping broadcast to player; WebSocket not valid or not open.");
        }
    });
}

function resetBall(serverInitiated = false) {
    pongRoom.ball.x = CANVAS_WIDTH / 2 - BALL_SIZE / 2;
    pongRoom.ball.y = CANVAS_HEIGHT / 2 - BALL_SIZE / 2;
    const lastVxSign = Math.sign(pongRoom.ball.vx);
    pongRoom.ball.vx = BALL_START_VX * (serverInitiated ? (Math.random() > 0.5 ? 1 : -1) : -lastVxSign || (Math.random() > 0.5 ? 1 : -1));
    let newVy = BALL_START_VY * (Math.random() > 0.5 ? 1 : -1);
    // Ensure minimum vertical speed if BALL_START_VY is low
    if (Math.abs(newVy) < 1 && newVy !== 0) newVy = Math.sign(newVy) * 1;
    else if (newVy === 0) newVy = (Math.random() > 0.5 ? 1 : -1) * 1; // Avoid zero vy
    pongRoom.ball.vy = newVy;
}

function resetPaddles() {
    pongRoom.paddles.left.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    pongRoom.paddles.right.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
}

function resetScores() {
    pongRoom.paddles.left.score = 0;
    pongRoom.paddles.right.score = 0;
}

function updateGame(serverInstance) {
    if (!pongRoom.gameIsRunning) return;

    pongRoom.ball.x += pongRoom.ball.vx;
    pongRoom.ball.y += pongRoom.ball.vy;

    if (pongRoom.ball.y <= 0) {
        pongRoom.ball.y = 0;
        pongRoom.ball.vy *= -1;
    } else if (pongRoom.ball.y + pongRoom.ball.height >= CANVAS_HEIGHT) {
        pongRoom.ball.y = CANVAS_HEIGHT - pongRoom.ball.height;
        pongRoom.ball.vy *= -1;
    }

    // Paddle collisions
    let paddleHit = null;

    // Left Paddle
    if (pongRoom.ball.vx < 0 &&
        pongRoom.ball.x <= pongRoom.paddles.left.x + pongRoom.paddles.left.width &&
        pongRoom.ball.x + pongRoom.ball.width >= pongRoom.paddles.left.x &&
        pongRoom.ball.y + pongRoom.ball.height >= pongRoom.paddles.left.y &&
        pongRoom.ball.y <= pongRoom.paddles.left.y + pongRoom.paddles.left.height) {
        paddleHit = pongRoom.paddles.left;
        pongRoom.ball.x = pongRoom.paddles.left.x + pongRoom.paddles.left.width;
        pongRoom.ball.vx *= BALL_SPEED_INCREASE_FACTOR;
        const hitPositionRatio = (pongRoom.ball.y + pongRoom.ball.height / 2 - paddleHit.y) / paddleHit.height;
        pongRoom.ball.vy += (hitPositionRatio - 0.5) * PADDLE_HIT_ANGLE_FACTOR;
    }
    // Right Paddle
    else if (pongRoom.ball.vx > 0 &&
        pongRoom.ball.x + pongRoom.ball.width >= pongRoom.paddles.right.x &&
        pongRoom.ball.x <= pongRoom.paddles.right.x + pongRoom.paddles.right.width &&
        pongRoom.ball.y + pongRoom.ball.height >= pongRoom.paddles.right.y &&
        pongRoom.ball.y <= pongRoom.paddles.right.y + pongRoom.paddles.right.height) {
        paddleHit = pongRoom.paddles.right;
        pongRoom.ball.x = pongRoom.paddles.right.x - pongRoom.ball.width;
        pongRoom.ball.vx *= BALL_SPEED_INCREASE_FACTOR;
        const hitPositionRatio = (pongRoom.ball.y + pongRoom.ball.height / 2 - paddleHit.y) / paddleHit.height;
        pongRoom.ball.vy += (hitPositionRatio - 0.5) * PADDLE_HIT_ANGLE_FACTOR;
    }

    pongRoom.ball.vx = Math.max(-MAX_BALL_SPEED_X, Math.min(MAX_BALL_SPEED_X, pongRoom.ball.vx));
    pongRoom.ball.vy = Math.max(-MAX_BALL_SPEED_Y, Math.min(MAX_BALL_SPEED_Y, pongRoom.ball.vy));

    let scored = false;
    if (pongRoom.ball.x + pongRoom.ball.width < 0) {
        pongRoom.paddles.right.score++;
        scored = true;
        if (pongRoom.paddles.right.score >= WINNING_SCORE) {
            stopGame(pongRoom.paddles.right.playerId, "win", serverInstance);
        }
    } else if (pongRoom.ball.x > CANVAS_WIDTH) {
        pongRoom.paddles.left.score++;
        scored = true;
        if (pongRoom.paddles.left.score >= WINNING_SCORE) {
            stopGame(pongRoom.paddles.left.playerId, "win", serverInstance);
        }
    }

    if (scored && pongRoom.gameIsRunning) {
        resetBall();
    }

    broadcastPongMessage({
        type: 'game_update',
        ball: pongRoom.ball,
        paddles: {
            left: { y: pongRoom.paddles.left.y, score: pongRoom.paddles.left.score },
            right: { y: pongRoom.paddles.right.y, score: pongRoom.paddles.right.score }
        }
    }, serverInstance);
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

    logger.info({player1: pongRoom.paddles.left.playerId, player2: pongRoom.paddles.right.playerId}, "Pong: Starting game.");
    pongRoom.gameIsRunning = true;
    resetScores();
    resetBall(true); // Server initiated ball launch
    resetPaddles();

    if (pongRoom.gameInterval) clearInterval(pongRoom.gameInterval);
    pongRoom.gameInterval = setInterval(() => updateGame(serverInstance), 1000 / 60);

    const gameStartPlayerSides = {};
    if (pongRoom.paddles.left.playerId) {
        gameStartPlayerSides[pongRoom.paddles.left.playerId] = 'left';
    }
    if (pongRoom.paddles.right.playerId) {
        gameStartPlayerSides[pongRoom.paddles.right.playerId] = 'right';
    }

    broadcastPongMessage({
        type: 'game_start',
        ball: pongRoom.ball,
        paddles: pongRoom.paddles, // Full paddle info at game start
        playerSides: gameStartPlayerSides
    }, serverInstance);
}

function stopGame(winnerId, reason = "win", serverInstance) {
    const logger = serverInstance?.log || console;
    if (!pongRoom.gameIsRunning) return;

    logger.info({ winnerId, reason }, `Pong: Stopping game.`);
    pongRoom.gameIsRunning = false;
    if (pongRoom.gameInterval) {
        clearInterval(pongRoom.gameInterval);
        pongRoom.gameInterval = null;
    }

    const winnerSide = pongRoom.paddles.left.playerId === winnerId ? 'left' : (pongRoom.paddles.right.playerId === winnerId ? 'right' : null);

    broadcastPongMessage({
        type: 'game_over',
        winnerSide: winnerSide,
        scores: { left: pongRoom.paddles.left.score, right: pongRoom.paddles.right.score },
        reason: reason
    }, serverInstance);
}
// --- End Helper Functions ---

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
            server.log.warn({ connectionId: req.id, ip: req.ip }, "Pong: Connection without auth_token. Closing.");
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', context: 'pong_auth', message: 'Authentication required.' }));
            ws.close(1008, "Missing authentication token for Pong");
            return;
        }

        try {
            userJWTPayload = jwt.verify(token, JWT_SECRET);
            if (!userJWTPayload.userId || !userJWTPayload.username) {
                server.log.warn({ connectionId: req.id, ip: req.ip, payloadUserId: userJWTPayload.userId }, "Pong: Invalid token payload (missing userId or username). Closing.");
                if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', context: 'pong_auth', message: 'Invalid token data.' }));
                ws.close(1008, "Invalid token data for Pong");
                return;
            }
            authenticatedUserId = userJWTPayload.userId;
        } catch (err) {
            server.log.warn({ connectionId: req.id, ip: req.ip, error: err.message }, "Pong: Token verification failed. Closing.");
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', context: 'pong_auth', message: 'Authentication error: ' + err.message }));
            ws.close(1008, "Authentication failed for Pong");
            return;
        }

        server.log.info({ connectionId: req.id, userId: authenticatedUserId, username: userJWTPayload.username }, "Pong: Token verified.");

        const existingPlayerIndex = pongRoom.players.findIndex(p => p.id === authenticatedUserId);
        
        if (existingPlayerIndex !== -1) {
            const oldPlayer = pongRoom.players[existingPlayerIndex];
            server.log.warn({ connectionId: req.id, userId: authenticatedUserId, oldPlayerId: oldPlayer.id }, "Pong: Player already in room (re-connecting process initiated).");
            
            if (oldPlayer.ws && oldPlayer.ws !== ws && typeof oldPlayer.ws.send === 'function' && oldPlayer.ws.readyState === 1 /* OPEN */) {
                server.log.info({ userId: authenticatedUserId }, "Pong: Attempting to send 'replaced' message to old WebSocket and then close it.");
                try {
                    oldPlayer.ws.send(JSON.stringify({ type: 'status_update', context: 'pong_connection', message: 'Replaced by new connection.' }));
                    oldPlayer.ws.close(4001, "Newer Pong connection by same user.");
                } catch (e) {
                    server.log.error({userId: authenticatedUserId, err: e}, "Pong: Error during send/close of oldPlayer.ws");
                }
            } else {
                 server.log.info({userId: authenticatedUserId, oldWsExists: !!oldPlayer.ws, oldWsNotSame: oldPlayer.ws !== ws, oldWsIsFunction: typeof oldPlayer.ws?.send, oldWsState: oldPlayer.ws ? oldPlayer.ws.readyState : 'N/A'}, "Pong: Old player WS not in expected state for sending 'replaced' message or closing.");
            }
            
            pongRoom.players.splice(existingPlayerIndex, 1);
            server.log.info({ userId: authenticatedUserId }, "Pong: Spliced old player entry from pongRoom.players.");

            // Important: Free up their paddle slot if they were assigned
            if (pongRoom.paddles.left.playerId === authenticatedUserId) {
                 pongRoom.paddles.left.playerId = null;
                 // Optional: Reset score if a full disconnect/reconnect should mean a fresh start for that paddle
                 // pongRoom.paddles.left.score = 0;
            }
            if (pongRoom.paddles.right.playerId === authenticatedUserId) {
                pongRoom.paddles.right.playerId = null;
                // pongRoom.paddles.right.score = 0;
            }
        }
        
        pongRoom.playerCount = pongRoom.players.length;

        if (pongRoom.playerCount >= 2 && existingPlayerIndex === -1) {
            server.log.warn({ connectionId: req.id, userId: authenticatedUserId, currentPlayers: pongRoom.playerCount }, "Pong: Room is full. Rejecting.");
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'status_update', context: 'pong_join', message: 'Pong game is full.' }));
            ws.close(1000, "Pong room full");
            return;
        }

        const newPlayer = { ws, id: authenticatedUserId, username: userJWTPayload.username, side: null, userJWTPayload };
        pongRoom.players.push(newPlayer);
        pongRoom.playerCount = pongRoom.players.length;

        server.log.info({ connectionId: req.id, userId: newPlayer.id, username: newPlayer.username }, `Pong: Player added. Total players: ${pongRoom.playerCount}`);
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'pong_auth_success', playerId: newPlayer.id, username: newPlayer.username, message: 'Connected to Pong service.' }));
        } else {
            server.log.error({userId: newPlayer.id, connectionId: req.id}, "Pong: CRITICAL - Cannot send pong_auth_success, WebSocket closed prematurely after being added.");
            const addedPlayerIndex = pongRoom.players.findIndex(p=> p.id === newPlayer.id);
            if(addedPlayerIndex !== -1) pongRoom.players.splice(addedPlayerIndex, 1);
            pongRoom.playerCount = pongRoom.players.length;
            return;
        }

        let assignedSide = null;
        if (!pongRoom.paddles.left.playerId) {
            newPlayer.side = 'left'; pongRoom.paddles.left.playerId = newPlayer.id; assignedSide = 'left';
        } else if (!pongRoom.paddles.right.playerId) {
            newPlayer.side = 'right'; pongRoom.paddles.right.playerId = newPlayer.id; assignedSide = 'right';
        }

        if (assignedSide) {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'assign_side', side: assignedSide }));
            server.log.info({ connectionId: req.id, userId: newPlayer.id, side: assignedSide }, "Pong: Player assigned to paddle.");
        } else {
            // This case should ideally not be hit if the room full logic is correct (max 2 players)
            // unless a player connected, wasn't assigned (e.g. 3rd player), and then this log appears.
            // The room full check earlier should prevent this for 3+ players.
            server.log.warn({ connectionId: req.id, userId: newPlayer.id, pL: pongRoom.paddles.left.playerId, pR: pongRoom.paddles.right.playerId }, "Pong: Player connected but no paddle slot available (should be rare if room full logic is correct).");
        }
        
        const currentPlayersSides = {};
        if (pongRoom.paddles.left.playerId) {
            currentPlayersSides[pongRoom.paddles.left.playerId] = 'left';
        }
        if (pongRoom.paddles.right.playerId) {
            currentPlayersSides[pongRoom.paddles.right.playerId] = 'right';
        }

        const initialStateMessage = {
            type: 'initial_pong_state',
            ball: pongRoom.ball,
            paddles: pongRoom.paddles,
            gameIsRunning: pongRoom.gameIsRunning,
            yourPlayerId: newPlayer.id,
            yourSide: newPlayer.side,
            playerSides: currentPlayersSides, // Map of player IDs to their sides
            playersInGame: pongRoom.players.map(p => ({id: p.id, username: p.username, side: p.side}))
        };
        if (ws.readyState === 1) ws.send(JSON.stringify(initialStateMessage));
        
        broadcastPongMessage({type: 'player_joined_pong', user: {id: newPlayer.id, username: newPlayer.username, side: newPlayer.side}}, server);

        if (pongRoom.playerCount === 2 && !pongRoom.gameIsRunning) {
            startGame(server);
        } else if (pongRoom.playerCount < 2) {
            broadcastPongMessage({ type: 'status_update', context: 'pong_waiting', message: `Waiting for ${2 - pongRoom.playerCount} more player(s)...` }, server);
        }

        ws.on('message', (messageBuffer) => {
            const messageString = messageBuffer.toString();
            let data;
            try {
                data = JSON.parse(messageString);
            } catch (e) {
                server.log.warn({ connectionId: req.id, userId: authenticatedUserId, raw: messageString, err: e}, "Pong: Received non-JSON message");
                if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', context: 'pong_message', message: 'Invalid message format.' }));
                return;
            }

            server.log.info({ connectionId: req.id, userId: authenticatedUserId, data }, 'Pong: Received message');

            const currentPlayer = pongRoom.players.find(p => p.ws === ws); // Get current player based on ws
            if (!currentPlayer) {
                server.log.warn({ connectionId: req.id, userId: authenticatedUserId}, "Pong: Message received from a WebSocket not associated with a current player.");
                return;
            }


            if (data.type === 'paddle_move' && currentPlayer.side && pongRoom.gameIsRunning) {
                const paddle = pongRoom.paddles[currentPlayer.side];
                if (paddle) {
                    let newY = parseFloat(data.y);
                    if (!isNaN(newY)) {
                        newY = Math.max(0, newY);
                        newY = Math.min(newY, CANVAS_HEIGHT - PADDLE_HEIGHT);
                        paddle.y = newY;
                    } else {
                        server.log.warn({userId: authenticatedUserId, receivedY: data.y}, "Pong: Invalid Y in paddle_move");
                    }
                }
            } else if (data.type === 'request_restart' && !pongRoom.gameIsRunning) {
                server.log.info({userId: authenticatedUserId}, "Pong: Player requested restart.");
                if (pongRoom.playerCount === 2 && pongRoom.paddles.left.playerId && pongRoom.paddles.right.playerId) {
                    startGame(server);
                } else {
                    if (ws.readyState === 1) ws.send(JSON.stringify({type: 'status_update', context: 'pong_restart', message: 'Cannot restart, waiting for opponent.'}));
                }
            } else {
                 server.log.warn({userId: authenticatedUserId, type: data.type, gameIsRunning: pongRoom.gameIsRunning, playerSide: currentPlayer.side }, "Pong: Unhandled message type, or action not allowed (e.g., paddle_move when not in game/no side).");
            }
        });

        ws.on('close', (code, reason) => {
            const reasonString = reason ? reason.toString() : 'N/A';
            server.log.info({ connectionId: req.id, userId: authenticatedUserId, code, reason: reasonString }, `Pong: WebSocket for player ${authenticatedUserId} is closing.`);
            
            const playerIndex = pongRoom.players.findIndex(p => p.ws === ws);
            if (playerIndex !== -1) {
                const disconnectedPlayer = pongRoom.players.splice(playerIndex, 1)[0];
                pongRoom.playerCount = pongRoom.players.length;

                if (disconnectedPlayer.side) {
                    if (pongRoom.paddles.left.playerId === disconnectedPlayer.id) {
                        pongRoom.paddles.left.playerId = null;
                        pongRoom.paddles.left.score = 0;
                        resetPaddles();
                    } else if (pongRoom.paddles.right.playerId === disconnectedPlayer.id) {
                        pongRoom.paddles.right.playerId = null;
                        pongRoom.paddles.right.score = 0;
                        resetPaddles();
                    }
                }
                server.log.info({ userId: disconnectedPlayer.id, newPlayerCount: pongRoom.playerCount }, "Pong: Player removed from active list due to WS close.");
                broadcastPongMessage({type: 'player_left_pong', user: {id: disconnectedPlayer.id, username: disconnectedPlayer.username, side: disconnectedPlayer.side }}, server);
            } else {
                 server.log.warn({userId: authenticatedUserId, connectionId: req.id}, "Pong: ws.onclose - Player to remove not found by 'ws' instance (might have been replaced or already removed).");
            }

            if (pongRoom.gameIsRunning && pongRoom.playerCount < 2) {
                server.log.info({playerCount: pongRoom.playerCount}, "Pong: Player disconnected during game. Stopping game.");
                const remainingPlayer = pongRoom.players.length > 0 ? pongRoom.players[0] : null;
                stopGame(remainingPlayer ? remainingPlayer.id : null, "opponent_disconnected", server);
            } else if (pongRoom.playerCount < 2 && !pongRoom.gameIsRunning) {
                 broadcastPongMessage({ type: 'status_update', context: 'pong_waiting', message: `Waiting for ${2 - pongRoom.playerCount} more player(s)...` }, server);
            }
            
            if (pongRoom.playerCount === 0 && !pongRoom.gameIsRunning) { // If no players left and game not running (e.g., after stopGame or if they left before start)
                 server.log.info("Pong: No players left and game not running. Resetting paddles/ball for fresh room.");
                 resetBall(true);
                 resetPaddles();
                 resetScores(); // Ensure scores are 0 for a completely empty room
                 if (pongRoom.gameInterval) {
                    clearInterval(pongRoom.gameInterval);
                    pongRoom.gameInterval = null;
                 }
            }
        });

        ws.on('error', (err) => {
            server.log.error({ connectionId: req.id, userId: authenticatedUserId, err }, 'Pong: WebSocket error event for player.');
        });
    }
  });
}
