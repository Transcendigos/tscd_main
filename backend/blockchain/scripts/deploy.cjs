const hre = require("hardhat");  // hardhat runtime environment

async function main() {
	const ScoreBoard = await hre.ethers.getContractFactory("ScoreBoard");	// Get contract factory
	const scoreBoard = await ScoreBoard.deploy();							// Deploy contract
	await scoreBoard.deployed();											// Wait until mined

	console.log("ScoreBoard deployed to:", scoreBoard.address);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
