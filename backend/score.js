import { getDB } from './db.js';
import fp from 'fastify-plugin';
import { ethers } from "ethers";
import dotenv from "dotenv";
import { createRequire } from 'module';

dotenv.config();

const require = createRequire(import.meta.url);
const ScoreBoardArtifact = require('./blockchain/artifacts/contracts/ScoreBoard.sol/ScoreBoard.json');
const provider = new ethers.JsonRpcProvider(process.env.FUJI_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
	process.env.SCOREBOARD_ADDRESS,
	ScoreBoardArtifact.abi,
	wallet
);

export default fp(async function scoreRoutes(server, options) {
	const db = getDB();

	server.post('/api/scores', {
	schema: {
		body: {
			type: 'object',
			required: ['tournament_id', 'user_id', 'score'],
			properties: {
			tournament_id: { type: 'integer' },
			user_id: { type: 'integer' },
			score: { type: 'integer' }
			}
		}
	}
	}, async (req, reply) => {
	const { tournament_id, user_id, score } = req.body;

	return new Promise((resolve, reject) => {
	db.run(
		`INSERT INTO scores (tournament_id, user_id, score) VALUES (?, ?, ?)`,
		[tournament_id, user_id, score],
		function (err) {
			if (err) {
				server.log.error(err);
				reply.code(500).send({ error: 'Failed to add score' });
				reject(err);
			} else {
				const result = {
					id: this.lastID,
					tournament_id,
					user_id,
					score,
					blockchainTx: null
				};

				reply.code(201).send(result);
				resolve(result);

				// Post to blockchain in background
				(async () => {
				try {
					const tx = await contract.postScore(tournament_id, score);
					await tx.wait();
					console.log(`💰 Score posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx.hash}`);
					server.log.info(`💰 Score posted to blockchain. TX: https://testnet.snowtrace.io/tx/${tx.hash}`);
				} catch (err) {
					console.log("❌ Blockchain postScore failed:", err);
				}
				})();
			}
		}
	);
	});
	});

	server.get('/api/scores', async (req, reply) => {
		try {
			const rows = await new Promise((resolve, reject) => {
				db.all(`SELECT * FROM scores`, (err, rows) => {
					if (err) { 
						return reject(err);
					}
					resolve(rows);
				});
		});
		reply.send(rows);
		} catch (err) {
		server.log.error(err);
		reply.code(500).send({ error: 'Failed to fetch scores' });
		}
	});
});