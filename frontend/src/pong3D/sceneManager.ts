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

    private constructor(private canvas: HTMLCanvasElement) {
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
    }

    public static async create(canvas: HTMLCanvasElement): Promise<SceneManager> {
        const manager = new SceneManager(canvas);
        manager.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        manager.scene.collisionsEnabled = true;

        manager.environment = new Environment(manager.scene);
        
        const screenMesh = await manager.environment.loadModelsAndGetScreenMesh();

        manager.playerController = new PlayerController(manager.scene, canvas);
        manager.pongGame = new Pong3D(manager.scene, screenMesh);
        manager.interactionManager = new InteractionManager(manager.scene, manager.playerController, manager.pongGame);
        
        manager.playerController.enable();

        manager.lastFrameTime = performance.now();
        manager.run();
        
        return manager;
    }

    private run(): void {
        this.engine.runRenderLoop(() => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            this.playerController.update();
            
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