import fetch from 'node-fetch';
import fp from 'fastify-plugin';

const CITY = "Paris";

let cache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export default fp(async function weatherRoutes(server, options) {

  
  server.get('/api/weather/paris', async (req, reply) => {
    
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    const now = Date.now();

    if (!API_KEY) {
      server.log.error("Missing OPENWEATHER_API_KEY in environment");
      return reply.code(500).send({ error: "Missing API key" });
    }

    if (cache && now - lastFetchTime < CACHE_DURATION) {
      return reply.send(cache);
    }

    try {
      const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${CITY}&limit=1&appid=${API_KEY}`);
      const geoData = await geoRes.json();

      if (!geoData || !geoData.length || geoData[0].country !== "FR" || geoData[0].name !== "Paris") {
        server.log.error("[Weather API] Could not resolve Paris coordinates", geoData);
        return reply.code(500).send({ error: "Could not resolve coordinates for Paris" });
      }

      const { lat, lon } = geoData[0];

      const [current, forecast, pollution] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(res => res.json()),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(res => res.json()),
        fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`).then(res => res.json()),
      ]);

      if (!current || !current.main || !current.weather) {
        server.log.error("[Weather API] Invalid current weather response", current);
        return reply.code(500).send({ error: "Invalid current weather data" });
      }

      const result = {
        city: "Paris",
        current: {
          temp: current.main.temp,
          feels_like: current.main.feels_like,
          humidity: current.main.humidity,
          wind: current.wind.speed,
          description: current.weather[0].description,
          icon: `http://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`,

        },
        forecast: forecast.list.slice(0, 5).map(entry => ({
          time: entry.dt_txt,
          temp: entry.main.temp,
          icon: `http://openweathermap.org/img/wn/${entry.weather[0].icon}@2x.png`,
        })),
        air: pollution.list[0].main.aqi,
      };

      cache = result;
      lastFetchTime = now;

      reply.send(result);
    } catch (err) {
      server.log.error({ err }, '[Weather API Error]');
      reply.code(500).send({ error: 'Failed to fetch weather data' });
    }
  });
});
