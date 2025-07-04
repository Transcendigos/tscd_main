import fetch from 'node-fetch';
import fp from 'fastify-plugin';

export default fp(async function openaiRoute(server, options) {
    server.post('/api/gpt', async (req, reply) => {

        const { system, message } = req.body;
        console.log("📥 Backend received:", { system, message });
        try {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: system || "You are a helpful assistant." },
                        { role: 'user', content: message }
                    ]
                }),
            });

            const data = await gptRes.json();
            server.log.info("🔍 OpenAI raw response:", data);
            if (!data.choices || !Array.isArray(data.choices)) {
                return reply.code(502).send({
                    error: "Invalid response from OpenAI",
                    detail: data,
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
