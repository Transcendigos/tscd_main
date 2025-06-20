import * as BABYLON from '@babylonjs/core';
import { SoLongGame } from '../SoLongGame';

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
    GAME_OVER,
    SHOWING_TRUTH_PROMPT,
    PLAYING_TRUTH_GIF,
    PAUSED,
    THEME_CHOOSER,
    SO_LONG
}

export class Pong3D {
    private scene: BABYLON.Scene;
    private texture: BABYLON.DynamicTexture;
    private ctx: CanvasRenderingContext2D;
    private screenMesh: BABYLON.Mesh;

    private originalScreenMaterial: BABYLON.Material | null = null;
    private truthVideoTexture: BABYLON.VideoTexture | null = null;
    
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
    private readonly aiReactionBaseDelay = { 1: 60, 2: 120, 3: 220 };
    private mousePosition: { x: number, y: number } | null = null;
    private stateBeforePause: PongGameState | null = null;
    private readonly cursorSize = 15;
    private readonly pongIcon = { x: 50, y: 100, width: 80, height: 100 };
    private readonly truthIcon = { x: 50, y: 220, width: 80, height: 100 };
    private readonly soLongIcon = { x: 50, y: 460, width: 80, height: 100 };
    private readonly playAgainButton = { x: this.canvasSize.width / 2 - 220, y: 450, width: 200, height: 50 };
    private readonly mainMenuButton = { x: this.canvasSize.width / 2 + 20, y: 450, width: 200, height: 50 };
    private readonly truthConfirmButton = { x: this.canvasSize.width / 2 - 75, y: 350, width: 150, height: 50 };
    private readonly LOGO_FADE_IN_TIME = 1500;
    private readonly LOGO_STAY_TIME = 3000;
    private readonly LOGO_FADE_OUT_TIME = 1500;
    private readonly LOGO_TOTAL_DURATION = this.LOGO_FADE_IN_TIME + this.LOGO_STAY_TIME + this.LOGO_FADE_OUT_TIME;
    private readonly themeIcon = { x: 50, y: 340, width: 80, height: 100 };
    private readonly themeButtonBlue = { x: 250, y: 250, width: 100, height: 100 };
    private readonly themeButtonPink = { x: 350, y: 250, width: 100, height: 100 };
    private readonly themeButtonGreen = { x: 450, y: 250, width: 100, height: 100 };
    private bgFirstColor = "#1e293b";
    private bgSecondColor = "#1b3F72";
    private soLongGame: SoLongGame | null = null;
    
    // --- REACTION DELAY START ---
    private aiIsActing = false;
    private aiReactionTimeout: number | null = null;
    // --- REACTION DELAY END ---

    public onPlayerWin: () => void = () => {};

