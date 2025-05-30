import fetch from 'node-fetch'; // omit this if you're on Node 18+
import fp from 'fastify-plugin';

export default fp(async function openaiRoute(server, options) {
    server.post('/api/gpt', async (req, reply) => {
        const { message } = req.body;

        try {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: message }],
                }),
                messages: [
                    { role: "system", content: "You are a friendly assistant. If the user seems emotional or mentions music, suggest a playlist mood like 'chill', 'sad', or 'happy'." },
                    { role: "user", content: message }
                ]
            });

            const data = await gptRes.json();
            server.log.info("🔍 OpenAI raw response:", data);
            if (!data.choices || !Array.isArray(data.choices)) {
                return reply.code(502).send({
                    error: "Invalid response from OpenAI",
                    detail: data, // send full body back for debugging
                });
            }
            const replyText = data.choices?.[0]?.message?.content?.trim() || null;
            reply.send({ reply: replyText });

        } catch (err) {
            server.log.error({ err }, "GPT API error");
            reply.code(500).send({ error: "Failed to get GPT response" });
        }
    });
});
