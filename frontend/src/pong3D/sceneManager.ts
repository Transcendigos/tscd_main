import * as BABYLON from '@babylonjs/core';
import { PlayerController } from './playerController';
import { Environment } from './environment';
import { Pong3D } from './pong3D';
import { InteractionManager, GameState } from './interactionManager';
import { startWebcamFeed } from '../webcam'; // Import startWebcamFeed
import "@babylonjs/inspector";

export class SceneManager {
    public engine: BABYLON.Engine;
    public scene: BABYLON.Scene;
    public webcamStream: MediaStream | null = null; // Property to hold the stream
    
    private playerController: PlayerController;
    private environment: Environment;
    private pongGame: Pong3D;
    private interactionManager: InteractionManager;
    private lastFrameTime: number = 0;

    private readonly debugMode: boolean = false;

    private constructor(private canvas: HTMLCanvasElement) {
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
    }

    public static async create(canvas: HTMLCanvasElement): Promise<SceneManager> {
        const manager = new SceneManager(canvas);
        manager.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        manager.scene.collisionsEnabled = true;

        try {
            // We use dummy element IDs because we don't need to display the feed here.
            manager.webcamStream = await startWebcamFeed('dummy-video', 'dummy-error');
            if (manager.webcamStream) {
                console.log("Webcam access granted at game launch.");
            } else {
                console.warn("Webcam access denied or unavailable at game launch.");
            }
        } catch (error) {
            console.error("Error initializing webcam:", error);
        }
        // --- End Webcam Logic ---

        manager.environment = new Environment(manager.scene);
        
        const screenMesh = await manager.environment.loadModelsAndGetScreenMesh();

        manager.playerController = new PlayerController(manager.scene, canvas, manager.debugMode);
        
        manager.pongGame = new Pong3D(manager.scene, screenMesh);
        // Pass the webcam stream to the InteractionManager
        manager.interactionManager = new InteractionManager(manager.scene, manager.playerController, manager.pongGame, manager.environment, manager.webcamStream);
        
        manager.playerController.enable();

        if (manager.debugMode) {
            manager.scene.environmentIntensity = 1;
            
            manager.scene.debugLayer.show({
                embedMode: false,
            }).then(() => {
                const sceneExplorerHost = document.getElementById("scene-explorer-host");
                const inspectorHost = document.getElementById("inspector-host");

                if (sceneExplorerHost) {
                    sceneExplorerHost.style.zIndex = "1000";
                    sceneExplorerHost.style.position = "fixed";
                }
                if (inspectorHost) {
                    inspectorHost.style.zIndex = "1000";
                    inspectorHost.style.position = "fixed";
                }
            });
        }


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
            this.interactionManager.update();
            
            
            if (this.interactionManager.currentState === GameState.PLAYING_PONG) {
                this.pongGame.update(deltaTime);
            }

            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    public dispose(): void {
        console.log("Disposing SceneManager and its components.");
        this.scene.onBeforeRenderObservable.clear();

        if (this.interactionManager) {
            this.interactionManager.dispose();
        }
        if (this.pongGame) {
            this.pongGame.stop();
        }
        if (this.playerController) {
            this.playerController.disable();
        }
        
        this.engine.dispose();
    }
}