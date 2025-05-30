import fp from 'fastify-plugin';
import fetch from 'node-fetch';


let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to fetch Spotify token: " + JSON.stringify(data));
  }
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export default fp(async function spotifyRoute(server, opts) {
  server.get('/api/spotify/search', async (req, reply) => {
    const query = req.query.q;
    if (!query) return reply.code(400).send({ error: "Missing query" });

    const token = await getAccessToken();

    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    server.log.info("🔍 Spotify API response:", JSON.stringify(data, null, 2));

    const playlist = data.playlists?.items?.[0];

    if (!playlist) {
      // fallback to a known good playlist
      return reply.send({
        name: "Happy Hits!",
        id: "37i9dQZF1DX3rxVfibe1L0",
        embed: "https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxVfibe1L0",
      });
    }

    reply.send({
      name: playlist.name,
      uri: playlist.uri,
      id: playlist.id,
      embed: `https://open.spotify.com/embed/playlist/${playlist.id}`,
    });
  });
});
