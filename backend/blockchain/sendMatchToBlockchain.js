import 'dotenv/config';
import ethersPkg from "ethers";
import { readFile } from "fs/promises";
const { Wallet, Contract } = ethersPkg;

// Validate required environment variables
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

// Dummy address for local testing
const DUMMY_ADDRESS = "0x000000000000000000000000000000000000dead";

/**
 * Posts both player scores from a match to the blockchain.
 * @param {Object} match - The match_history row object.
 *        Should contain: tournament_id, player1_id, player2_id, player1_score, player2_score, etc.
 */
export async function sendMatchToBlockchain(match) {
    // Try to get addresses, fallback to dummy
    const player1_address = match.player1_address || DUMMY_ADDRESS;
    const player2_address = match.player2_address || DUMMY_ADDRESS;
    const winner_address  = match.winner_address  || DUMMY_ADDRESS;

    // Log match info for traceability
    console.log("Preparing to post match to blockchain:");
    console.log({
        tournament_id: match.tournament_id,
        match_id: match.id,
        player1_address,
        player2_address,
        player1_score: match.player1_score,
        player2_score: match.player2_score,
        winner_address
    });

    try {
        const tx = await contract.postMatchResult(
            match.tournament_id,
            match.id,
            player1_address,
            player2_address,
            match.player1_score,
            match.player2_score,
            winner_address
        );
        console.log("Transaction sent. Waiting for confirmation...");
        await tx.wait();
        console.log(`✅ Match posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx.hash}`);
    } catch (err) {
        console.error("❌ Blockchain postMatchResult failed:", err);
    }
} 