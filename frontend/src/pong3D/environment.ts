import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";

export class Environment {
    private scene: BABYLON.Scene;
    public screen: BABYLON.Mesh;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;

        this.createLights();
        this.createOffice();
        this.screen = this.createComputerScreen(); // Create the screen and store it
        this.loadModels();
    }

    private createLights(): void {
        new BABYLON.SpotLight("spotLight", new BABYLON.Vector3(0, 6, 5.4), new BABYLON.Vector3(0, -1, 0), Math.PI / 5, 1, this.scene);
        const small = new BABYLON.PointLight("small", new BABYLON.Vector3(0, 2, 3.8), this.scene);
        small.range = 0.5;
        small.intensity = 0.2;

        const bulb = new BABYLON.PointLight("bulb", new BABYLON.Vector3(4, 1.5, -4), this.scene);
        bulb.intensity = 2;
        bulb.range = 60;
        bulb.diffuse = new BABYLON.Color3(0.4, 0.4, 0.4);

        const bulb2 = new BABYLON.PointLight("bulb2", new BABYLON.Vector3(-4, 1.5, 4), this.scene);
        bulb2.intensity = 2;
        bulb2.range = 60;
        bulb2.diffuse = new BABYLON.Color3(0.4, 0.4, 0.4);
    }

    private createOffice(): void {
        const wallThickness = 1;
        const wallHeight = 4;
        const groundSize = 20;

        // --- Walls ---
        const wallMaterial = new BABYLON.StandardMaterial("wallMaterial", this.scene);
        wallMaterial.diffuseTexture = new BABYLON.Texture("/assets/textures/wall/wallpaper/wallpaper.jpg", this.scene);
        (wallMaterial.diffuseTexture as BABYLON.Texture).uScale = 6;
        (wallMaterial.diffuseTexture as BABYLON.Texture).vScale = 6;
        wallMaterial.specularColor = new BABYLON.Color3(0.01, 0.01, 0.01);

        const createWall = (name: string, w: number, h: number, d: number, pos: BABYLON.Vector3) => {
            const wall = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
            wall.position = pos;
            wall.checkCollisions = true;
            wall.material = wallMaterial;
            return wall;
        };

        createWall("wallFront", groundSize, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, groundSize / 2));
        createWall("wallBack", groundSize, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, -groundSize / 2));
        createWall("wallLeft", wallThickness, wallHeight, groundSize, new BABYLON.Vector3(-groundSize / 2, wallHeight / 2, 0));
        createWall("wallRight", wallThickness, wallHeight, groundSize, new BABYLON.Vector3(groundSize / 2, wallHeight / 2, 0));

        // --- Ground ---
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
        ground.checkCollisions = true;
        const groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseTexture = new BABYLON.Texture("/assets/textures/carpets/carpet2/carpet02.jpg", this.scene);
        (groundMaterial.diffuseTexture as BABYLON.Texture).uScale = 4;
        (groundMaterial.diffuseTexture as BABYLON.Texture).vScale = 4;
        groundMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        ground.material = groundMaterial;

        // --- Ceiling ---
        const ceiling = BABYLON.MeshBuilder.CreateGround("ceiling", { width: 20, height: 20 }, this.scene);
        ceiling.position.y = wallHeight;
        ceiling.rotation.x = Math.PI;
        ceiling.checkCollisions = true;
        // Add ceiling material if needed
    }
    
    private createComputerScreen(): BABYLON.Mesh {
        const screen = BABYLON.MeshBuilder.CreatePlane("computerScreen", { width: 0.8, height: 0.6 }, this.scene);
        screen.position = new BABYLON.Vector3(0, 1.56, 5.05);
        
        const screenMat = new BABYLON.StandardMaterial("screenMat", this.scene);
        screenMat.emissiveColor = new BABYLON.Color3(1, 1, 1); // Make it glow
        screenMat.specularColor = new BABYLON.Color3(0, 0, 0);
        screen.material = screenMat;
        
        return screen;
    }

    private async loadModels(): Promise<void> {
        // --- Computer and Desk ---
        const computerAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "computerFixed.glb", this.scene);
        const computer = computerAsset.meshes[0];
        computer.position = new BABYLON.Vector3(0, 0, 5.2);
        computer.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        computer.rotation = new BABYLON.Vector3(0, Math.PI, 0);

        // Find the actual screen mesh within the loaded model and disable it, as we created our own plane.
        const originalScreenMesh = computer.getChildMeshes(false, (node) => node.name === "CRT_Monitor_monitor_glass_0")[0];
        if (originalScreenMesh) {
            originalScreenMesh.isVisible = false;
        }

        // --- Chair ---
        const chairAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "orangeChair.glb", this.scene);
        const chair = chairAsset.meshes[0];
        chair.position = new BABYLON.Vector3(0, 0.5, 3.6);
        chair.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
    }
}