import 'dotenv/config';
import ethersPkg from "ethers";
import { readFile } from "fs/promises";
const { Wallet, Contract } = ethersPkg;

const REQUIRED_ENV_VARS = ["PRIVATE_KEY", "FUJI_RPC_URL", "SCOREBOARD_ADDRESS"];
for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is not set!`);
  }
}

const provider = new ethersPkg.providers.JsonRpcProvider(process.env.FUJI_RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
const ScoreBoardArtifact = JSON.parse(
  await readFile(
    new URL("./artifacts/contracts/ScoreBoard.sol/ScoreBoard.json", import.meta.url)
  )
);
const contract = new Contract(
    process.env.SCOREBOARD_ADDRESS,
    ScoreBoardArtifact.abi,
    wallet
);

export async function sendMatchToBlockchain(match) {
    const player1_id = match.player1_id;
    const player2_id = match.player2_id;
    const winner_id  = match.winner_id;

    console.log("Preparing to post match to blockchain:");
    console.log({
        tournament_id: match.tournament_id,
        match_id: match.id,
        player1_id,
        player2_id,
        player1_score: match.player1_score,
        player2_score: match.player2_score,
        winner_id
    });

    try {
        const tx = await contract.postMatchResult(
            match.tournament_id,
            match.id,
            player1_id,
            player2_id,
            match.player1_score,
            match.player2_score,
            winner_id
        );
        console.log("Transaction sent. Waiting for confirmation...");
        await tx.wait();
        console.log(`✅ Match posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx.hash}`);
    } catch (err) {
        // console.error("❌ Blockchain postMatchResult failed:", err);
    }
} 