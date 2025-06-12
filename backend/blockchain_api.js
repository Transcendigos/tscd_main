import { submitScore } from "./blockchain/interact.js";

export default async function (fastify, opts) {
  fastify.post("/blockchain/score", async (request, reply) => {
    const { points } = request.body;
    try {
      const txHash = await submitScore(points);
      reply.send({ status: "ok", txHash });
    } catch (err) {
      console.error("Blockchain score error:", err);
      reply.code(500).send({ error: "Failed to save score" });
    }
  });
}