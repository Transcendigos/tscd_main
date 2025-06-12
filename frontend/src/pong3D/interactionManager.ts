import * as BABYLON from '@babylonjs/core';
import { PlayerController } from './playerController';
import { Pong3D } from './pong3D';

export enum GameState {
    EXPLORING,
    PLAYING_PONG
}

export class InteractionManager {
    public currentState: GameState = GameState.EXPLORING;
    private scene: BABYLON.Scene;
    private playerController: PlayerController;
    private pongGame: Pong3D;

    private computerPosition = new BABYLON.Vector3(0, 1.4, 3.6);
    private interactionRadius = 2.5;

    private originalFov: number;
    // FOV is now exactly 30 degrees, converted to radians
    private sittingFov = BABYLON.Tools.ToRadians(30);

    private crtPipeline: BABYLON.DefaultRenderingPipeline | null = null;

    constructor(scene: BABYLON.Scene, playerController: PlayerController, pongGame: Pong3D) {
        this.scene = scene;
        this.playerController = playerController;
        this.pongGame = pongGame;

        this.originalFov = this.playerController.camera.fov;

        this.setupInputListeners();
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
                if (kbInfo.event.key === 'w' || kbInfo.event.key === 's') {
                    this.pongGame.handleInput(kbInfo.event.key, kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN);
                }
            }
        });
    }

    private isPlayerNearComputer(): boolean {
        const playerPosition = this.playerController.camera.position;
        return BABYLON.Vector3.Distance(playerPosition, this.computerPosition) <= this.interactionRadius;
    }

    private sitDown(): void {
        this.currentState = GameState.PLAYING_PONG;
        this.playerController.disable();
        
        const camera = this.playerController.camera;

        // --- Using the EXACT values from your original implementation ---
        const sittingPosition = new BABYLON.Vector3(0, 1.7, 3.7);
        const screenTarget = new BABYLON.Vector3(0, 1.56, 5.05);

        // Set position, target, and FOV
        camera.position = sittingPosition;
        camera.setTarget(screenTarget);
        camera.fov = this.sittingFov;

        this.enableCRTEffect();
    }

    private standUp(): void {
        this.currentState = GameState.EXPLORING;
        const camera = this.playerController.camera;

        camera.fov = this.originalFov;
        
        camera.rotation = new BABYLON.Vector3(0, camera.rotation.y, 0);
        camera.cameraRotation.x = 0;

        this.playerController.enable();
        
        this.disableCRTEffect();
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