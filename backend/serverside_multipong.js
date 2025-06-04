// serverside_localmultipong.js
// Note: This version simplifies player management for a local multiplayer context.
// Authentication is assumed to be handled by the client connecting, but the game
// itself doesn't assign paddles based on different authenticated users like remote pong.

// Game constants (can be shared or mirrored from client/other server files)
const PADDLE_HEIGHT_LM = 70;
const PADDLE_WIDTH_LM = 8;
const BALL_SIZE_LM = 10;
const CANVAS_WIDTH_LM = 800; 
const CANVAS_HEIGHT_LM = 600;
const BALL_START_VX_LM = 3; // Adjusted for potentially faster local play feel
const BALL_START_VY_LM = 1.5;
const MAX_BALL_SPEED_X_LM = 9;
const MAX_BALL_SPEED_Y_LM = 7;
const PADDLE_SPEED_LM = 5; // Movement per input, direct control
const WINNING_SCORE_LM = 5;
const BALL_SPEED_INCREASE_LM = -1.03; // Slight speed up on hit


const localGameRoom = {
    client: null, // Stores the single WebSocket connection for this local game
    ball: {
        x: CANVAS_WIDTH_LM / 2 - BALL_SIZE_LM / 2,
        y: CANVAS_HEIGHT_LM / 2 - BALL_SIZE_LM / 2,
        width: BALL_SIZE_LM,
        height: BALL_SIZE_LM,
        vx: BALL_START_VX_LM * (Math.random() > 0.5 ? 1 : -1),
        vy: BALL_START_VY_LM * (Math.random() > 0.5 ? 1 : -1)
    },
    paddles: {
        left: { x: 10, y: CANVAS_HEIGHT_LM / 2 - PADDLE_HEIGHT_LM / 2, width: PADDLE_WIDTH_LM, height: PADDLE_HEIGHT_LM, score: 0 },
        right: { x: CANVAS_WIDTH_LM - PADDLE_WIDTH_LM - 10, y: CANVAS_HEIGHT_LM / 2 - PADDLE_HEIGHT_LM / 2, width: PADDLE_WIDTH_LM, height: PADDLE_HEIGHT_LM, score: 0 }
    },
    gameIsRunning: false,
    promptStart: true, // Start with prompt
    waitingForRestart: false,
    gameInterval: null,
};

function sendStateToClient(clientWs, serverInstance) {
    if (clientWs && clientWs.readyState === 1 /* WebSocket.OPEN */) {
        try {
            clientWs.send(JSON.stringify({
                type: 'local_game_state',
                ball: localGameRoom.ball,
                paddles: localGameRoom.paddles,
                gameIsRunning: localGameRoom.gameIsRunning,
                promptStart: localGameRoom.promptStart,
                waitingForRestart: localGameRoom.waitingForRestart,
            }));
        } catch (e) {
            const logger = serverInstance?.log || console;
            logger.error({ err: e }, "LocalPong: Error sending state to client.");
        }
    }
}

function resetLocalBall(serverInitiated = false) {
    localGameRoom.ball.x = CANVAS_WIDTH_LM / 2 - BALL_SIZE_LM / 2;
    localGameRoom.ball.y = CANVAS_HEIGHT_LM / 2 - BALL_SIZE_LM / 2;
    const lastVxSign = Math.sign(localGameRoom.ball.vx);
    localGameRoom.ball.vx = BALL_START_VX_LM * (serverInitiated ? (Math.random() > 0.5 ? 1 : -1) : -lastVxSign || (Math.random() > 0.5 ? 1 : -1));
    localGameRoom.ball.vy = BALL_START_VY_LM * (Math.random() > 0.5 ? 1 : -1);
    if (Math.abs(localGameRoom.ball.vy) < 0.5) localGameRoom.ball.vy = Math.sign(localGameRoom.ball.vy || 1) * 0.5;
}

function resetLocalPaddlesAndScores() {
    localGameRoom.paddles.left.y = CANVAS_HEIGHT_LM / 2 - PADDLE_HEIGHT_LM / 2;
    localGameRoom.paddles.right.y = CANVAS_HEIGHT_LM / 2 - PADDLE_HEIGHT_LM / 2;
    localGameRoom.paddles.left.score = 0;
    localGameRoom.paddles.right.score = 0;
}


