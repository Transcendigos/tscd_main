import { SoLongGame } from './SoLongGame';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element not found!');
}

const soLongGame = new SoLongGame(canvas);

soLongGame.start();