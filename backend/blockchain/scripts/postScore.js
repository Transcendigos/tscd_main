const { ethers } = require("hardhat");

async function main() {
	const [,, tournamentId, player1Id, player2Id, player1Score, player2Score, winnerId, playedAt] = process.argv;
	const contractAddress = process.env.SCOREBOARD_ADDRESS;
	const ScoreBoard = await ethers.getContractFactory("ScoreBoard");
	const scoreBoard = ScoreBoard.attach(contractAddress);

	console.log(`Posting match result:`);
	console.log({
		tournamentId,
		player1Id,
		player2Id,
		player1Score,
		player2Score,
		winnerId,
		playedAt
	});

	const tx1 = await scoreBoard.postScore(Number(tournamentId), Number(player1Score));
	await tx1.wait();
	console.log(`💰 Player 1 score posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx1.hash}`);

	const tx2 = await scoreBoard.postScore(Number(tournamentId), Number(player2Score));
	await tx2.wait();
	console.log(`💰 Player 2 score posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx2.hash}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
