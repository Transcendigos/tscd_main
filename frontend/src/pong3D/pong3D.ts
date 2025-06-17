import * as BABYLON from '@babylonjs/core';

// ... (interfaces remain the same)
interface IPaddle {
    x: number; y: number; width: number; height: number;
    prevY: number; dv: number;
}
interface IBall {
    x: number; y: number; width: number; height: number;
    vx: number; vy: number;
    dt: number; predictY: number; hitZ: number;
    paddleCenter: number; bounce: number; exchange: number;
}

enum PongGameState {
    OFF,
    BOOTING,
    DESKTOP,
    LOGO,
    TITLE,
    PLAYING,
    GAME_OVER
}

export class Pong3D {
    // ... (properties are mostly the same)
    private scene: BABYLON.Scene;
    private texture: BABYLON.DynamicTexture;
    private ctx: CanvasRenderingContext2D;
    private screenMesh: BABYLON.Mesh;

    private leftPaddle: IPaddle;
    private rightPaddle: IPaddle;
    private ball: IBall;
    private leftScore = 0;
    private rightScore = 0;
    private winner: 'Player' | 'AI' | null = null;
    private keysPressed: { [key: string]: boolean } = {};
    private canvasSize = { width: 800, height: 600 };
    private flickerPhase = 0;

    private gameState: PongGameState = PongGameState.OFF;
    private stateEntryTime: number = 0;
    private isFirstPlayingFrame: boolean = true;

    private aiMode = true;
    private aiDifficulty = 1;
    private aiPrecision = 5;
    private aiUpdateInterval: number | null = null;
    private readonly AI_RATE = 1000;
    private aiReactionBaseDelay = { 1: 60, 2: 120, 3: 220 };
    
    private mousePosition: { x: number, y: number } | null = null;
    private readonly cursorSize = 15;
    private readonly pongIcon = { x: 50, y: 100, width: 80, height: 100 };
    private readonly playAgainButton = { x: this.canvasSize.width / 2 - 220, y: 450, width: 200, height: 50 };
    private readonly mainMenuButton = { x: this.canvasSize.width / 2 + 20, y: 450, width: 200, height: 50 };

    public onPlayerWin: () => void = () => {};