    constructor(scene: BABYLON.Scene, screenMesh: BABYLON.Mesh) {
        this.scene = scene;
        this.screenMesh = screenMesh;
        this.texture = new BABYLON.DynamicTexture("pongTexture", this.canvasSize, this.scene, true);
        this.ctx = this.texture.getContext();
        const screenMaterial = new BABYLON.StandardMaterial("pongScreenMat", this.scene);
        screenMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        screenMaterial.emissiveTexture = this.texture;
        screenMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this.screenMesh.material = screenMaterial;
        this.originalScreenMaterial = screenMaterial;
        this.leftPaddle = { x: 10, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.rightPaddle = { x: this.canvasSize.width - 18, y: this.canvasSize.height / 2 - 35, width: 8, height: 70, prevY: 0, dv: 0 };
        this.ball = this.createBall();
        if (this.aiUpdateInterval) clearInterval(this.aiUpdateInterval);
        this.aiUpdateInterval = window.setInterval(() => this.runAIPrediction(), this.AI_RATE);
        this.enterState('OFF');
    }

    private playTruthVideo(): void {
        if (!this.truthVideoTexture) {
            this.truthVideoTexture = new BABYLON.VideoTexture("truthVideo", "/assets/my_coffee_truth.webm", this.scene, true, false);
            this.truthVideoTexture.uScale = -1;
            this.truthVideoTexture.video.loop = true;
            this.truthVideoTexture.video.muted = true;
            this.truthVideoTexture.video.onloadedmetadata = () => {
            };
        }
        const videoMaterial = new BABYLON.StandardMaterial("videoMat", this.scene);
        videoMaterial.emissiveTexture = this.truthVideoTexture;
        videoMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        this.screenMesh.material = videoMaterial;
        this.truthVideoTexture.video.play().catch(e => console.error("Video play failed:", e));
    }

    private stopTruthVideo(): void {
        if (this.truthVideoTexture && this.truthVideoTexture.video) {
            this.truthVideoTexture.video.pause();
        }
        if (this.originalScreenMaterial) {
            this.screenMesh.material = this.originalScreenMaterial;
        }
    }
    
    public enterState(newState: keyof typeof PongGameState): void {
        const oldState = this.gameState;
        if (oldState === PongGameState.SO_LONG) {
            this.soLongGame?.stop();
            this.soLongGame = null;
        }
        if (oldState === PongGameState.PLAYING_TRUTH_GIF) {
            this.stopTruthVideo();
        }
        this.gameState = PongGameState[newState];
        this.stateEntryTime = performance.now();
        if (this.gameState === PongGameState.PLAYING) {
            this.isFirstPlayingFrame = true;
        } else if (this.gameState === PongGameState.DESKTOP) {
            this.mousePosition = null;
        } else if (this.gameState === PongGameState.PLAYING_TRUTH_GIF) {
            this.playTruthVideo();
        }
    }

    public async handleClick(uv: BABYLON.Vector2): Promise<void> {
        const clickX = uv.x * this.canvasSize.width;
        const clickY = (1 - uv.y) * this.canvasSize.height;
        switch (this.gameState) {
            case PongGameState.DESKTOP:
                if (clickX >= this.pongIcon.x && clickX <= this.pongIcon.x + this.pongIcon.width &&
                    clickY >= this.pongIcon.y && clickY <= this.pongIcon.y + this.pongIcon.height) {
                    this.resetGame(); this.enterState('TITLE');
                }
                if (clickX >= this.truthIcon.x && clickX <= this.truthIcon.x + this.truthIcon.width &&
                    clickY >= this.truthIcon.y && clickY <= this.truthIcon.y + this.truthIcon.height) {
                    this.enterState('SHOWING_TRUTH_PROMPT');
                }
                if (clickX >= this.themeIcon.x && clickX <= this.themeIcon.x + this.themeIcon.width &&
                    clickY >= this.themeIcon.y && clickY <= this.themeIcon.y + this.themeIcon.height) {
                    this.enterState('THEME_CHOOSER');
                }
                if (clickX >= this.soLongIcon.x && clickX <= this.soLongIcon.x + this.soLongIcon.width &&
                    clickY >= this.soLongIcon.y && clickY <= this.soLongIcon.y + this.soLongIcon.height) {
                    this.soLongGame = new SoLongGame(this.ctx.canvas, () => {
                        this.enterState('DESKTOP');
                    });
                    await this.soLongGame.start();
                    this.enterState('SO_LONG');
                }
                break;
            case PongGameState.GAME_OVER:
                if (clickX >= this.playAgainButton.x && clickX <= this.playAgainButton.x + this.playAgainButton.width &&
                    clickY >= this.playAgainButton.y && clickY <= this.playAgainButton.y + this.playAgainButton.height) {
                    this.resetGame(); this.enterState('PLAYING');
                }
                if (clickX >= this.mainMenuButton.x && clickX <= this.mainMenuButton.x + this.mainMenuButton.width &&
                    clickY >= this.mainMenuButton.y && clickY <= this.mainMenuButton.y + this.mainMenuButton.height) {
                    this.enterState('DESKTOP');
                }
                break;
            case PongGameState.SHOWING_TRUTH_PROMPT:
                if (clickX >= this.truthConfirmButton.x && clickX <= this.truthConfirmButton.x + this.truthConfirmButton.width &&
                    clickY >= this.truthConfirmButton.y && clickY <= this.truthConfirmButton.y + this.truthConfirmButton.height) {
                    this.enterState('PLAYING_TRUTH_GIF');
                }
                break;
            case PongGameState.PLAYING_TRUTH_GIF:
                this.enterState('DESKTOP');
                break;
            case PongGameState.THEME_CHOOSER:
                const dispatchThemeChangeEvent = (theme: string) => {
                    window.dispatchEvent(new CustomEvent('changeTheme', { detail: { theme } }));
                    this.enterState('DESKTOP');
                };

                if (clickX >= this.themeButtonBlue.x && clickX <= this.themeButtonBlue.x + this.themeButtonBlue.width &&
                    clickY >= this.themeButtonBlue.y && clickY <= this.themeButtonBlue.y + this.themeButtonBlue.height) {
                    dispatchThemeChangeEvent('blue');
                    this.bgFirstColor = '#1e293b';
                    this.bgSecondColor = '#1b3F72';

                }
                if (clickX >= this.themeButtonPink.x && clickX <= this.themeButtonPink.x + this.themeButtonPink.width &&
                    clickY >= this.themeButtonPink.y && clickY <= this.themeButtonPink.y + this.themeButtonPink.height) {
                    dispatchThemeChangeEvent('pink');
                    this.bgFirstColor = '#4d2d3f';
                    this.bgSecondColor = '#804c64';
                }
                if (clickX >= this.themeButtonGreen.x && clickX <= this.themeButtonGreen.x + this.themeButtonGreen.height &&
                    clickY >= this.themeButtonGreen.y && clickY <= this.themeButtonGreen.y + this.themeButtonGreen.height) {
                    dispatchThemeChangeEvent('green');
                    this.bgFirstColor = '#2d4d26';
                    this.bgSecondColor = '#4a803d';
                }
                break;
        }
    }

    public update(dt: number): void {

        if (this.gameState === PongGameState.PAUSED) {
            this.draw();
            return;
        }

        switch(this.gameState) {
            case PongGameState.BOOTING: if (performance.now() - this.stateEntryTime > 6000) this.enterState('LOGO'); break;
            
            case PongGameState.LOGO: 
                if (performance.now() - this.stateEntryTime > this.LOGO_TOTAL_DURATION) {
                    this.enterState('DESKTOP');
                }
                break;
            case PongGameState.PLAYING:
                if (this.isFirstPlayingFrame) {
                    this.ball.dt = dt; this.runAIPrediction(); this.isFirstPlayingFrame = false;
                }
                this.updatePaddles(dt);
                if (this.aiMode) this.updateAI(dt);
                this.updateBall(dt);
                break;
            // case PongGameState.SO_LONG:
            //     this.soLongGame?.update();
            //     break;
        }
        if (this.gameState !== PongGameState.PLAYING_TRUTH_GIF) this.draw();
    }

    private draw(): void {
        this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        switch(this.gameState) {
            case PongGameState.OFF: this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height); break;
            case PongGameState.BOOTING: this.drawBootingScreen(); break;
            case PongGameState.DESKTOP: this.drawDesktop(); break;
            case PongGameState.LOGO: this.drawLogoScreen(); break;
            case PongGameState.TITLE: this.drawTitleScreen(); break;
            case PongGameState.PLAYING: this.drawGame(); break;
            case PongGameState.GAME_OVER: this.drawGameOverScreen(); break;
            case PongGameState.SHOWING_TRUTH_PROMPT: this.drawTruthPrompt(); break;
            case PongGameState.THEME_CHOOSER: this.drawThemeChooser(); break;
            case PongGameState.SO_LONG: this.soLongGame?.draw(); break;
            case PongGameState.PAUSED:
                this.drawGame();
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
                this.ctx.fillStyle = "white";
                this.ctx.font = "60px 'Press Start 2P'";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText("PAUSED", this.canvasSize.width / 2, this.canvasSize.height / 2);
                break;
        }
        if (this.gameState === PongGameState.DESKTOP || this.gameState === PongGameState.GAME_OVER || this.gameState === PongGameState.SHOWING_TRUTH_PROMPT) {
            this.drawCursor();
        }
        this.texture.update();
    }
    