function updateLocalGame(serverInstance) {
    if (!localGameRoom.gameIsRunning) return;

    // Ball movement (direct, no dt, assuming fixed interval)
    localGameRoom.ball.x += localGameRoom.ball.vx;
    localGameRoom.ball.y += localGameRoom.ball.vy;

    // Wall collisions (top/bottom)
    if (localGameRoom.ball.y <= 0) {
        localGameRoom.ball.y = 0; localGameRoom.ball.vy *= -1;
    } else if (localGameRoom.ball.y + localGameRoom.ball.height >= CANVAS_HEIGHT_LM) {
        localGameRoom.ball.y = CANVAS_HEIGHT_LM - localGameRoom.ball.height; localGameRoom.ball.vy *= -1;
    }

    // Paddle collisions
    let paddleHit = null;
    if (localGameRoom.ball.vx < 0 &&
        localGameRoom.ball.x <= localGameRoom.paddles.left.x + localGameRoom.paddles.left.width &&
        localGameRoom.ball.x + localGameRoom.ball.width >= localGameRoom.paddles.left.x &&
        localGameRoom.ball.y + localGameRoom.ball.height >= localGameRoom.paddles.left.y &&
        localGameRoom.ball.y <= localGameRoom.paddles.left.y + localGameRoom.paddles.left.height) {
        paddleHit = localGameRoom.paddles.left;
        localGameRoom.ball.x = localGameRoom.paddles.left.x + localGameRoom.paddles.left.width;
    } else if (localGameRoom.ball.vx > 0 &&
        localGameRoom.ball.x + localGameRoom.ball.width >= localGameRoom.paddles.right.x &&
        localGameRoom.ball.x <= localGameRoom.paddles.right.x + localGameRoom.paddles.right.width &&
        localGameRoom.ball.y + localGameRoom.ball.height >= localGameRoom.paddles.right.y &&
        localGameRoom.ball.y <= localGameRoom.paddles.right.y + localGameRoom.paddles.right.height) {
        paddleHit = localGameRoom.paddles.right;
        localGameRoom.ball.x = localGameRoom.paddles.right.x - localGameRoom.ball.width;
    }

    if (paddleHit) {
        localGameRoom.ball.vx *= BALL_SPEED_INCREASE_LM;
        const hitPositionRatio = (localGameRoom.ball.y + localGameRoom.ball.height / 2 - paddleHit.y) / paddleHit.height; // 0 to 1
        localGameRoom.ball.vy += (hitPositionRatio - 0.5) * 4; // Simplified angle factor

        localGameRoom.ball.vx = Math.max(-MAX_BALL_SPEED_X_LM, Math.min(MAX_BALL_SPEED_X_LM, localGameRoom.ball.vx));
        localGameRoom.ball.vy = Math.max(-MAX_BALL_SPEED_Y_LM, Math.min(MAX_BALL_SPEED_Y_LM, localGameRoom.ball.vy));
    }

    // Scoring
    let scored = false;
    if (localGameRoom.ball.x + localGameRoom.ball.width < 0) {
        localGameRoom.paddles.right.score++; scored = true;
    } else if (localGameRoom.ball.x > CANVAS_WIDTH_LM) {
        localGameRoom.paddles.left.score++; scored = true;
    }

    if (scored) {
        if (localGameRoom.paddles.left.score >= WINNING_SCORE_LM || localGameRoom.paddles.right.score >= WINNING_SCORE_LM) {
            stopLocalGame("win", serverInstance);
        } else {
            resetLocalBall();
        }
    }
    // State is broadcasted by the interval timer
}

function startLocalGame(serverInstance) {
    const logger = serverInstance?.log || console;
    if (!localGameRoom.client) {
        logger.warn("LocalPong: Cannot start, no client connected.");
        return;
    }
    if (localGameRoom.gameIsRunning) {
        logger.info("LocalPong: Game already running.");
        return;
    }
    logger.info("LocalPong: Starting game.");
    localGameRoom.gameIsRunning = true;
    localGameRoom.promptStart = false;
    localGameRoom.waitingForRestart = false;
    resetLocalPaddlesAndScores();
    resetLocalBall(true);

    if (localGameRoom.gameInterval) clearInterval(localGameRoom.gameInterval);
    localGameRoom.gameInterval = setInterval(() => {
        updateLocalGame(serverInstance);
        sendStateToClient(localGameRoom.client, serverInstance);
    }, 1000 / 60); // ~60 FPS

    // Initial state broadcast after start
    sendStateToClient(localGameRoom.client, serverInstance);
}

