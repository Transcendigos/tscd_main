import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";

export class Environment {
    private scene: BABYLON.Scene;
    private shadowGenerator: BABYLON.ShadowGenerator;

    private walls: BABYLON.Mesh[] = [];
    private ceiling: BABYLON.Mesh;
    private pointLights: BABYLON.PointLight[] = [];
    private spotLight: BABYLON.SpotLight;
    
    private hasRevealed = false;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;

        const mainLight = this.createLights();
        this.shadowGenerator = new BABYLON.ShadowGenerator(1024, mainLight);
        
        this.createOffice();
        this.createEnvironment();
        this.loadModelsAndGetScreenMesh();
    }

    private createEnvironment(): void {
        const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("/assets/textures/environment.dds", this.scene);
        this.scene.environmentTexture = envTexture;
        this.scene.createDefaultSkybox(envTexture, true, 1000, 0.3);

        // Start with no ambient light for the dark "void" effect
        this.scene.environmentIntensity = 0;
    }

    private createLights(): BABYLON.IShadowLight {
        // This spotlight illuminates the distant desk
        this.spotLight = new BABYLON.SpotLight("spotLight", new BABYLON.Vector3(0, 10, 18), new BABYLON.Vector3(0, -0.8, -1), Math.PI / 10, 20, this.scene);
        this.spotLight.intensity = 5000;

        // Room lights start with zero intensity
        const small = new BABYLON.PointLight("small", new BABYLON.Vector3(0, 2, 3.8), this.scene);
        small.range = 0.5;
        small.intensity = 0;

        const bulb = new BABYLON.PointLight("bulb", new BABYLON.Vector3(4, 1.5, -4), this.scene);
        bulb.range = 60;
        bulb.intensity = 0;

        const bulb2 = new BABYLON.PointLight("bulb2", new BABYLON.Vector3(-4, 1.5, 4), this.scene);
        bulb2.range = 60;
        bulb2.intensity = 0;
        
        this.pointLights.push(small, bulb, bulb2);
        return this.spotLight;
    }

    private createOffice(): void {
        const wallThickness = 1;
        const wallHeight = 4;
        const groundSize = 20;
        const initialScale = 100;

        const wallMaterial = new BABYLON.PBRMaterial("wallPBRMaterial", this.scene);
        // ... (Your wall material setup)
        
        const createWall = (name: string, w: number, h: number, d: number, pos: BABYLON.Vector3) => {
            const wall = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
            wall.position = pos;
            wall.scaling.setAll(initialScale);
            wall.checkCollisions = false; // Collisions off until reveal
            wall.material = wallMaterial;
            this.walls.push(wall);
        };

        createWall("wallFront", groundSize, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, groundSize / 2));
        createWall("wallBack", groundSize, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, -groundSize / 2));
        createWall("wallLeft", wallThickness, wallHeight, groundSize, new BABYLON.Vector3(-groundSize / 2, wallHeight / 2, 0));
        createWall("wallRight", wallThickness, wallHeight, groundSize, new BABYLON.Vector3(groundSize / 2, wallHeight / 2, 0));

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
        ground.checkCollisions = true;
        ground.receiveShadows = true;
        // ... (Your ground material setup)

        this.ceiling = BABYLON.MeshBuilder.CreateGround("ceiling", { width: 20, height: 20 }, this.scene);
        this.ceiling.position.y = wallHeight;
        this.ceiling.rotation.x = Math.PI;
        this.ceiling.scaling.setAll(initialScale); // Also scale the ceiling
        this.ceiling.checkCollisions = false;
        // ... (Your ceiling material setup)
    }

    public async loadModelsAndGetScreenMesh(): Promise<BABYLON.Mesh> {
        const deskGroupZ = 15; // Set desk further away initially

        const computerAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "computerFixed.glb", this.scene);
        const deskAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "desk.glb", this.scene);
        const chairAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "orangeChair.glb", this.scene);

        [...computerAsset.meshes, ...deskAsset.meshes, ...chairAsset.meshes].forEach(mesh => {
            this.shadowGenerator.addShadowCaster(mesh, true);
        });

        computerAsset.meshes[0].position = new BABYLON.Vector3(0, 1.55, deskGroupZ + 0.2);
        deskAsset.meshes[0].position = new BABYLON.Vector3(0, 0, deskGroupZ);
        chairAsset.meshes[0].position = new BABYLON.Vector3(0, 0.5, deskGroupZ - 1.4);
        
        // ... (Your other model properties)

        const screenMesh = computerAsset.meshes.find(m => m.name === "CRT_Monitor_monitor_glass_0");
        if (!screenMesh) throw new Error("Could not find screen mesh.");
        
        return screenMesh as BABYLON.Mesh;
    }

    public triggerRevealAnimation(): void {
        if (this.hasRevealed) return;
        this.hasRevealed = true;

        const frameRate = 30;
        const animDuration = frameRate * 3;

        const scaleAnim = new BABYLON.Animation("scaleAnim", "scaling", frameRate, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
        scaleAnim.setKeys([
            { frame: 0, value: new BABYLON.Vector3(100, 100, 100) },
            { frame: animDuration, value: new BABYLON.Vector3(1, 1, 1) }
        ]);

        const lightAnim = new BABYLON.Animation("lightIntensityAnim", "intensity", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT);
        lightAnim.setKeys([ { frame: 0, value: 0 }, { frame: animDuration, value: 150 } ]);

        const envAnim = new BABYLON.Animation("envIntensityAnim", "environmentIntensity", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT);
        envAnim.setKeys([ { frame: 0, value: 0 }, { frame: animDuration, value: 0.7 } ]);

        [...this.walls, this.ceiling].forEach(mesh => {
            mesh.animations.push(scaleAnim.clone());
            this.scene.beginAnimation(mesh, 0, animDuration, false, 1, () => {
                mesh.checkCollisions = true;
            });
        });

        this.pointLights.forEach(light => {
            light.animations.push(lightAnim.clone());
            this.scene.beginAnimation(light, 0, animDuration, false);
        });

        this.scene.animations.push(envAnim);
        this.scene.beginAnimation(this.scene, 0, animDuration, false);
    }
}