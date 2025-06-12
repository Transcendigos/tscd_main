console.log("[interact.js] Loaded interact.js and starting setup...");

import { ethers } from "ethers";
import fs from "fs";
const abi = JSON.parse(fs.readFileSync(new URL("./ScoreStorageABI.json", import.meta.url)));import * as dotenv from "dotenv";
dotenv.config({ path: "./blockchain/.env" });

const CONTRACT_ADDRESS = "0x12dD0B8bbC9b0f2b11Ad6d9AFaDf5077735280e0"; // ← change this
const provider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

export async function submitScore(points) {
  const tx = await contract.submitScore(points);
  await tx.wait();
  return tx.hash;
}