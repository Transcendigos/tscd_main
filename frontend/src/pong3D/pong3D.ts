import * as BABYLON from '@babylonjs/core';

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

export class Pong3D {
    private scene: BABYLON.Scene;
    private texture: BABYLON.DynamicTexture;
    private ctx: CanvasRenderingContext2D;
    private screenMesh: BABYLON.Mesh;

    private leftPaddle: IPaddle;
    private rightPaddle: IPaddle;
    private ball: IBall;
    private leftScore = 0;
    private rightScore = 0;
    private keysPressed: { [key: string]: boolean } = {};
    private canvasSize = { width: 800, height: 600 };
    private flickerPhase = 0;

    private aiMode = true;
    private aiDifficulty = 1;
    private aiPrecision = 5;
    private aiUpdateInterval: number | null = null;
    private readonly AI_RATE = 1000;
    private aiReactionBaseDelay = { 1: 60, 2: 120, 3: 220 };

    constructor(scene: BABYLON.Scene, screenMesh: BABYLON.Mesh) {
        this.scene = scene;
        this.screenMesh = screenMesh;
        this.texture = new BABYLON.DynamicTexture("pongTexture", this.canvasSize, this.scene, true);
        this.ctx = this.texture.getContext();

        const screenMaterial = new BABYLON.StandardMaterial("pongScreenMat", this.scene);
        screenMaterial.diffuseTexture = this.texture;
        screenMaterial.emissiveTexture = this.texture;
        screenMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this.screenMesh.material = screenMaterial;

        this.leftPaddle = { x: 10, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.rightPaddle = { x: this.canvasSize.width - 18, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.ball = this.createBall();
        this.start();
    }

    public start(): void {
        if (this.aiUpdateInterval) clearInterval(this.aiUpdateInterval);
        this.aiUpdateInterval = window.setInterval(() => this.runAIPrediction(), this.AI_RATE);
    }

    public stop(): void {
        if (this.aiUpdateInterval) {
            clearInterval(this.aiUpdateInterval);
            this.aiUpdateInterval = null;
        }
    }

    public handleInput(key: string, isPressed: boolean): void {
        this.keysPressed[key] = isPressed;
    }

    public update(dt: number): void {
        this.updatePaddles(dt);
        if (this.aiMode) {
            this.updateAI(dt);
        }
        this.updateBall(dt);
        this.draw();
    }

    private async runAIPrediction(): Promise<void> {
        if (!this.aiMode) return;

        if (this.ball.vx < 0) {
            this.ball.predictY = this.canvasSize.height / 2;
            return;
        }
        
        this.predictBallPosition();
        this.ball.paddleCenter = Math.random() * this.rightPaddle.height;
        
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const baseDelay = this.aiReactionBaseDelay[this.aiDifficulty] || 120;
        const reactionDelay = baseDelay + Math.random() * 50;
        await wait(reactionDelay);
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
        const newBall = this.createBall();
        newBall.vx = this.ball.vx > 0 ? -200 : 200;
        this.ball = newBall;
        
        if (this.rightScore - this.leftScore < 0) {
            this.aiDifficulty = 1;
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

        if (this.ball.x + this.ball.width + 5 < 0) {
            this.rightScore++;
            if (this.aiMode) this.updateDifficulty();
            this.resetPos();
        } else if (this.ball.x > this.canvasSize.width) {
            this.leftScore++;
            if (this.aiMode) this.updateDifficulty();
            this.resetPos();
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
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#001c3b");
        bgGradient.addColorStop(0.5, "#234461");
        bgGradient.addColorStop(1, "#001c3b");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);

        this.drawMidline();
        this.drawScore();
        this.drawPaddle(this.leftPaddle);
        this.drawPaddle(this.rightPaddle);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(this.ball.x, this.ball.y, this.ball.width, this.ball.height);
        this.drawVerticalCRTLines();
        
        this.texture.update();
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