function stopLocalGame(reason = "ended", serverInstance) {
    const logger = serverInstance?.log || console;
    if (!localGameRoom.gameIsRunning && reason !== "client_disconnect") return; // Allow stopping if client disconnects even if not running

    logger.info({ reason }, `LocalPong: Stopping game.`);
    localGameRoom.gameIsRunning = false;
    if (localGameRoom.gameInterval) {
        clearInterval(localGameRoom.gameInterval);
        localGameRoom.gameInterval = null;
    }
    if (reason === "win") {
        localGameRoom.waitingForRestart = true;
    } else if (reason === "client_disconnect") {
        localGameRoom.promptStart = true; // Reset to initial state for next connection
        localGameRoom.waitingForRestart = false;
        resetLocalPaddlesAndScores(); // Full reset
        resetLocalBall(false);
    }
    // State broadcast happens via interval or on next client connection / message
    sendStateToClient(localGameRoom.client, serverInstance);
}

export default async function localPongWsRoutes(server, options) {
    server.route({
        method: 'GET',
        url: '/ws/localpong', // Distinct URL for local multiplayer pong
        handler: (req, reply) => {
            reply.code(400).send({ error: 'This is a WebSocket endpoint for Local Pong. Please connect using a WebSocket client.' });
        },
        wsHandler: (connection, req) => {
            const ws = connection;
            server.log.info({ connectionId: req.id, ip: req.ip }, 'LocalPong: New WebSocket connection attempt.');

            if (localGameRoom.client && localGameRoom.client.readyState === 1) {
                server.log.warn({ connectionId: req.id }, "LocalPong: Game session already active. Closing new connection.");
                ws.send(JSON.stringify({ type: 'error', context: 'local_pong_join', message: 'Local game session is already in use.' }));
                ws.close(1000, "Session in use");
                return;
            }

            localGameRoom.client = ws;
            server.log.info({ connectionId: req.id }, "LocalPong: Client connected. Initializing for game.");
            
            // Reset to initial state if no game was running, or if previous client disconnected improperly
            if (!localGameRoom.gameIsRunning && !localGameRoom.waitingForRestart) {
                localGameRoom.promptStart = true;
                resetLocalPaddlesAndScores();
                resetLocalBall(false); // Ball stationary
            }
            sendStateToClient(ws, server);


            ws.on('message', (messageBuffer) => {
                const messageString = messageBuffer.toString();
                let data;
                try {
                    data = JSON.parse(messageString);
                } catch (e) {
                    server.log.warn({ connectionId: req.id, raw: messageString, err: e }, "LocalPong: Received non-JSON message");
                    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', context: 'local_pong_message', message: 'Invalid message format.' }));
                    return;
                }

                server.log.info({ connectionId: req.id, data }, 'LocalPong: Received message');

                if (data.type === 'local_paddle_move') {
                    if (!localGameRoom.gameIsRunning) return;
                    const paddle = localGameRoom.paddles[data.side]; // 'left' or 'right'
                    if (paddle) {
                        if (data.direction === 'up') paddle.y -= PADDLE_SPEED_LM;
                        else if (data.direction === 'down') paddle.y += PADDLE_SPEED_LM;
                        paddle.y = Math.max(0, Math.min(paddle.y, CANVAS_HEIGHT_LM - PADDLE_HEIGHT_LM));
                    }
                } else if (data.type === 'request_start_local_game') {
                    if (localGameRoom.promptStart || localGameRoom.waitingForRestart) {
                        startLocalGame(server);
                    }
                }
                // No broadcast here, interval handles it
            });

            ws.on('close', (code, reason) => {
                const reasonString = reason ? reason.toString() : 'N/A';
                server.log.info({ connectionId: req.id, code, reason: reasonString }, `LocalPong: WebSocket client disconnected.`);
                if (ws === localGameRoom.client) {
                    localGameRoom.client = null;
                    stopLocalGame("client_disconnect", server); // Stops game, clears interval, resets state for next connection
                    server.log.info("LocalPong: Game session reset due to client disconnection.");
                }
            });

            ws.on('error', (err) => {
                server.log.error({ connectionId: req.id, err }, 'LocalPong: WebSocket error for client.');
                // 'close' event will usually follow
            });
        }
    });
}