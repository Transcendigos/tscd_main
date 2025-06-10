import * as BABYLON from '@babylonjs/core';
import { PlayerController } from './playerController';
import { Environment } from './environment';
import { Pong3D } from './pong3D';
import { InteractionManager, GameState } from './interactionManager';

export class SceneManager {
    public engine: BABYLON.Engine;
    public scene: BABYLON.Scene;
    
    private playerController: PlayerController;
    private environment: Environment;
    private pongGame: Pong3D;
    private interactionManager: InteractionManager;
    private lastFrameTime: number = 0;

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.scene.collisionsEnabled = true;

        this.environment = new Environment(this.scene);
        this.playerController = new PlayerController(this.scene, this.canvas);
        this.pongGame = new Pong3D(this.scene, this.environment.screen);
        
        // Initialize the interaction manager, passing it the components it needs to control
        this.interactionManager = new InteractionManager(this.scene, this.playerController, this.pongGame);

        this.playerController.enable();

        this.lastFrameTime = performance.now();
        this.run();
    }

    private run(): void {
        this.engine.runRenderLoop(() => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            this.playerController.update();
            
            // The interactionManager now decides if the pong game should be updated
            if (this.interactionManager.currentState === GameState.PLAYING_PONG) {
                this.pongGame.update(deltaTime);
            }

            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }
}