    private drawTruthPrompt(): void {
        this.ctx.save();
        this.drawDesktop();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        const box = { x: 150, y: 200, width: 500, height: 250 };
        this.ctx.fillStyle = '#1b3F72';
        this.ctx.strokeStyle = '#4cb4e7';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(box.x, box.y, box.width, box.height);
        this.ctx.strokeRect(box.x, box.y, box.width, box.height);
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.font = "bold 18px 'Inter', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.wrapText("You are about to see how the coffee at 42 is REALLY made. Are you sure?", box.x + box.width / 2, box.y + 70, box.width - 40, 24);
        const button = this.truthConfirmButton;
        let isHovered = false;
        if (this.mousePosition) {
            isHovered = this.mousePosition.x >= button.x && this.mousePosition.x <= button.x + button.width && this.mousePosition.y >= button.y && this.mousePosition.y <= button.y + button.height;
        }
        this.ctx.fillStyle = isHovered ? 'rgba(76, 180, 231, 0.4)' : 'rgba(76, 180, 231, 0.2)';
        this.ctx.fillRect(button.x, button.y, button.width, button.height);
        this.ctx.strokeRect(button.x, button.y, button.width, button.height);
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.font = "24px 'Press Start 2P'";
        this.ctx.fillText("YES", button.x + button.width / 2, button.y + button.height / 2);
        this.ctx.restore();
    }

