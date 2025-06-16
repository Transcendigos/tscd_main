import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";

export class Environment {
    private scene: BABYLON.Scene;
    private shadowGenerator: BABYLON.ShadowGenerator;
    public ambientLights: BABYLON.Light[] = [];
    public spotLight: BABYLON.SpotLight;
    public backWall: BABYLON.Mesh;
    public frontWall: BABYLON.Mesh;


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
        this.spotLight = new BABYLON.SpotLight("spotLight", new BABYLON.Vector3(0, 6, 5.4), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 1, this.scene);
        this.spotLight.intensity = 2000;
        this.spotLight.shadowEnabled = true;

        // const small = new BABYLON.PointLight("small", new BABYLON.Vector3(0, 2, 3.8), this.scene);
        // small.range = 0.5;
        // small.intensity = 0.1;

        const spotLightHeight = 8;
        const pointLightHeight = 2.5;

        const initialIntensity = 0;
        const positions = [
            { x: 6, z: 6 },   // Front-right
            { x: -6, z: 6 },  // Front-left
            { x: -6, z: -6 }, // Back-left
            { x: 6, z: -6 },  // Back-right
            { x: 0, z: 0 }    // Center
        ];

        // --- Create SpotLights with their own height ---
        const spotLightAngle = Math.PI / 1.5;
        const spotLightExponent = 2;
        const lightDirection = new BABYLON.Vector3(0, -1, 0);
        positions.forEach((pos, i) => {
            const spotLight = new BABYLON.SpotLight(
                `cornerSpotLight_${i}`, 
                new BABYLON.Vector3(pos.x, spotLightHeight, pos.z), 
                lightDirection, 
                spotLightAngle, 
                spotLightExponent, 
                this.scene
            );
            spotLight.intensity = initialIntensity;
            spotLight.diffuse = new BABYLON.Color3(100, 100, 100);
            this.ambientLights.push(spotLight);
        });

        // --- Create PointLights with their own, lower height ---
        const pointLightRange = 15;
        positions.forEach((pos, i) => {
            const pointLight = new BABYLON.PointLight(
                `cornerPointLight_${i}`,
                new BABYLON.Vector3(pos.x, pointLightHeight, pos.z),
                this.scene
            );
            pointLight.intensity = initialIntensity;
            pointLight.range = pointLightRange;
            pointLight.diffuse = new BABYLON.Color3(3, 3, 3);
            this.ambientLights.push(pointLight);
        });
        
