import * as BABYLON from '@babylonjs/core';
import { PlayerController } from './playerController';
import { Pong3D } from './pong3D';
import { Environment } from './environment';
import { takePicture, startWebcamFeed } from '../webcam'; // Import takePicture and startWebcamFeed

export enum GameState {
    EXPLORING,
    PLAYING_PONG
}

export class InteractionManager {
    public currentState: GameState = GameState.EXPLORING;
    private scene: BABYLON.Scene;
    private playerController: PlayerController;
    private pongGame: Pong3D;
    private environment: Environment;

    private computerPosition = new BABYLON.Vector3(0, 1.4, 3.6);
    private interactionRadius = 2.5;

    private originalFov: number;
    private sittingFov = BABYLON.Tools.ToRadians(30);

    private crtPipeline: BABYLON.DefaultRenderingPipeline | null = null;
    private hasPlayedIntro: boolean = false;
    private hasBootedOnce: boolean = false;

    private webcamStream: MediaStream | null;

    constructor(scene: BABYLON.Scene, playerController: PlayerController, pongGame: Pong3D, environment: Environment, webcamStream: MediaStream | null) {
        this.scene = scene;
        this.playerController = playerController;
        this.pongGame = pongGame;
        this.environment = environment;
        this.webcamStream = webcamStream;
        this.originalFov = this.playerController.camera.fov;

        // Set up the callback for when the player wins
        this.pongGame.onPlayerWin = this.triggerVictoryPhoto.bind(this);

        this.setupInputListeners();
        this.setupPointerObservable();
        
        this.scene.getEngine().getRenderingCanvas()?.addEventListener("click", () => {
            if (this.currentState === GameState.EXPLORING) {
                this.playerController.lockPointer();
            }
        });
    }

    // --- NEW METHOD TO HANDLE VICTORY PHOTO ---
    private async triggerVictoryPhoto(): Promise<void> {
        console.log("Player won! Triggering victory photo...");

        if (!this.webcamStream || this.webcamStream.getTracks().every(track => track.readyState === 'ended')) {
            console.log("Webcam stream is missing or ended. Requesting a new one.");
            try {
                 this.webcamStream = await startWebcamFeed('dummy-video', 'dummy-error');
                 if (!this.webcamStream) {
                     console.error("Could not re-acquire webcam for victory photo.");
                     return;
                 }
            } catch (error) {
                console.error("Error re-acquiring webcam stream:", error);
                return;
            }
        }
        
        try {
            const pictureDataUrl = await takePicture(this.webcamStream);
            this.environment.updateEmployeeOfMonthPicture(pictureDataUrl);
            console.log("Employee of the Month photo updated!");
        } catch (error) {
            console.error("Failed to take or display victory photo:", error);
        }
    }

    private sitDown(): void {
        this.currentState = GameState.PLAYING_PONG;
        this.playerController.unlockPointer();
        this.playerController.disable();
        
        if (!this.hasBootedOnce) {
            this.pongGame.startBootSequence();
            this.hasBootedOnce = true;
        } else {
            this.pongGame.enterState('DESKTOP');
        }

        const camera = this.playerController.camera;
        const sittingPosition = new BABYLON.Vector3(0, 1.7, 3.7);
        const screenTarget = new BABYLON.Vector3(-0.4, 1.56, 5.05);

        camera.position = sittingPosition;
        camera.setTarget(screenTarget);
        camera.fov = this.sittingFov;

        this.enableCRTEffect();

        if (!this.hasPlayedIntro) {
            this.animateBackWall(true);
            this.animateFrontWall(true);
            setTimeout(() => {
                this.animateLights(true);
            }, 1000);
            this.hasPlayedIntro = true;
        }
    }