    private drawCursor(): void {
        this.ctx.save();
        if (this.mousePosition) {
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.moveTo(this.mousePosition.x, this.mousePosition.y);
            this.ctx.lineTo(this.mousePosition.x + 15, this.mousePosition.y + 20);
            this.ctx.lineTo(this.mousePosition.x, this.mousePosition.y + 25);
            this.ctx.closePath();
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    private drawBootingScreen(): void {
        this.ctx.save();
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = '16px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        const bootText = ["TRANSCENDENCE BIOS v1.0", "Initializing USB Controllers ... Done", "Memory Test: 640K OK", "", "Detecting Primary Master ... PONG_AI.SYS", "Detecting Primary Slave ... None", 
        "Detecting Secondary Master ... USER_INPUT.DLL", "Detecting Secondary Slave ... None", "", "Loading PS-DOS...", "HIMEM is testing extended memory...done.",
        "ERROR ERROR ERROR ERROR ERROR", "ERROR ERROR ERROR ERROR ERROR", "ERROR ERROR ERROR ERROR ERROR","ERROR ERROR ERROR ERROR ERROR", "HELP HELP HELP HELP", "HELP HELP HELP HELP", 
        "HELP HELP HELP HELP",  "HELP HELP HELP HELP", "[1]    12410 segmentation fault (core dumped)"];
        const elapsedTime = performance.now() - this.stateEntryTime;
        const linesToShow = Math.floor(elapsedTime / 250);
        for(let i = 0; i < linesToShow && i < bootText.length; i++) {
            this.ctx.fillText(bootText[i], 10, 10 + (i * 20));
        }
        if (elapsedTime % 1000 > 500) {
            this.ctx.fillText("_", 10, 10 + (Math.min(linesToShow, bootText.length) * 20));
        }
        this.ctx.restore();
    }

    private drawDesktop(): void {
        this.ctx.save();
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, this.bgFirstColor); bgGradient.addColorStop(0.5, this.bgSecondColor); bgGradient.addColorStop(1, this.bgFirstColor);
        this.ctx.fillStyle = bgGradient; this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.drawVerticalCRTLines();
        this.ctx.font = 'bold 32px "Inter", sans-serif';
        this.ctx.fillStyle = '#4cb4e7';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TRANSCENDENCE', this.canvasSize.width / 2, 40);
        let { width } = this.ctx.measureText('TRANSCENDENCE');
        const lineX = (this.canvasSize.width / 2) - (width / 2);
        this.ctx.fillRect(lineX, 10, width, 2);
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.font = 'bold 48px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("🏓", this.pongIcon.x + 40, this.pongIcon.y + 40);
        this.ctx.font = '14px "Inter"';
        this.ctx.fillText('PONG.exe', this.pongIcon.x + this.pongIcon.width / 2, this.pongIcon.y + 70);
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.font = 'bold 48px "Press Start 2P"';
        this.ctx.fillText("☕", this.truthIcon.x + 40, this.truthIcon.y + 40);
        this.ctx.font = '14px "Inter"';
        this.ctx.fillText('THE_TRUTH.gif', this.truthIcon.x + this.truthIcon.width / 2, this.truthIcon.y + 70);
        
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.font = 'bold 48px "Press Start 2P"';
        this.ctx.fillText("🚥", this.themeIcon.x + 40, this.themeIcon.y + 40);
        this.ctx.font = '14px "Inter"';
        this.ctx.fillText('COLOR.exe', this.themeIcon.x + this.themeIcon.width / 2, this.themeIcon.y + 60);

        this.ctx.font = 'bold 48px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("👾", this.soLongIcon.x + 40, this.soLongIcon.y + 40);
        this.ctx.font = '14px "Inter"';
        this.ctx.fillStyle = '#d6ecff';
        this.ctx.fillText('ZIZI.ber', this.soLongIcon.x + this.soLongIcon.width / 2, this.soLongIcon.y + 70);
        this.ctx.restore();
        
        this.ctx.restore();
        
    }

