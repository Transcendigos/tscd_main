export interface IPlayer {
    x: number;
    y: number;
    hp: number;
    collectibles: number;
    moves: number;
    direction: string;
    lastHit: number;
    lastShoot: number;
}

export interface IInvader {
    x: number;
    y: number;
    spawnX: number;
    spawnY: number;
    alive: boolean;
    lastDeath: number;
    direction: string;
    spriteKey: string;
    aiCooldown: number;
    collided: boolean;
}

// NEW: Describes a single, moving projectile
export interface IProjectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
}

export interface IExplosion {
    x: number;
    y: number;
    endTime: number;
}

export interface IMap {
    grid: string[][];
    width: number;
    height: number;
    exit: { x: number; y: number; };
    totalCollectibles: number;
}

export const ASSET_PATHS = {
    'WALL1': '/assets/so_long/roid1.png', 'WALL2': '/assets/so_long/roid2.png', 'WALL3': '/assets/so_long/roid3.png',
    'WALL4': '/assets/so_long/roid4.png', 'WALL5': '/assets/so_long/roid5.png', 'WALL6': '/assets/so_long/roid6.png',
    'WALL7': '/assets/so_long/roid7.png', 'WALL8': '/assets/so_long/roid8.png', 'WALL9': '/assets/so_long/roid9.png',
    'BACK': '/assets/so_long/back.png', 'BACK2': '/assets/so_long/back2.png', 'BACK3': '/assets/so_long/back3.png',
    'BACK4': '/assets/so_long/back4.png', 'BACK5': '/assets/so_long/back5.png', 'BACK6': '/assets/so_long/back6.png',
    'BACK7': '/assets/so_long/back7.png', 'BACK8': '/assets/so_long/back8.png', 'BACK9': '/assets/so_long/back9.png',
    'BACK10': '/assets/so_long/back10.png', 'BACK_N': '/assets/so_long/backn.png',
    'SHIP_UP': '/assets/so_long/ship.png', 'SHIP_DOWN': '/assets/so_long/ship_down.png', 'SHIP_LEFT': '/assets/so_long/ship_left.png',
    'SHIP_RIGHT': '/assets/so_long/ship_right.png', 'SHIP_DUL': '/assets/so_long/ship_dul.png', 'SHIP_DUR': '/assets/so_long/ship_dur.png',
    'SHIP_DDL': '/assets/so_long/ship_ddl.png', 'SHIP_DDR': '/assets/so_long/ship_ddr.png',
    'COLLECT': '/assets/so_long/planet.png', 'COLLECT1': '/assets/so_long/planet1.png', 'COLLECT2': '/assets/so_long/planet2.png',
    'COLLECT3': '/assets/so_long/planet3.png', 'COLLECT4': '/assets/so_long/planet4.png', 'COLLECT5': '/assets/so_long/planet5.png',
    'COLLECT6': '/assets/so_long/planet6.png', 'COLLECT7': '/assets/so_long/planet7.png', 'COLLECT8': '/assets/so_long/planet8.png',
    'TERRA': '/assets/so_long/terra.png', 'TERRA1': '/assets/so_long/terra1.png', 'TERRA2': '/assets/so_long/terra2.png',
    'TERRA3': '/assets/so_long/terra3.png', 'TERRA4': '/assets/so_long/terra4.png',
    'LASER': '/assets/so_long/laser.png', 'LASER1': '/assets/so_long/laser1.png', 'LASER2': '/assets/so_long/laser2.png',
    'LASER3': '/assets/so_long/laser3.png', 'V_LASER': '/assets/so_long/vert_laser.png', 'V_LASER1': '/assets/so_long/vert_laser1.png',
    'V_LASER2': '/assets/so_long/vert_laser2.png', 'V_LASER3': '/assets/so_long/vert_laser3.png',
    'INVADER': '/assets/so_long/invader.png', 'INVADER1': '/assets/so_long/invader1.png', 'INVADER2': '/assets/so_long/invader2.png',
    'INVADER_SPAWN': '/assets/so_long/invader_spawn.png', 'EXIT': '/assets/so_long/gate.png',
    'BOOM': '/assets/so_long/boom.png', 'BOOM1': '/assets/so_long/boom1.png', 'BOOM2': '/assets/so_long/boom2.png',
    'BOOM3': '/assets/so_long/boom3.png',
};