        return this.spotLight;
    }

    private createOffice(): void {
        const wallThickness = 1;
        const wallHeight = 4;
        const roomWidth = 20;
        const roomDepth = 50;

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

        this.frontWall = createWall("wallFront", roomWidth, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, roomDepth / 2));
        this.backWall = createWall("wallBack", roomWidth, wallHeight, wallThickness, new BABYLON.Vector3(0, wallHeight / 2, -roomDepth / 2));
        createWall("wallLeft", wallThickness, wallHeight, roomDepth, new BABYLON.Vector3(-roomWidth / 2, wallHeight / 2, 0));
        createWall("wallRight", wallThickness, wallHeight, roomDepth, new BABYLON.Vector3(roomWidth / 2, wallHeight / 2, 0));

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: roomWidth, height: roomDepth }, this.scene);
        ground.checkCollisions = true;
        ground.receiveShadows = true;
        const groundMaterial = new BABYLON.PBRMaterial("groundPBRMat", this.scene);
        groundMaterial.albedoTexture = new BABYLON.Texture("/assets/textures/carpets/carpet2/carpet02.jpg", this.scene);
        groundMaterial.ambientTexture = new BABYLON.Texture("/assets/textures/carpets/carpet2/carpet02AO.jpg", this.scene);
        (groundMaterial.albedoTexture as BABYLON.Texture).uScale = 4;
        (groundMaterial.albedoTexture as BABYLON.Texture).vScale = 10;
        (groundMaterial.ambientTexture as BABYLON.Texture).uScale = 4;
        (groundMaterial.ambientTexture as BABYLON.Texture).vScale = 10;
        groundMaterial.metallic = 0.0;
        groundMaterial.roughness = 1;
        ground.material = groundMaterial;

        const ceiling = BABYLON.MeshBuilder.CreateGround("ceiling", { width: roomWidth, height: roomDepth }, this.scene);
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
                (tex as BABYLON.Texture).vScale = 10;
            }
        });
        ceilingMaterial.metallic = 0.0;
        ceilingMaterial.roughness = 1;
        ceiling.material = ceilingMaterial;
    }

    public async loadModelsAndGetScreenMesh(): Promise<BABYLON.Mesh> {
    const [
        computerAsset,
        deskAsset,
        chairAsset,
        coffeeDeskAsset,
        plantAsset,
        recorderBlueAsset,
        clockAsset,
        waterAsset,
        recorderOrangeAsset,
        drawerAsset,
        drawerAsset2
    ] = await Promise.all([
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "computerFixed.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "desk.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "orangeChair.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "coffeeDesk.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officePlant.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeRecorderBlue.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeClock.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeWater.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeRecorderOrange.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeDrawerB.glb", this.scene),
        BABYLON.SceneLoader.ImportMeshAsync(null, "/assets/meshes/", "officeDrawerA.glb", this.scene),
    ]);

    const computerRoot = computerAsset.meshes[0];
    computerRoot.position = new BABYLON.Vector3(0, 1.55, 5.2);
    computerRoot.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
    computerRoot.rotation = new BABYLON.Vector3(0, Math.PI, 0);

    const screenMesh = computerRoot.getChildMeshes(false, (node) => node.name === "CRT_Monitor_monitor_glass_0")[0];
    if (!screenMesh) {
        throw new Error("Could not find screen mesh in the computer model.");
    }
    
    deskAsset.meshes[0].position = new BABYLON.Vector3(0, 0, 4.9);
    deskAsset.meshes[0].scaling = new BABYLON.Vector3(0.006, 0.006, 0.006);
    deskAsset.meshes[0].rotation = new BABYLON.Vector3(0, Math.PI, 0);

    const chairAssetRoot = chairAsset.meshes[0];
    chairAssetRoot.position = new BABYLON.Vector3(0, 0.4, 3.6);
    chairAssetRoot.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
    chairAssetRoot.rotation = new BABYLON.Vector3(0, 0, 0);

    const coffeeDeskRoot = coffeeDeskAsset.meshes[0];
    coffeeDeskRoot.position = new BABYLON.Vector3(8.8, 0, 3.6);
    coffeeDeskRoot.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

    const clockRoot = clockAsset.meshes[0];
    clockRoot.position = new BABYLON.Vector3(0, -1.5, 9.4);
    clockRoot.scaling = new BABYLON.Vector3(2, 2, 2);

    const waterRoot = waterAsset.meshes[0];
    waterRoot.position = new BABYLON.Vector3(-8.8, 0, 3.6);
    waterRoot.rotation = new BABYLON.Vector3(0, -Math.PI /2, 0);

    const originalPlantRoot = plantAsset.meshes[0];
    const plant1 = originalPlantRoot.clone("plant_clone_1", null);
    plant1.position = new BABYLON.Vector3(2.2, 0.2, 8.9);
    originalPlantRoot.setEnabled(false);

    const originalRecorderBlueRoot = recorderBlueAsset.meshes[0];
    const recorderBlue1 = originalRecorderBlueRoot.clone("recorderBlue_clone_1", null);
    recorderBlue1.position = new BABYLON.Vector3(1.4, 0.09, 8.8);
    recorderBlue1.rotation = new BABYLON.Vector3(0, Math.PI * 2, 0);
    originalRecorderBlueRoot.setEnabled(false);

    const originalRecorderOrangeRoot = recorderOrangeAsset.meshes[0];
    const recorderOrange1 = originalRecorderOrangeRoot.clone("recorderOrange_clone_1", null);
    recorderOrange1.position = new BABYLON.Vector3(-1.4, 0, 8.8);
    recorderOrange1.rotation = new BABYLON.Vector3(0, Math.PI * 2, 0);
    originalRecorderOrangeRoot.setEnabled(false);
    
    const originalDrawerRoot = drawerAsset.meshes[0];
    const drawer1 = originalDrawerRoot.clone("drawer_clone_1", null);
    const drawer2 = originalDrawerRoot.clone("drawer_clone_2", null);
    const drawer3 = originalDrawerRoot.clone("drawer_clone_3", null);
    drawer1.position = new BABYLON.Vector3(-9, 0, 8);
    drawer2.position = new BABYLON.Vector3(-9, 0, 7);
    drawer3.position = new BABYLON.Vector3(-0.5, 0, 9);
    drawer1.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
    drawer2.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
    drawer3.rotation = new BABYLON.Vector3(0, -Math.PI * 2, 0);
    originalDrawerRoot.setEnabled(false);


    const originalDrawer2Root = drawerAsset2.meshes[0];
    const drawer4 = originalDrawer2Root.clone("drawer_clone_4", null);
    drawer4.position = new BABYLON.Vector3(0.4, 0, 9);
    drawer4.rotation = new BABYLON.Vector3(0, -Math.PI * 2, 0);
    originalDrawer2Root.setEnabled(false);
    
    const allAssets = [
        computerAsset, deskAsset, chairAsset, coffeeDeskAsset, clockAsset, waterAsset,
        plantAsset, recorderBlueAsset, recorderOrangeAsset, drawerAsset
    ];

    allAssets.forEach(asset => {
        asset.meshes.forEach(mesh => this.shadowGenerator.addShadowCaster(mesh, true));
    });

    return screenMesh as BABYLON.Mesh;
}
}

        // const plant1 = templates.plant.createInstance("plant1");
        // plant1.scaling = new BABYLON.Vector3(10,10,10);

        // const officePlantAssetRoot = officePlantAsset.meshes[0];
        // officePlantAssetRoot.position = new BABYLON.Vector3(2.2, 0.2, 8.9);

                // officePropsAssetRoot.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);