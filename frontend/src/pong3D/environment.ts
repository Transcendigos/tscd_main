import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";

export class Environment {
    private scene: BABYLON.Scene;
    private shadowGenerator: BABYLON.ShadowGenerator;

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
        
        this.scene.environmentIntensity = 0;

        this.scene.environmentTexture = envTexture;
        this.scene.createDefaultSkybox(envTexture, true, 100, 0.3);
    }

    private createLights(): BABYLON.IShadowLight {
        // **LIGHTING FIX 2: Increase direct light intensity.**
        // PBR materials require much higher intensity values for lights to look bright.
        const spotLight = new BABYLON.SpotLight("spotLight", new BABYLON.Vector3(0, 6, 5.4), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 1, this.scene);
        spotLight.intensity = 1000; // Increased from 2

        const small = new BABYLON.PointLight("small", new BABYLON.Vector3(0, 2, 3.8), this.scene);
        small.range = 0.5;
        small.intensity = 0.1; // Increased from 0.2

        const bulb = new BABYLON.PointLight("bulb", new BABYLON.Vector3(4, 1.5, -4), this.scene);
        bulb.intensity = 0; // Increased from 2
        bulb.range = 60;
        bulb.diffuse = new BABYLON.Color3(0.4, 0.4, 0.4);

        const bulb2 = new BABYLON.PointLight("bulb2", new BABYLON.Vector3(-4, 1.5, 4), this.scene);
        bulb2.intensity = 0; // Increased from 2
        bulb2.range = 60;
        bulb2.diffuse = new BABYLON.Color3(0.4, 0.4, 0.4);
        
        return spotLight;
    }

    private createOffice(): void {
        const wallThickness = 1;
        const wallHeight = 4;
        const groundSize = 20;

        const wallMaterial = new BABYLON.PBRMaterial("wallPBRMaterial", this.scene);
        wallMaterial.albedoTexture = new BABYLON.Texture("/assets/textures/wall/wallpaper/wallpaper.jpg", this.scene);
        wallMaterial.bumpTexture = new BABYLON.Texture("/assets/textures/wall/wallpaper/wallpaperNormal.jpg", this.scene);
        wallMaterial.useRoughnessFromMetallicTextureGreen = true;
        wallMaterial.metallicTexture = new BABYLON.Texture("/assets/textures/wall/wallpaper/wallpaperRoughness.jpg", this.scene);
        wallMaterial.metallic = 0.0;
        wallMaterial.roughness = 1.0;
        [wallMaterial.albedoTexture, wallMaterial.bumpTexture, wallMaterial.metallicTexture].forEach(tex => {
            if (tex) {
                (tex as BABYLON.Texture).uScale = 6;
                (tex as BABYLON.Texture).vScale = 6;
            }
        });

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

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
        ground.checkCollisions = true;
        // **LIGHTING FIX 3: Enable the ground to receive shadows.**
        ground.receiveShadows = true;
        const groundMaterial = new BABYLON.PBRMaterial("groundPBRMat", this.scene);
        groundMaterial.albedoTexture = new BABYLON.Texture("/assets/textures/carpets/carpet2/carpet02.jpg", this.scene);
        groundMaterial.ambientTexture = new BABYLON.Texture("/assets/textures/carpets/carpet2/carpet02AO.jpg", this.scene);
        (groundMaterial.albedoTexture as BABYLON.Texture).uScale = 4;
        (groundMaterial.albedoTexture as BABYLON.Texture).vScale = 4;
        (groundMaterial.ambientTexture as BABYLON.Texture).uScale = 4;
        (groundMaterial.ambientTexture as BABYLON.Texture).vScale = 4;
        groundMaterial.metallic = 0.0;
        groundMaterial.roughness = 0.8;
        ground.material = groundMaterial;

        const ceiling = BABYLON.MeshBuilder.CreateGround("ceiling", { width: 20, height: 20 }, this.scene);
        ceiling.position.y = wallHeight;
        ceiling.rotation.x = Math.PI;
        ceiling.checkCollisions = true;
        const ceilingMaterial = new BABYLON.PBRMaterial("ceilingPBRMat", this.scene);
        ceilingMaterial.albedoTexture = new BABYLON.Texture("/assets/textures/ceiling/OfficeCeiling001_1K-PNG_Color.png", this.scene);
        ceilingMaterial.ambientTexture = new BABYLON.Texture("/assets/textures/ceiling/OfficeCeiling001_1K-PNG_AmbientOcclusion.png", this.scene);
        ceilingMaterial.bumpTexture = new BABYLON.Texture("/assets/textures/ceiling/OfficeCeiling001_1K-PNG_NormalGL.png", this.scene);
        [ceilingMaterial.albedoTexture, ceilingMaterial.ambientTexture, ceilingMaterial.bumpTexture].forEach(tex => {
            if(tex) {
                (tex as BABYLON.Texture).uScale = 4;
                (tex as BABYLON.Texture).vScale = 4;
            }
        });
        ceilingMaterial.metallic = 0.0;
        ceilingMaterial.roughness = 0.8;
        ceiling.material = ceilingMaterial;
    }

    public async loadModelsAndGetScreenMesh(): Promise<BABYLON.Mesh> {
        const computerAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "computerFixed.glb", this.scene);
        const deskAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "desk.glb", this.scene);
        const chairAsset = await BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "orangeChair.glb", this.scene);

        // **LIGHTING FIX 4: Make the models cast shadows.**
        [...computerAsset.meshes, ...deskAsset.meshes, ...chairAsset.meshes].forEach(mesh => {
            this.shadowGenerator.addShadowCaster(mesh, true);
        });

        const computerRoot = computerAsset.meshes[0];
        computerRoot.position = new BABYLON.Vector3(0, 1.55, 5.2);
        computerRoot.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        computerRoot.rotation = new BABYLON.Vector3(0, Math.PI, 0);

        const screenMesh = computerRoot.getChildMeshes(false, (node) => node.name === "CRT_Monitor_monitor_glass_0")[0];
        if (!screenMesh) {
            throw new Error("Could not find screen mesh in the computer model.");
        }
        
        deskAsset.meshes[0].position = new BABYLON.Vector3(0, 0, 5.1);
        deskAsset.meshes[0].scaling = new BABYLON.Vector3(0.006, 0.006, 0.006);
        deskAsset.meshes[0].rotation = new BABYLON.Vector3(0, Math.PI, 0);

        const chairAssetRoot = chairAsset.meshes[0];
        chairAssetRoot.position = new BABYLON.Vector3(0, 0.5, 3.6);
        chairAssetRoot.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
        chairAssetRoot.rotation = new BABYLON.Vector3(0, 0, 0);

        return screenMesh as BABYLON.Mesh;
    }
}