    constructor(scene: BABYLON.Scene, screenMesh: BABYLON.Mesh) {
        // ... (constructor is mostly the same)
        this.scene = scene;
        this.screenMesh = screenMesh;
        this.texture = new BABYLON.DynamicTexture("pongTexture", this.canvasSize, this.scene, true);
        this.ctx = this.texture.getContext();

        const screenMaterial = new BABYLON.StandardMaterial("pongScreenMat", this.scene);
        screenMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        screenMaterial.emissiveTexture = this.texture;
        screenMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this.screenMesh.material = screenMaterial;

        this.leftPaddle = { x: 10, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.rightPaddle = { x: this.canvasSize.width - 18, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.ball = this.createBall();
        
        if (this.aiUpdateInterval) clearInterval(this.aiUpdateInterval);
        this.aiUpdateInterval = window.setInterval(() => this.runAIPrediction(), this.AI_RATE);
        
        this.enterState('OFF');
    }
    
    // Updated handleClick for new flow
    public handleClick(uv: BABYLON.Vector2): void {
        const clickX = uv.x * this.canvasSize.width;
        const clickY = (1 - uv.y) * this.canvasSize.height;

        if (this.gameState === PongGameState.DESKTOP) {
            // PONG.EXE ICON: Resets the game and goes to the TITLE screen
            if (clickX >= this.pongIcon.x && clickX <= this.pongIcon.x + this.pongIcon.width &&
                clickY >= this.pongIcon.y && clickY <= this.pongIcon.y + this.pongIcon.height) {
                this.resetGame();
                this.enterState('TITLE');
            }
        } else if (this.gameState === PongGameState.GAME_OVER) {
            // PLAY AGAIN BUTTON: Resets the game and goes directly to PLAYING
            if (clickX >= this.playAgainButton.x && clickX <= this.playAgainButton.x + this.playAgainButton.width &&
                clickY >= this.playAgainButton.y && clickY <= this.playAgainButton.y + this.playAgainButton.height) {
                this.resetGame();
                this.enterState('PLAYING');
            }
            // MAIN MENU BUTTON: Goes back to the desktop
            if (clickX >= this.mainMenuButton.x && clickX <= this.mainMenuButton.x + this.mainMenuButton.width &&
                clickY >= this.mainMenuButton.y && clickY <= this.mainMenuButton.y + this.mainMenuButton.height) {
                this.enterState('DESKTOP');
            }
        }
    }

    // New helper function to reset game state
    private resetGame(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        this.winner = null;
        this.resetPos();
    }

    // Updated update method with correct LOGO -> DESKTOP transition
    public update(dt: number): void {
        if (this.gameState === PongGameState.BOOTING) {
            const elapsedTime = performance.now() - this.stateEntryTime;
            if (elapsedTime > 6000) {
                this.enterState('LOGO');
            }
        } else if (this.gameState === PongGameState.LOGO) {
            const elapsedTime = performance.now() - this.stateEntryTime;
            if (elapsedTime > 4000) {
                this.enterState('DESKTOP'); // This is correct for the initial boot
            }
        } else if (this.gameState === PongGameState.PLAYING) {
            if (this.isFirstPlayingFrame) {
                this.ball.dt = dt;
                this.runAIPrediction();
                this.isFirstPlayingFrame = false;
            }
            this.updatePaddles(dt);
            if (this.aiMode) {
                this.updateAI(dt);
            }
            this.updateBall(dt);
        }
        this.draw();
    }

    // ... (The rest of the file remains the same as the last correct version)
    public getScreenMesh(): BABYLON.Mesh { return this.screenMesh; }
    public updateMousePosition(uv: BABYLON.Vector2 | null): void {
        if (uv) {
            this.mousePosition = { x: uv.x * this.canvasSize.width, y: (1 - uv.y) * this.canvasSize.height };
        } else {
            this.mousePosition = null;
        }
    }
    public isPreGame(): boolean {
        return this.gameState === PongGameState.LOGO || this.gameState === PongGameState.TITLE;
    }

    public resetStateTimer(): void {
        this.stateEntryTime = performance.now();
    }

    public enterState(newState: keyof typeof PongGameState): void {
        this.gameState = PongGameState[newState];
        this.stateEntryTime = performance.now();
        if (this.gameState === PongGameState.PLAYING) {
            this.isFirstPlayingFrame = true;
        } else if (this.gameState === PongGameState.DESKTOP) {
            this.mousePosition = null;
        }
        if (this.gameState === PongGameState.LOGO) {
            console.log("duung");
        }
    }
    
    public startBootSequence(): void {
        this.enterState('BOOTING');
    }

    public stop(): void {
        if (this.aiUpdateInterval) {
            clearInterval(this.aiUpdateInterval);
            this.aiUpdateInterval = null;
        }
    }

    public handleInput(key: string, isPressed: boolean): void {
        if (this.gameState !== PongGameState.PLAYING && this.gameState !== PongGameState.TITLE) {
            return;
        }
        this.keysPressed[key] = isPressed;
        if (isPressed && key === 'Enter' && this.gameState === PongGameState.TITLE) {
            this.enterState('PLAYING');
        }
    }

    private runAIPrediction(): void {
        if (!this.aiMode || this.gameState !== PongGameState.PLAYING) return;
        if (this.ball.vx < 0) {
            this.ball.predictY = this.canvasSize.height / 2;
            return;
        }
        this.predictBallPosition();
        this.ball.paddleCenter = Math.random() * this.rightPaddle.height;
    }

    private updateAI(dt: number): void {
        const paddleSpeed = 500 * dt;
        let aimZone = this.aiPrecision + this.aiPrecision * this.ball.bounce;
        let paddleCenter = this.rightPaddle.y + this.ball.paddleCenter;
        if (this.aiDifficulty === 3 && this.ball.vx < 0) return;
        if (this.ball.predictY >= paddleCenter - aimZone && this.ball.predictY <= paddleCenter + aimZone) {
          return;
        }
        if (this.ball.predictY <= paddleCenter && this.rightPaddle.y > 0) {
          this.rightPaddle.y -= paddleSpeed;
        }
        if (this.ball.predictY >= paddleCenter && this.rightPaddle.y + this.rightPaddle.height < this.canvasSize.height) {
          this.rightPaddle.y += paddleSpeed;
        }
    }

    private updatePaddles(dt: number): void {
        const paddleSpeed = 500 * dt;
        
        if (this.keysPressed['w'] && this.leftPaddle.y > 0) {
            this.leftPaddle.y -= paddleSpeed;
        }
        if (this.keysPressed['s'] && this.leftPaddle.y + this.leftPaddle.height < this.canvasSize.height) {
            this.leftPaddle.y += paddleSpeed;
        }
        this.leftPaddle.y = Math.max(0, Math.min(this.leftPaddle.y, this.canvasSize.height - this.leftPaddle.height));
        this.leftPaddle.dv = this.leftPaddle.y - this.leftPaddle.prevY;
        this.leftPaddle.prevY = this.leftPaddle.y;
        
        this.rightPaddle.y = Math.max(0, Math.min(this.rightPaddle.y, this.canvasSize.height - this.rightPaddle.height));
        this.rightPaddle.dv = this.rightPaddle.y - this.rightPaddle.prevY;
        this.rightPaddle.prevY = this.rightPaddle.y;
    }
    
    private createBall(): IBall {
        return {
            x: this.canvasSize.width / 2, y: this.canvasSize.height / 2,
            width: 10, height: 10,
            vx: 200 * (Math.random() > 0.5 ? 1 : -1),
            vy: (Math.random() > 0.5 ? 1 : -1) * 100,
            dt: 0, predictY: 0, hitZ: 0, paddleCenter: 1, bounce: 0, exchange: 0
        };
    }

    private resetPos(): void {
        this.leftPaddle.y = this.canvasSize.height / 2 - this.leftPaddle.height / 2;
        this.rightPaddle.y = this.canvasSize.height / 2 - this.rightPaddle.height / 2;
        const oldVx = this.ball ? this.ball.vx : 0;
        this.ball = this.createBall();
        if (oldVx !== 0) {
             this.ball.vx = oldVx > 0 ? -200 : 200;
        }
    }

    private updateBall(dt: number): void {
        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;
        this.ball.dt = dt;
        if (this.ball.y <= 0 || this.ball.y + this.ball.height >= this.canvasSize.height) {
            this.ball.vy *= -1;
        }
        const collides = (paddle: IPaddle, ball: IBall) => {
            return ball.x < paddle.x + paddle.width && ball.x + ball.width > paddle.x &&
                   ball.y < paddle.y + paddle.height && ball.y + ball.height > paddle.y;
        };
        if (collides(this.leftPaddle, this.ball)) {
            this.handleCollision(this.ball, this.leftPaddle);
            this.ball.x = this.leftPaddle.x + this.leftPaddle.width;
        } else if (collides(this.rightPaddle, this.ball)) {
            this.handleCollision(this.ball, this.rightPaddle);
            this.ball.x = this.rightPaddle.x - this.ball.width;
        }
        const winningScore = 5;
        if (this.ball.x + this.ball.width + 5 < 0) {
            this.rightScore++;
            if (this.rightScore >= winningScore) {
                this.winner = 'AI';
                this.onPlayerWin();
                this.enterState('GAME_OVER');
            } else {
                if (this.aiMode) this.updateDifficulty();
                this.resetPos();
            }
        } else if (this.ball.x > this.canvasSize.width) {
            this.leftScore++;
            if (this.leftScore >= winningScore) {
                this.winner = 'Player';
                this.enterState('GAME_OVER');
                this.onPlayerWin();
            } else {
                if (this.aiMode) this.updateDifficulty();
                this.resetPos();
            }
        }
    }

    private handleCollision(ball: IBall, paddle: IPaddle): void {
        ball.vx *= -1.1;
        if (Math.abs(ball.vx) < 350) {
            if (ball.vx < 0) ball.vx = -350;
            else if (ball.vx > 0) ball.vx = 350;
        }
        if (ball.vx < -500) ball.vx = -500;
        else if (ball.vx > 500) ball.vx = 500;
        const hitZone = (ball.y - paddle.y) / paddle.height;
        const maxAngle = 250;
        const deflect = (hitZone - 0.5) * 2 * maxAngle;
        if (hitZone >= 0.4 && hitZone <= 0.6) {
            ball.vy = 0;
            ball.vx *= 1.3;
        } else if (deflect < 0) {
            ball.vy = deflect - Math.abs(ball.vx / 4);
            ball.vy += paddle.dv * 15;
        } else if (deflect > 0) {
            ball.vy = deflect + Math.abs(ball.vx / 4);
            ball.vy += paddle.dv * 15;
        }
        ball.exchange++;
        if (ball.exchange > 5 && this.aiDifficulty < 3) this.aiDifficulty++;
    }

    private updateDifficulty(): void {
        const gap = this.rightScore - this.leftScore;
        if (gap <= 0 && this.aiDifficulty > 1) this.aiDifficulty--;
        else if (gap > 0 && this.aiDifficulty < 3) this.aiDifficulty++;
        this.aiPrecision = 10 + 15 * (this.aiDifficulty - 1);
    }

    private predictBallPosition(): void {
        let simX = this.ball.x, simY = this.ball.y;
        let simDx = this.ball.vx * this.ball.dt, simDy = this.ball.vy * this.ball.dt;
        this.ball.bounce = 0;
        while ((simDx > 0 && simX < this.rightPaddle.x) || (simDx < 0 && simX > this.rightPaddle.x)) {
            simX += simDx; simY += simDy;
            if (simY < 0 || simY > this.canvasSize.height) {
                simDy = -simDy;
                simY = Math.max(0, Math.min(this.canvasSize.height, simY));
                this.ball.bounce++;
            }
        }
        this.ball.predictY = simY;
    }

    private draw(): void {
        this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        
        switch(this.gameState) {
            case PongGameState.OFF:
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
                break;
            case PongGameState.BOOTING:
                this.drawBootingScreen();
                break;
            case PongGameState.DESKTOP:
                this.drawDesktop();
                break;
            case PongGameState.LOGO:
                this.drawLogoScreen();
                break;
            case PongGameState.TITLE:
                this.drawTitleScreen();
                break;
            case PongGameState.PLAYING:
                this.drawGame();
                break;
            case PongGameState.GAME_OVER:
                this.drawGameOverScreen();
                break;
        }
        this.drawCursor();
        this.texture.update();
    }

    private drawCursor(): void {
        if (this.mousePosition) {
            this.ctx.fillStyle = 'red';
            this.ctx.beginPath();
            this.ctx.arc(this.mousePosition.x, this.mousePosition.y, this.cursorSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    private drawBootingScreen(): void {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = '16px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        const bootText = ["TRANSCENDENCE BIOS v1.0", "Initializing USB Controllers ... Done", "Memory Test: 640K OK", "", "Detecting Primary Master ... PONG_AI.SYS", "Detecting Primary Slave ... None", "Detecting Secondary Master ... USER_INPUT.DLL", "Detecting Secondary Slave ... None", "", "Loading PS-DOS...", "HIMEM is testing extended memory...done.","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT","PROOT PROOT PROOT PROOT PROOT PROOT",];
        const elapsedTime = performance.now() - this.stateEntryTime;
        const linesToShow = Math.floor(elapsedTime / 250);
        for(let i = 0; i < linesToShow && i < bootText.length; i++) {
            this.ctx.fillText(bootText[i], 10, 10 + (i * 20));
        }
        if (elapsedTime % 1000 > 500) {
            this.ctx.fillText("_", 10, 10 + (Math.min(linesToShow, bootText.length) * 20));
        }
    }


    private drawDesktop(): void {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#1e293b");
        bgGradient.addColorStop(0.5, "#1b3F72");
        bgGradient.addColorStop(1, "#1e293b");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        
        this.drawVerticalCRTLines();

        this.ctx.font = 'bold 32px "Inter", sans-serif';
        this.ctx.fillStyle = '#4cb4e7';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TRANSCENDENCE', this.canvasSize.width / 2, 40);
        
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.fillRect(this.pongIcon.x + 15, this.pongIcon.y + 10, 50, 40);
        this.ctx.font = 'bold 20px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("P", this.pongIcon.x + 40, this.pongIcon.y + 38);
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.font = '14px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PONG.EXE', this.pongIcon.x + this.pongIcon.width / 2, this.pongIcon.y + 75);
    }
    
    private drawGameOverScreen(): void {
        this.drawGame();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.ctx.font = "60px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.fillText("GAME OVER", this.canvasSize.width / 2, this.canvasSize.height / 2 - 100);
        this.ctx.font = "40px 'Press Start 2P'";
        this.ctx.fillText(`${this.winner} Wins!`, this.canvasSize.width / 2, this.canvasSize.height / 2 - 20);
        const buttons = [
            {...this.playAgainButton, text: "PLAY AGAIN"},
            {...this.mainMenuButton, text: "MAIN MENU"}
        ];
        buttons.forEach(button => {
            let isHovered = false;
            if (this.mousePosition) {
                isHovered = this.mousePosition.x >= button.x &&
                            this.mousePosition.x <= button.x + button.width &&
                            this.mousePosition.y >= button.y &&
                            this.mousePosition.y <= button.y + button.height;
            }
            this.ctx.strokeStyle = '#d6ecff';
            this.ctx.fillStyle = isHovered ? 'rgba(214, 236, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            this.ctx.strokeRect(button.x, button.y, button.width, button.height);
            this.ctx.fillStyle = "#d6ecff";
            this.ctx.font = "16px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        });
    }

    private drawLogoScreen(): void {
        this.ctx.fillStyle = '#234461';
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.drawVerticalCRTLines();
        const elapsedTime = performance.now() - this.stateEntryTime;
        const FADE_IN_TIME = 1000;
        const FADE_OUT_TIME = 2000;
        const DURATION = 4000;
        let alpha = 0.0;
        if (elapsedTime < FADE_IN_TIME) {
            alpha = elapsedTime / FADE_IN_TIME;
        } else if (elapsedTime > DURATION - FADE_OUT_TIME) {
            alpha = (DURATION - elapsedTime) / FADE_OUT_TIME;
        } else {
            alpha = 1.0;
        }
        this.ctx.globalAlpha = Math.max(0, alpha);
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.font = 'bold 96px "Inter", sans-serif';
        this.ctx.textAlign = "center";
        this.ctx.fillText("18 42", this.canvasSize.width / 2, this.canvasSize.height / 2 + 30);
        this.ctx.globalAlpha = 1.0;
    }

    private drawGame(): void {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#001c3b");
        bgGradient.addColorStop(0.5, "#234461");
        bgGradient.addColorStop(1, "#001c3b");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.drawVerticalCRTLines();
        this.drawMidline();
        this.drawScore();
        this.drawPaddle(this.leftPaddle);
        this.drawPaddle(this.rightPaddle);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(this.ball.x, this.ball.y, this.ball.width, this.ball.height);
    }

    private drawTitleScreen(): void {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#001c3b");
        bgGradient.addColorStop(0.5, "#234461");
        bgGradient.addColorStop(1, "#001c3b");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.drawVerticalCRTLines();
        this.ctx.font = "80px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.fillText("PONG", this.canvasSize.width / 2, this.canvasSize.height / 2 - 40);
        this.ctx.font = "20px 'Press Start 2P'";
        this.flickerPhase += 0.05;
        this.ctx.globalAlpha = 0.6 + Math.sin(this.flickerPhase) * 0.4;
        this.ctx.fillText("Press Enter to Start", this.canvasSize.width / 2, this.canvasSize.height / 2 + 40);
        this.ctx.globalAlpha = 1.0;
    }

    private drawMidline(): void {
        const segmentHeight = 20, gap = 15, lineWidth = 4;
        const x = this.canvasSize.width / 2 - lineWidth / 2;
        for (let y = 0; y < this.canvasSize.height; y += segmentHeight + gap) {
            this.ctx.fillStyle = "#d6ecff";
            this.ctx.fillRect(x, y, lineWidth, segmentHeight);
        }
    }

    private drawScore(): void {
        this.ctx.font = "64px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.fillText(`${this.leftScore}  ${this.rightScore}`, this.canvasSize.width / 2, this.canvasSize.height / 6);
    }
    
    private drawPaddle(paddle: IPaddle): void {
        this.ctx.fillStyle = "#d6ecff";
        this.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 10);
        this.ctx.fill();
    }

    private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    private drawVerticalCRTLines(): void {
        this.flickerPhase += 0.1;
        const flickerAlpha = 0.04 + 0.01 * Math.sin(this.flickerPhase);
        this.ctx.save();
        this.ctx.globalAlpha = flickerAlpha + 0.1;
        this.ctx.strokeStyle = "#00ffff";
        this.ctx.lineWidth = 1;
        for (let y = 0; y < this.canvasSize.height; y += 3) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvasSize.width, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
}