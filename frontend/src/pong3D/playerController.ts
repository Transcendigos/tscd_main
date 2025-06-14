import * as BABYLON from '@babylonjs/core';

export class PlayerController {
    public camera: BABYLON.UniversalCamera;
    private scene: BABYLON.Scene;
    private canvas: HTMLCanvasElement;

    // Player properties
    private readonly playerSpeed = 1.5;
    private readonly playerHeight = 1.7;
    private readonly playerAngularSensibility = 2500;

    constructor(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.canvas = canvas;
        
        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, this.playerHeight, -7), this.scene);
        this.setupCamera();
        this.setupPointerLock();
    }

    private setupCamera(): void {
        // Standard WASD controls
        this.camera.keysUp = [87];    // W
        this.camera.keysDown = [83];  // S
        this.camera.keysLeft = [65];  // A
        this.camera.keysRight = [68]; // D

        // Physics properties for collision
        this.camera.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
        this.camera.checkCollisions = true;
        this.camera.applyGravity = true; // Works with the scene's gravity setting

        // Movement settings
        this.camera.speed = this.playerSpeed;
        this.camera.inertia = 0.1;
        this.camera.angularSensibility = this.playerAngularSensibility;
    }

    /**
     * Attaches the camera controls to the canvas and enables pointer lock on click.
     */
    public enable(): void {
        this.camera.attachControl(this.canvas, true);
    }

    /**
     * Detaches the camera controls from the canvas.
     */
    public disable(): void {
        this.camera.detachControl(this.canvas);
    }

    /**
     * Sets up the pointer lock functionality for the camera.
     */
    private setupPointerLock(): void {
        this.canvas.addEventListener("click", () => {
            this.canvas.requestPointerLock();
        });
    }

    /**
     * A method to be called in the main render loop for per-frame updates.
     */
    public update(): void {
        // Lock the player's height to prevent flying when gravity is not aggressive enough
        // You might adjust or remove this depending on your final gravity and collision setup
        if (this.camera.position.y < this.playerHeight) {
           // this.camera.position.y = this.playerHeight;
        }
    }
}