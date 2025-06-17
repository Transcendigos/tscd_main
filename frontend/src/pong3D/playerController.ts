import * as BABYLON from '@babylonjs/core';

export class PlayerController {
    public camera: BABYLON.UniversalCamera;
    private scene: BABYLON.Scene;
    private canvas: HTMLCanvasElement;

    private readonly playerSpeed = 1.5;
    private readonly playerHeight = 1.7;
    private readonly playerAngularSensibility = 2500;

    constructor(scene: BABYLON.Scene, canvas: HTMLCanvasElement, debugMode: boolean = false) {
        this.scene = scene;
        this.canvas = canvas;
        
        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, this.playerHeight, -24), this.scene);
        this.setupCamera(debugMode);
        // this.setupPointerLock();
    }

    private setupCamera(debugMode: boolean): void {
        this.camera.keysUp = [87];    // W
        this.camera.keysDown = [83];  // S
        this.camera.keysLeft = [65];  // A
        this.camera.keysRight = [68]; // D

        this.camera.speed = debugMode ? this.playerSpeed * 3 : this.playerSpeed;
        this.camera.checkCollisions = !debugMode;
        this.camera.applyGravity = !debugMode;
        

        if (!debugMode) {
            this.camera.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
        }

        this.camera.inertia = 0.1;
        this.camera.angularSensibility = this.playerAngularSensibility;
    }

    public enable(): void {
        this.camera.attachControl(this.canvas, true);
    }

    public disable(): void {
        this.camera.detachControl(this.canvas);
    }

    private setupPointerLock(): void {
        this.canvas.addEventListener("click", () => {
            this.canvas.requestPointerLock();
        });
    }

    public update(): void {
        if (this.camera.position.y < this.playerHeight) {
        }
    }
}