    private drawThemeChooser(): void {
        this.ctx.save();
        this.drawDesktop();
        
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);

        const box = { x: 200, y: 150, width: 400, height: 250 };
        this.ctx.fillStyle = '#1b3F72';
        this.ctx.strokeStyle = '#8be076';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(box.x, box.y, box.width, box.height);
        this.ctx.strokeRect(box.x, box.y, box.width, box.height);

        this.ctx.fillStyle = "#d6ecff";
        this.ctx.font = "bold 24px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Select a Theme", this.canvasSize.width / 2, box.y + 50);

        this.ctx.fillStyle = '#4cb4e7';
        this.ctx.fillRect(this.themeButtonBlue.x, this.themeButtonBlue.y, this.themeButtonBlue.width, this.themeButtonBlue.height);
        
        this.ctx.fillStyle = '#f8aab6';
        this.ctx.fillRect(this.themeButtonPink.x, this.themeButtonPink.y, this.themeButtonPink.width, this.themeButtonPink.height);
        
        this.ctx.fillStyle = '#8be076';
        this.ctx.fillRect(this.themeButtonGreen.x, this.themeButtonGreen.y, this.themeButtonGreen.width, this.themeButtonGreen.height);
        
        this.ctx.restore();
    }

    
    private drawGameOverScreen(): void {
        this.ctx.save();
        this.drawGame();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.ctx.font = "60px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "#d6ecff";
        this.ctx.fillText("GAME OVER", this.canvasSize.width / 2, this.canvasSize.height / 2 - 100);
        this.ctx.font = "40px 'Press Start 2P'";
        this.ctx.fillText(`${this.winner} Wins!`, this.canvasSize.width / 2, this.canvasSize.height / 2 - 20);
        const buttons = [ {...this.playAgainButton, text: "PLAY AGAIN"}, {...this.mainMenuButton, text: "MAIN MENU"} ];
        buttons.forEach(button => {
            let isHovered = false;
            if (this.mousePosition) {
                isHovered = this.mousePosition.x >= button.x && this.mousePosition.x <= button.x + button.width && this.mousePosition.y >= button.y && this.mousePosition.y <= button.y + button.height;
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
        this.ctx.restore();
    }

private drawLogoScreen(): void {
        this.ctx.save();

        this.ctx.fillStyle = '#1b3F72';
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);

        const elapsedTime = performance.now() - this.stateEntryTime;
        let alpha = 1.0;
        if (elapsedTime < this.LOGO_FADE_IN_TIME) {
            alpha = elapsedTime / this.LOGO_FADE_IN_TIME;
        } else if (elapsedTime > this.LOGO_FADE_IN_TIME + this.LOGO_STAY_TIME) {
            alpha = 1.0 - ((elapsedTime - (this.LOGO_FADE_IN_TIME + this.LOGO_STAY_TIME)) / this.LOGO_FADE_OUT_TIME);
        }
        this.ctx.globalAlpha = Math.max(0, alpha);

        const deepFryFilter = [ 'contrast(250%)', 'saturate(200%)', 'brightness(140%)', 'hue-rotate(15deg)' ].join(' ');
        this.ctx.filter = deepFryFilter;
        
        const logoText = "18H42";
        const x = this.canvasSize.width / 2;
        const y = this.canvasSize.height / 2 + 30;
        const glitchOffset = Math.random() * 6.0;

        this.ctx.font = 'bold 96px "Inter", sans-serif';
        this.ctx.textAlign = "center";
        this.ctx.globalCompositeOperation = 'lighter';

        this.ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
        this.ctx.fillText(logoText, x + glitchOffset, y);
        this.ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
        this.ctx.fillText(logoText, x, y - glitchOffset);
        this.ctx.fillStyle = "rgba(0, 0, 255, 0.9)";
        this.ctx.fillText(logoText, x - glitchOffset, y);
        
        // --- START: NEW Subtitle Logic ---

        // 1. Measure the width of the main logo text
        const logoWidth = this.ctx.measureText(logoText).width;

        // 2. Set the font and text for the subtitle
        this.ctx.globalCompositeOperation = 'source-over'; // Reset blend mode for subtitle
        this.ctx.fillStyle = "rgba(214, 236, 255, 0.8)"; // Bright subtitle color
        this.ctx.font = '20px "Inter", sans-serif';
        const subtitleText = "entertainment";

        // 3. Calculate and apply the required letter spacing
        const subtitleNaturalWidth = this.ctx.measureText(subtitleText).width;
        const requiredSpacing = logoWidth - subtitleNaturalWidth;
        if (requiredSpacing > 0 && subtitleText.length > 1) {
            this.ctx.letterSpacing = `${requiredSpacing / (subtitleText.length - 1)}px`;
        }

        // 4. Draw the subtitle, it will now be stretched to the correct width
        this.ctx.fillText(subtitleText, x + 10, y + 45);

        // --- END: NEW Subtitle Logic ---

        this.ctx.filter = 'none';

        for (let i = 0; i < this.canvasSize.height; i += 3) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(0, i, this.canvasSize.width, Math.random() > 0.5 ? 2 : 1);
        }

        if (Math.random() > 0.85) {
            const sliceHeight = Math.random() * 100 + 20;
            const sliceY = Math.random() * (this.canvasSize.height - sliceHeight);
            const sliceData = this.ctx.getImageData(0, sliceY, this.canvasSize.width, sliceHeight);
            this.ctx.putImageData(sliceData, (Math.random() - 0.5) * 40, sliceY);
        }

        this.ctx.restore();
    }

    private drawGame(): void {
        this.ctx.save();
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#001c3b"); bgGradient.addColorStop(0.5, "#234461"); bgGradient.addColorStop(1, "#001c3b");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.drawVerticalCRTLines(); this.drawMidline(); this.drawScore();
        this.drawPaddle(this.leftPaddle); this.drawPaddle(this.rightPaddle);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(this.ball.x, this.ball.y, this.ball.width, this.ball.height);
        this.ctx.restore();
    }

    private drawTitleScreen(): void {
        this.ctx.save();
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize.height);
        bgGradient.addColorStop(0, "#001c3b"); bgGradient.addColorStop(0.5, "#234461"); bgGradient.addColorStop(1, "#001c3b");
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
        this.ctx.restore();
    }

    private drawMidline(): void {
        const seg = {h: 20, g: 15, w: 4};
        const x = this.canvasSize.width / 2 - seg.w / 2;
        for (let y = 0; y < this.canvasSize.height; y += seg.h + seg.g) {
            this.ctx.fillStyle = "#d6ecff";
            this.ctx.fillRect(x, y, seg.w, seg.h);
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

    private roundRect(x: number, y: number, w: number, h: number, r: number): void {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
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
    
    private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
        const words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = this.ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                this.ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        this.ctx.fillText(line, x, y);
    }
    
    private resetGame(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        this.winner = null;
        this.resetPos();
    }

    public getScreenMesh(): BABYLON.Mesh {
        return this.screenMesh;
    }

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

    public startBootSequence(): void {
        this.enterState('BOOTING');
    }

    public stop(): void {
        if (this.aiUpdateInterval) {
            clearInterval(this.aiUpdateInterval);
            this.aiUpdateInterval = null;
        }
        // --- REACTION DELAY ---
        if (this.aiReactionTimeout) {
            clearTimeout(this.aiReactionTimeout);
            this.aiReactionTimeout = null;
        }
        this.soLongGame?.stop();
    }

    public handleInput(key: string, isPressed: boolean): void {

        // if (this.gameState === PongGameState.SO_LONG) {
        //     this.soLongGame?.handleInput(key, isPressed);
        //     return;
        // }
        
        if (this.gameState !== PongGameState.PLAYING && this.gameState !== PongGameState.TITLE) return;
        this.keysPressed[key] = isPressed;
        if (isPressed && key === 'Enter' && this.gameState === PongGameState.TITLE) {
            this.enterState('PLAYING');
        }
    }

    private runAIPrediction(): void {
        if (!this.aiMode || this.gameState !== PongGameState.PLAYING) return;
        
        // --- REACTION DELAY START ---
        if (this.aiReactionTimeout) clearTimeout(this.aiReactionTimeout);
        this.aiIsActing = false;
        // --- REACTION DELAY END ---

        if (this.ball.vx < 0) {
            this.ball.predictY = this.canvasSize.height / 2;
        } else {
            this.predictBallPosition();
        }
        this.ball.paddleCenter = Math.random() * this.rightPaddle.height;

        // --- REACTION DELAY START ---
        const baseDelay = this.aiReactionBaseDelay[this.aiDifficulty] || 120;
        const reactionDelay = baseDelay + Math.random() * 50;
        this.aiReactionTimeout = window.setTimeout(() => {
            this.aiIsActing = true;
        }, reactionDelay);
        // --- REACTION DELAY END ---
    }

    private updateAI(dt: number): void {
        // --- REACTION DELAY ---
        if (!this.aiIsActing) return;

        const paddleSpeed = 500 * dt;
        let aimZone = this.aiPrecision + this.aiPrecision * this.ball.bounce;
        let paddleCenter = this.rightPaddle.y + this.ball.paddleCenter;
        if (this.aiDifficulty === 3 && this.ball.vx < 0) return;
        if (this.ball.predictY >= paddleCenter - aimZone && this.ball.predictY <= paddleCenter + aimZone) return;
        if (this.ball.predictY <= paddleCenter && this.rightPaddle.y > 0) {
            this.rightPaddle.y -= paddleSpeed;
        }
        if (this.ball.predictY >= paddleCenter && this.rightPaddle.y + this.rightPaddle.height < this.canvasSize.height) {
            this.rightPaddle.y += paddleSpeed;
        }
    }

    private updatePaddles(dt: number): void {
        const paddleSpeed = 500 * dt;
        if (this.keysPressed['w'] && this.leftPaddle.y > 0) this.leftPaddle.y -= paddleSpeed;
        if (this.keysPressed['s'] && this.leftPaddle.y + this.leftPaddle.height < this.canvasSize.height) this.leftPaddle.y += paddleSpeed;
        this.leftPaddle.y = Math.max(0, Math.min(this.leftPaddle.y, this.canvasSize.height - this.leftPaddle.height));
        this.leftPaddle.dv = this.leftPaddle.y - this.leftPaddle.prevY;
        this.leftPaddle.prevY = this.leftPaddle.y;
        this.rightPaddle.y = Math.max(0, Math.min(this.rightPaddle.y, this.canvasSize.height - this.rightPaddle.height));
        this.rightPaddle.dv = this.rightPaddle.y - this.rightPaddle.prevY;
        this.rightPaddle.prevY = this.rightPaddle.y;
    }

    private createBall(): IBall {
        return { x: this.canvasSize.width / 2, y: this.canvasSize.height / 2, width: 10, height: 10, vx: 200 * (Math.random() > 0.5 ? 1 : -1), vy: (Math.random() > 0.5 ? 1 : -1) * 100, dt: 0, predictY: 0, hitZ: 0, paddleCenter: 1, bounce: 0, exchange: 0 };
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
            return ball.x < paddle.x + paddle.width && ball.x + ball.width > paddle.x && ball.y < paddle.y + paddle.height && ball.y + ball.height > paddle.y;
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
            ball.vx = ball.vx < 0 ? -350 : 350;
        }
        if (ball.vx < -500) {
            ball.vx = -500;
        } else if (ball.vx > 500) {
            ball.vx = 500;
        }
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
        if (ball.exchange > 5 && this.aiDifficulty < 3) {
            this.aiDifficulty++;
        }
    }

    private updateDifficulty(): void {
        const gap = this.rightScore - this.leftScore;
        if (gap <= 0 && this.aiDifficulty > 1) {
            this.aiDifficulty--;
        } else if (gap > 0 && this.aiDifficulty < 3) {
            this.aiDifficulty++;
        }
        this.aiPrecision = 10 + 15 * (this.aiDifficulty - 1);
    }
    
    private predictBallPosition(): void {
        let simX = this.ball.x;
        let simY = this.ball.y;
        let simDx = this.ball.vx * this.ball.dt;
        let simDy = this.ball.vy * this.ball.dt;
        this.ball.bounce = 0;
        while ((simDx > 0 && simX < this.rightPaddle.x) || (simDx < 0 && simX > this.rightPaddle.x)) {
            simX += simDx;
            simY += simDy;
            if (simY < 0 || simY > this.canvasSize.height) {
                simDy = -simDy;
                simY = Math.max(0, Math.min(this.canvasSize.height, simY));
                this.ball.bounce++;
            }
        }
        this.ball.predictY = simY;
    }

    public pause(): void {
        if (this.gameState === PongGameState.PLAYING) {
            this.stateBeforePause = this.gameState;
            this.gameState = PongGameState.PAUSED;
            if (this.aiUpdateInterval) {
                clearInterval(this.aiUpdateInterval);
                this.aiUpdateInterval = null;
            }
            if (this.aiReactionTimeout) {
                clearTimeout(this.aiReactionTimeout);
                this.aiReactionTimeout = null;
            }
        }
    }

    public resume(): void {
        if (this.gameState === PongGameState.PAUSED && this.stateBeforePause !== null) {
            this.gameState = this.stateBeforePause;
            this.stateBeforePause = null;
            this.isFirstPlayingFrame = true;
            if (this.aiMode && !this.aiUpdateInterval) {
                this.aiUpdateInterval = window.setInterval(() => this.runAIPrediction(), this.AI_RATE);
            }
        }
    }

    public isPaused(): boolean {
        return this.gameState === PongGameState.PAUSED;
    }
    
}