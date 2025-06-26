import { ASSET_PATHS, IExplosion, IInvader, IMap, IPlayer, IProjectile } from "./types";

export class SoLongGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    
    private readonly TILE_SIZE = 32;
    private readonly PLAYER_SPEED = 4;
    private readonly INVADER_SPEED = 3;
    private readonly PROJECTILE_SPEED = 10;
    private readonly SHOOT_COOLDOWN = 200;
    private readonly EXPLOSION_DURATION = 500;
    private readonly INVADER_RESPAWN_TIME = 5000;
    private readonly PLAYER_INVINCIBILITY_TIME = 1000;
    private readonly HITBOX_INSET = 2;

    private assets: { [key: string]: HTMLImageElement } = {};
    private keysPressed: { [key: string]: boolean } = {};

    private map: IMap | null = null;
    private player: IPlayer | null = null;
    private invaders: IInvader[] = [];
    private projectiles: IProjectile[] = [];
    private explosions: IExplosion[] = [];
    private visualMap: (HTMLImageElement | null)[][] = [];
    private isExitOpen: boolean = false;
    public onGameOver: () => void = () => {};
    private animationFrameId: number | null = null;
    private isRunning: boolean = false;

    private originalCanvasWidth: number;
    private originalCanvasHeight: number;

    private gameState: 'PLAYING' | 'WON' | 'LOST' = 'PLAYING';
    private winMoves: number = 0;
    private playAgainButton = { x: 0, y: 0, width: 0, height: 0 };
    private mainMenuButton = { x: 0, y: 0, width: 0, height: 0 };
    private mousePosition: { x: number, y: number } | null = null;

    constructor(canvas: HTMLCanvasElement, onGameOverCallback: () => void) {
        this.canvas = canvas;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get 2D context");
        this.ctx = ctx;
        this.onGameOver = onGameOverCallback;

        this.originalCanvasWidth = this.canvas.width;
        this.originalCanvasHeight = this.canvas.height;
    }

    public async start(): Promise<void> {
        this.isRunning = true;
        await this.loadAssets();
        this.initializeGame();
        this.setupInputHandlers();
        this.gameLoop();
    }

    public stop(): void {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.width = this.originalCanvasWidth;
        this.canvas.height = this.originalCanvasHeight;
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        this.keysPressed[e.key.toLowerCase()] = true;
    }
    private handleKeyUp = (e: KeyboardEvent): void => {
        this.keysPressed[e.key.toLowerCase()] = false;
    }

    private setupInputHandlers(): void {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    
    public updateMousePosition(uv: { x: number, y: number } | null): void {
        if (uv) {
            this.mousePosition = {
                x: uv.x * this.canvas.width,
                y: (1 - uv.y) * this.canvas.height
            };
        } else {
            this.mousePosition = null;
        }
    }

    private loadAssets(): Promise<void> {
        const assetPromises: Promise<void>[] = [];
        for (const key in ASSET_PATHS) {
            const path = ASSET_PATHS[key as keyof typeof ASSET_PATHS];
            const promise = new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.src = path;
                img.onload = () => { this.assets[key] = img; resolve(); };
                img.onerror = () => reject(new Error(`Failed to load asset: ${key} at ${path}`));
            });
            assetPromises.push(promise);
        }
        return Promise.all(assetPromises).then(() => {});
    }

    private initializeGame(): void {
        this.gameState = 'PLAYING';
        this.isExitOpen = false;
        const mapData = [
            "1111111111111111111111111111111111111111111",
            "1000000000100000001000000000C000000000000011",
            "100000000000000000E0000000000000000111000011",
            "10000011100000000000100000001000000000000011",
            "10000000000000000000000000000000000000000011",
            "101000000000000000M0000001000000M000000011111",
            "10000000000000000000000000000000000000000011",
            "100000C0000000000000100000000000000000000011",
            "100000111000000000000000000000000000000C0011",
            "10000000000001110000000000C00001110000000011",
            "1000000000000000000000000000000000C000000011",
            "10000000000000C00000111100000000011100100011",
            "10001110000000000000000000000000000000000011",
            "10P00000000000000000000000000000000000000011",
            "100000111111100000M0000000000000001100100011",
            "1000000000000000000000C000000000000000000011",
            "10000000000000000000111111000000000000000011",
            "1000000C000000000000000000000000000000000011",
            "1111111111111111111111111111111111111111111"
        ];
        this.parseMap(mapData);
        this.generateVisualMap();
        this.canvas.width = this.map!.width * this.TILE_SIZE;
        this.canvas.height = (this.map!.height + 1) * this.TILE_SIZE;
    }
    
    private parseMap(mapData: string[]): void {
        const height = mapData.length;
        const width = mapData[0].length;
        const grid = mapData.map(row => row.split(''));
        let collectibleCount = 0;
        this.invaders = [];
        this.projectiles = [];
        this.explosions = [];
        this.map = { grid, width, height, exit: { x: 0, y: 0 }, totalCollectibles: 0 };
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = grid[y][x];
                if (char === 'P') {
                    this.player = { x: x * this.TILE_SIZE, y: y * this.TILE_SIZE, hp: 3, collectibles: 0, moves: 0, direction: 'DOWN', lastHit: 0, lastShoot: 0 };
                } else if (char === 'M') {
                    const invaderSpriteKey = `INVADER${this.pseudoRand(x, y, 3) > 0 ? this.pseudoRand(x, y, 3) : ''}`;
                    this.invaders.push({ x: x * this.TILE_SIZE, y: y * this.TILE_SIZE, spawnX: x, spawnY: y, alive: true, lastDeath: 0, direction: 'DOWN', spriteKey: invaderSpriteKey, aiCooldown: 0, collided: false });
                } else if (char === 'E') {
                    this.map.exit = { x, y };
                } else if (char === 'C') {
                    collectibleCount++;
                }
            }
        }
        this.map.totalCollectibles = collectibleCount;
    }

    private generateVisualMap(): void {
        if (!this.map) return;
        this.visualMap = [];
        for (let y = 0; y < this.map.height; y++) {
            const row: (HTMLImageElement | null)[] = [];
            for (let x = 0; x < this.map.width; x++) {
                const char = this.map.grid[y][x];
                let sprite: HTMLImageElement | null = null;
                switch (char) {
                    case '1':
                        sprite = this.assets[`WALL${this.pseudoRand(x, y, 9) + 1}`];
                        break;
                    case '0': case 'P':
                        const backVariant = this.pseudoRand(x, y, 47);
                        sprite = (backVariant <= 9) ? this.assets[`BACK${backVariant + 1}`] : this.assets['BACK_N'];
                        break;
                    case 'C':
                        const collectVariant = this.pseudoRand(x, y, 9);
                        sprite = this.assets[`COLLECT${collectVariant > 0 ? collectVariant : ''}`] || this.assets['COLLECT'];
                        break;
                    case 'E': case 'M':
                        sprite = this.assets['INVADER_SPAWN'];
                        break;
                }
                row.push(sprite);
            }
            this.visualMap.push(row);
        }
    }

    private pseudoRand(x: number, y: number, range: number): number {
        if (!this.map) return 0;
        let seed = x * 4286 + y * this.map.width + this.map.height;
        seed ^= (seed << 21);
        seed ^= (seed >> 35);
        seed ^= (seed << 4);
        return (seed & 0x7FFFFFFF) % range;
    }

    private gameLoop = (): void => {
        this.update();
        this.draw();
        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }

    private update(): void {
        if (this.gameState !== 'PLAYING') return;
        if (!this.player) return;
        this.handlePlayerInput();
        this.updateProjectiles();
        this.updateInvaders();
        this.checkCollisions();
        const now = Date.now();
        this.explosions = this.explosions.filter(exp => now < exp.endTime);
    }

    private handlePlayerInput(): void {
        if (!this.player) return;

        if (this.keysPressed[' ']) {
            this.shoot();
        }

        let intentX = 0;
        let intentY = 0;
        if (this.keysPressed['w']) intentY -= 1;
        if (this.keysPressed['s']) intentY += 1;
        if (this.keysPressed['a']) intentX -= 1;
        if (this.keysPressed['d']) intentX += 1;

        if (intentX === 0 && intentY === 0) {
            return;
        }

        this.updatePlayerDirection(intentX, intentY);
        
        let moveX = intentX * this.PLAYER_SPEED;
        let moveY = intentY * this.PLAYER_SPEED;
        
        if (moveX !== 0 && moveY !== 0) {
            moveX /= Math.sqrt(2);
            moveY /= Math.sqrt(2);
        }
        
        const originalX = this.player.x;
        const originalY = this.player.y;
        
        this.player.x += moveX;
        if (this.checkWallCollisionForPlayer()) {
            this.player.x = originalX;
        }

        this.player.y += moveY;
        if (this.checkWallCollisionForPlayer()) {
            this.player.y = originalY;
        }

        if (this.player.x !== originalX || this.player.y !== originalY) {
            this.player.moves++;
        }
    }

    private updatePlayerDirection(dx: number, dy: number): void {
        if (!this.player) return;
        if (dx > 0 && dy === 0) this.player.direction = 'RIGHT';
        else if (dx < 0 && dy === 0) this.player.direction = 'LEFT';
        else if (dy > 0 && dx === 0) this.player.direction = 'DOWN';
        else if (dy < 0 && dx === 0) this.player.direction = 'UP';
        else if (dx > 0 && dy > 0) this.player.direction = 'DDR';
        else if (dx < 0 && dy > 0) this.player.direction = 'DDL';
        else if (dx > 0 && dy < 0) this.player.direction = 'DUR';
        else if (dx < 0 && dy < 0) this.player.direction = 'DUL';
    }

    private checkWallCollisionForPlayer(): boolean {
        if (!this.player) return false;
        const p = this.player;
        const inset = this.HITBOX_INSET;
        const size = this.TILE_SIZE;
        const corners = [
            { x: p.x + inset, y: p.y + inset },
            { x: p.x + size - inset, y: p.y + inset },
            { x: p.x + inset, y: p.y + size - inset },
            { x: p.x + size - inset, y: p.y + size - inset }
        ];
        for (const corner of corners) {
            if (this.isWallAt(corner.x, corner.y)) {
                return true;
            }
        }
        return false;
    }

    private isWallAt(x: number, y: number): boolean {
        if (!this.map) return true;
        const tileX = Math.floor(x / this.TILE_SIZE);
        const tileY = Math.floor(y / this.TILE_SIZE);
        if (!this.map.grid[tileY] || !this.map.grid[tileY][tileX]) {
            return true;
        }
        return this.map.grid[tileY][tileX] === '1';
    }

    private shoot(): void {
        if (!this.player) return;
        const now = Date.now();
        if (now < this.player.lastShoot + this.SHOOT_COOLDOWN) return;

        this.player.lastShoot = now;
        let vx = 0;
        let vy = 0;
        const speed = this.PROJECTILE_SPEED;

        switch(this.player.direction) {
            case 'UP':    vy = -speed; break;
            case 'DOWN':  vy = speed; break;
            case 'LEFT':  vx = -speed; break;
            case 'RIGHT': vx = speed; break;
            case 'DUL':   vx = -speed / Math.sqrt(2); vy = -speed / Math.sqrt(2); break;
            case 'DUR':   vx = speed / Math.sqrt(2);  vy = -speed / Math.sqrt(2); break;
            case 'DDL':   vx = -speed / Math.sqrt(2); vy = speed / Math.sqrt(2); break;
            case 'DDR':   vx = speed / Math.sqrt(2);  vy = speed / Math.sqrt(2); break;
        }
        if (vx === 0 && vy === 0) return;

        const projectile: IProjectile = {
            x: this.player.x + this.TILE_SIZE / 2,
            y: this.player.y + this.TILE_SIZE / 2,
            vx: vx,
            vy: vy,
            rotation: Math.atan2(vy, vx)
        };
        this.projectiles.push(projectile);
    }
    
    private updateProjectiles(): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (this.isWallAt(p.x, p.y) || p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) {
                this.projectiles.splice(i, 1);
                continue;
            }

            for (const invader of this.invaders) {
                if (invader.alive) {
                    const iLeft = invader.x, iRight = invader.x + this.TILE_SIZE;
                    const iTop = invader.y, iBottom = invader.y + this.TILE_SIZE;
                    if (p.x > iLeft && p.x < iRight && p.y > iTop && p.y < iBottom) {
                        this.killInvader(invader);
                        this.projectiles.splice(i, 1);
                        break; 
                    }
                }
            }
        }
    }

    private killInvader(invader: IInvader): void {
        if (!invader.alive) return;
        invader.alive = false;
        invader.lastDeath = Date.now();
        this.explosions.push({ x: invader.x, y: invader.y, endTime: Date.now() + this.EXPLOSION_DURATION });
    }

    private updateInvaders(): void {
        const now = Date.now();
        this.invaders.forEach(invader => {
            if (!invader.alive && now > invader.lastDeath + this.INVADER_RESPAWN_TIME) {
                invader.x = invader.spawnX * this.TILE_SIZE;
                invader.y = invader.spawnY * this.TILE_SIZE;
                invader.alive = true;
            }
            if (!invader.alive) return;

            if (now > invader.aiCooldown + 1000 || invader.collided) {
                const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
                invader.direction = directions[Math.floor(Math.random() * directions.length)];
                invader.aiCooldown = now;
                invader.collided = false;
            }
            this.handleInvaderMovement(invader);
        });
    }

    private handleInvaderMovement(invader: IInvader): void {
        let dx = 0, dy = 0;
        switch (invader.direction) {
            case 'UP': dy = -1; break;
            case 'DOWN': dy = 1; break;
            case 'LEFT': dx = -1; break;
            case 'RIGHT': dx = 1; break;
        }

        const nextX = invader.x + dx * this.INVADER_SPEED;
        const nextY = invader.y + dy * this.INVADER_SPEED;
        
        const left = nextX + this.HITBOX_INSET;
        const right = nextX + this.TILE_SIZE - this.HITBOX_INSET;
        const top = nextY + this.HITBOX_INSET;
        const bottom = nextY + this.TILE_SIZE - this.HITBOX_INSET;

        if (!this.isWallAt(left, top) && !this.isWallAt(right, top) && !this.isWallAt(left, bottom) && !this.isWallAt(right, bottom)) {
            invader.x = nextX;
            invader.y = nextY;
        } else {
            invader.collided = true;
        }
    }
    
    private checkCollisions(): void {
        if (!this.player || !this.map) return;
        const now = Date.now();
        const playerTileX = Math.floor((this.player.x + this.TILE_SIZE / 2) / this.TILE_SIZE);
        const playerTileY = Math.floor((this.player.y + this.TILE_SIZE / 2) / this.TILE_SIZE);

        for (const invader of this.invaders) {
            if (invader.alive && now > this.player.lastHit + this.PLAYER_INVINCIBILITY_TIME) {
                const pLeft = this.player.x + this.HITBOX_INSET;
                const pRight = this.player.x + this.TILE_SIZE - this.HITBOX_INSET;
                const pTop = this.player.y + this.HITBOX_INSET;
                const pBottom = this.player.y + this.TILE_SIZE - this.HITBOX_INSET;

                const iLeft = invader.x + this.HITBOX_INSET;
                const iRight = invader.x + this.TILE_SIZE - this.HITBOX_INSET;
                const iTop = invader.y + this.HITBOX_INSET;
                const iBottom = invader.y + this.TILE_SIZE - this.HITBOX_INSET;

                if (pLeft < iRight && pRight > iLeft && pTop < iBottom && pBottom > iTop) {
                    this.player.hp--;
                    this.player.lastHit = now;
                    if (this.player.hp <= 0) {
                        this.gameState = 'LOST';
                        return;
                    }
                }
            }
        }

        if (this.map.grid[playerTileY] && this.map.grid[playerTileY][playerTileX] === 'C') {
            this.player.collectibles++;
            this.map.grid[playerTileY][playerTileX] = '0';
            const terraVariant = this.pseudoRand(playerTileX, playerTileY, 5);
            this.visualMap[playerTileY][playerTileX] = this.assets[`TERRA${terraVariant > 0 ? terraVariant : ''}`] || this.assets['TERRA'];
        }

        if (this.player.collectibles === this.map.totalCollectibles) {
            if (!this.isExitOpen) {
                this.visualMap[this.map.exit.y][this.map.exit.x] = this.assets['EXIT'];
                this.isExitOpen = true;
            }
            if (playerTileX === this.map.exit.x && playerTileY === this.map.exit.y) {
                this.gameState = 'WON';
                this.winMoves = this.player.moves;
            }
        }
    }
    
    public draw(): void {
        if (!this.ctx || !this.map || this.visualMap.length === 0) return;
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const sprite = this.visualMap[y][x];
                if (sprite) {
                    this.ctx.drawImage(sprite, x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
                }
            }
        }
        
        this.projectiles.forEach(p => {
            const sprite = this.assets['LASER'];
            if (sprite) {
                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                this.ctx.restore();
            }
        });

        this.invaders.forEach(invader => {
            if (invader.alive) {
                const invaderSprite = this.assets[invader.spriteKey] || this.assets['INVADER'];
                if (invaderSprite) {
                    this.ctx.drawImage(invaderSprite, invader.x, invader.y, this.TILE_SIZE, this.TILE_SIZE);
                }
            }
        });
        
        this.explosions.forEach(exp => {
            const variant = Math.floor(Math.random() * 4);
            const key = `BOOM${variant > 0 ? variant : ''}`;
            const sprite = this.assets[key] || this.assets['BOOM'];
            if (sprite) {
                this.ctx.drawImage(sprite, exp.x, exp.y, this.TILE_SIZE, this.TILE_SIZE);
            }
        });

        if (this.player) {
            const playerSpriteKey = `SHIP_${this.player.direction}`; 
            const playerSprite = this.assets[playerSpriteKey];
            if (playerSprite) {
                this.ctx.drawImage(playerSprite, this.player.x, this.player.y, this.TILE_SIZE, this.TILE_SIZE);
            }
        }
        this.drawHUD();

        if (this.gameState === 'WON' || this.gameState === 'LOST') {
            this.drawGameOverScreen();
        }

        this.ctx.restore();
    }

    private drawHUD(): void {
        if (!this.player || !this.map) return;
        const hudY = this.map.height * this.TILE_SIZE;
        
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, hudY, this.canvas.width, this.TILE_SIZE);

        const hpIcon = this.assets['SHIP_UP'];
        if (hpIcon) {
            for (let i = 0; i < this.player.hp; i++) {
                this.ctx.drawImage(hpIcon, i * this.TILE_SIZE, hudY, this.TILE_SIZE, this.TILE_SIZE);
            }
        }
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px "Press Start 2P", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        const movesText = `Moves: ${this.player.moves}`;
        this.ctx.fillText(movesText, 4 * this.TILE_SIZE, hudY + this.TILE_SIZE / 2);

        const collectText = `Planets: ${this.player.collectibles} / ${this.map.totalCollectibles}`;
        this.ctx.fillText(collectText, 10 * this.TILE_SIZE, hudY + this.TILE_SIZE / 2);
    }

    private drawGameOverScreen(): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;

        // Semi-transparent black overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);

        // Main Title Text
        this.ctx.font = "60px 'Press Start 2P'";
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = "#d6ecff";
        const titleText = this.gameState === 'WON' ? 'YOU WIN!' : 'GAME OVER';
        this.ctx.fillText(titleText, centerX, height / 2 - 100);

        // Subtitle Text for Win State
        if (this.gameState === 'WON') {
            this.ctx.font = "40px 'Press Start 2P'";
            this.ctx.fillText(`Moves: ${this.winMoves}`, centerX, height / 2 - 20);
        }

        // Buttons
        const buttonWidth = 280;
        const buttonHeight = 50;
        const playAgainY = height / 2 + 80;
        const mainMenuY = playAgainY + buttonHeight + 20;

        this.playAgainButton = { x: centerX - buttonWidth / 2, y: playAgainY, width: buttonWidth, height: buttonHeight };
        this.mainMenuButton = { x: centerX - buttonWidth / 2, y: mainMenuY, width: buttonWidth, height: buttonHeight };

        const buttonsToDraw = [
            { ...this.playAgainButton, text: 'Play Again' },
            { ...this.mainMenuButton, text: 'Main Menu' }
        ];

        buttonsToDraw.forEach(button => {
            // Hover Logic
            let isHovered = false;
            if (this.mousePosition) {
                isHovered = this.mousePosition.x >= button.x && this.mousePosition.x <= button.x + button.width &&
                            this.mousePosition.y >= button.y && this.mousePosition.y <= button.y + button.height;
            }

            // Button Drawing
            this.ctx.strokeStyle = '#d6ecff';
            this.ctx.fillStyle = isHovered ? 'rgba(214, 236, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            this.ctx.strokeRect(button.x, button.y, button.width, button.height);

            // Button Text
            this.ctx.fillStyle = "#d6ecff";
            this.ctx.font = "16px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        });
    }
    
    public handleOverlayClick(uv: { x: number, y: number }): void {
        if (this.gameState !== 'WON' && this.gameState !== 'LOST') return;

        const mouseX = uv.x * this.canvas.width;
        const mouseY = (1 - uv.y) * this.canvas.height;

        if (mouseX >= this.playAgainButton.x && mouseX <= this.playAgainButton.x + this.playAgainButton.width &&
            mouseY >= this.playAgainButton.y && mouseY <= this.playAgainButton.y + this.playAgainButton.height) {
            this.initializeGame();
            return;
        }

        if (mouseX >= this.mainMenuButton.x && mouseX <= this.mainMenuButton.x + this.mainMenuButton.width &&
            mouseY >= this.mainMenuButton.y && mouseY <= this.mainMenuButton.y + this.mainMenuButton.height) {
            this.stop();
            this.onGameOver();
            return;
        }
    }
}