const { ethers } = require("hardhat");

async function main() {
	const contractAddress = process.env.SCOREBOARD_ADDRESS;
	const ScoreBoard = await ethers.getContractFactory("ScoreBoard");
	const scoreBoard = ScoreBoard.attach(contractAddress);

	const tx = await scoreBoard.postScore(1, 42); // for manual testing: tournamentId=1, score=42
	await tx.wait();
	console.log(`💰 Score posted, view on Snowtrace: https://testnet.snowtrace.io/tx/${tx.hash}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
