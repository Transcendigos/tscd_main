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

    // Position of the computer chair for interaction
    private computerPosition = new BABYLON.Vector3(0, 1, 3.6);
    private interactionRadius = 2.5; // How close the player needs to be to interact

    constructor(scene: BABYLON.Scene, playerController: PlayerController, pongGame: Pong3D) {
        this.scene = scene;
        this.playerController = playerController;
        this.pongGame = pongGame;

        this.setupInputListeners();
    }

    private setupInputListeners(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            // Handle state switching with 'e' key
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'e') {
                if (this.currentState === GameState.EXPLORING) {
                    if (this.isPlayerNearComputer()) {
                        this.sitDown();
                    }
                } else {
                    this.standUp();
                }
            }

            // Route game controls based on state
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

        // Disable player movement and hide the crosshair
        this.playerController.disable();
        document.exitPointerLock();

        // Move camera to a fixed "sitting" position, looking at the screen
        const camera = this.playerController.camera;
        const sittingPosition = new BABYLON.Vector3(0, 1.4, 3.7);
        const screenTarget = new BABYLON.Vector3(0, 1.4, 5.05);
        
        // Use an animation for a smooth transition
        BABYLON.Animation.CreateAndStartAnimation(
            "sitDownAnim",
            camera,
            "position",
            60, // animation speed
            30, // frame count
            camera.position,
            sittingPosition,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // Also animate the camera target
        const currentTarget = camera.getTarget();
        const targetAnimation = new BABYLON.Animation(
            "sitDownTargetAnim", "target", 60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        targetAnimation.setKeys([
            { frame: 0, value: currentTarget },
            { frame: 30, value: screenTarget }
        ]);
        camera.animations.push(targetAnimation);
        this.scene.beginAnimation(camera, 0, 30, false);
    }

    private standUp(): void {
        this.currentState = GameState.EXPLORING;
        
        // Re-enable player movement controls
        this.playerController.enable();
    }
}