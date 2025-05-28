import fetch from 'node-fetch';
import fp from 'fastify-plugin';

// Constants
const API_KEY = process.env.OPENWEATHER_API_KEY;
const LAT = 48.8566; // Paris latitude
const LON = 2.3522;  // Paris longitude

// Simple in-memory cache
let cache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export default fp(async function weatherRoutes(server, options) {
  server.get('/api/weather/paris', async (req, reply) => {
    const now = Date.now();

    // Serve from cache if recent
    if (cache && now - lastFetchTime < CACHE_DURATION) {
      return reply.send(cache);
    }

    try {
      // Fetch all data in parallel
      const [current, forecast, pollution] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${API_KEY}`).then(res => res.json()),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&units=metric&appid=${API_KEY}`).then(res => res.json()),
        fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${LAT}&lon=${LON}&appid=${API_KEY}`).then(res => res.json()),
      ]);

      // Format response
      const result = {
        city: current.name,
        current: {
          temp: current.main.temp,
          description: current.weather[0].description,
          icon: `http://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`,
        },
        forecast: forecast.list.slice(0, 5).map(entry => ({
          time: entry.dt_txt,
          temp: entry.main.temp,
          icon: `http://openweathermap.org/img/wn/${entry.weather[0].icon}@2x.png`,
        })),
        air: pollution.list[0].main.aqi, // 1 (Good) to 5 (Hazardous)
      };

      // Cache result
      cache = result;
      lastFetchTime = now;

      reply.send(result);
    } catch (err) {
      server.log.error('[Weather API Error]', err);
      reply.code(500).send({ error: 'Failed to fetch weather data' });
    }
  });
});