    private setupPointerObservable(): void {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (this.currentState !== GameState.PLAYING_PONG) return;
            
            const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.pongGame.getScreenMesh());

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (pickResult && pickResult.hit && pickResult.getTextureCoordinates) {
                    const uv = pickResult.getTextureCoordinates();
                    if (uv) this.pongGame.updateMousePosition(uv);
                } else {
                    this.pongGame.updateMousePosition(null);
                }
            }

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (pickResult && pickResult.hit && pickResult.getTextureCoordinates) {
                    const uv = pickResult.getTextureCoordinates();
                    if (uv) this.pongGame.handleClick(uv);
                }
            }
        });
    }

    private setupInputListeners(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'e') {
                if (this.currentState === GameState.EXPLORING && this.isPlayerNearComputer()) {
                    this.sitDown();
                } else if (this.currentState === GameState.PLAYING_PONG) {
                    this.standUp();
                }
            }
            if (this.currentState === GameState.PLAYING_PONG) {
                this.pongGame.handleInput(kbInfo.event.key, kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN);
            }
        });
    }

    private isPlayerNearComputer(): boolean {
        const playerPosition = this.playerController.camera.position;
        return BABYLON.Vector3.Distance(playerPosition, this.computerPosition) <= this.interactionRadius;
    }

    private standUp(): void {
        this.currentState = GameState.EXPLORING;
        this.playerController.lockPointer();
        const camera = this.playerController.camera;
        camera.fov = this.originalFov;
        camera.rotation = new BABYLON.Vector3(0, camera.rotation.y, 0);
        camera.cameraRotation.x = 0;
        this.playerController.enable();
        this.disableCRTEffect();
        this.pongGame.updateMousePosition(null);
    }
    
    private animateLights(fadeIn: boolean): void {
        const frameRate = 30;
        const duration = 10;
        const ambientAnim = new BABYLON.Animation("ambientLightIntensityAnim", "intensity", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        ambientAnim.setKeys([{ frame: 0, value: fadeIn ? 0 : 5 }, { frame: frameRate * duration, value: fadeIn ? 5 : 0 }]);
        const spotAnim = new BABYLON.Animation("spotLightIntensityAnim", "intensity", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        spotAnim.setKeys([{ frame: 0, value: fadeIn ? 2000 : 50 }, { frame: frameRate * duration, value: fadeIn ? 50 : 2000 }]);
        this.environment.ambientLights.forEach(light => {
            light.animations = [ambientAnim.clone()];
            this.scene.beginAnimation(light, 0, frameRate * duration, false);
        });
        this.environment.spotLight.animations = [spotAnim];
        this.scene.beginAnimation(this.environment.spotLight, 0, frameRate * duration, false);
    }

    private animateBackWall(moveIn: boolean): void {
        const frameRate = 30;
        const duration = 0.1;
        const wallAnim = new BABYLON.Animation("wallMoveAnimation", "position.z", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const originalZ = -25;
        const targetZ = -10;
        const keys = [{ frame: 0, value: moveIn ? originalZ : targetZ }, { frame: frameRate * duration, value: moveIn ? targetZ : originalZ }];
        wallAnim.setKeys(keys);
        this.environment.backWall.animations.push(wallAnim);
        this.scene.beginAnimation(this.environment.backWall, 0, frameRate * duration, false);
    }

    private animateFrontWall(moveIn: boolean): void {
        const frameRate = 30;
        const duration = 0.1;
        const wallAnim = new BABYLON.Animation("frontWallMoveAnimation", "position.z", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const originalZ = 25;
        const targetZ = 10;
        wallAnim.setKeys([{ frame: 0, value: moveIn ? originalZ : targetZ }, { frame: frameRate * duration, value: moveIn ? targetZ : originalZ }]);
        this.environment.frontWall.animations = [];
        this.environment.frontWall.animations.push(wallAnim);
        this.scene.beginAnimation(this.environment.frontWall, 0, frameRate * duration, false);
    }

    private enableCRTEffect(): void {
        if (this.crtPipeline) this.crtPipeline.dispose();
        this.crtPipeline = new BABYLON.DefaultRenderingPipeline("crtPipeline", true, this.scene, [this.playerController.camera]);
        this.crtPipeline.chromaticAberrationEnabled = true;
        this.crtPipeline.chromaticAberration.aberrationAmount = 8;
        this.crtPipeline.grainEnabled = true;
        this.crtPipeline.grain.intensity = 10;
    }

    private disableCRTEffect(): void {
        if (this.crtPipeline) {
            this.crtPipeline.dispose();
            this.crtPipeline = null;
        }
    }
}