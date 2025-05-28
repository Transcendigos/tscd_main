import { DesktopWindow } from "./DesktopWindow.js";


//WEATHER FUNCTION

// Air Quality interpretation
function aqiMeaning(aqi: number): string {
  switch (aqi) {
    case 1: return "Good";
    case 2: return "Fair";
    case 3: return "Moderate";
    case 4: return "Poor";
    case 5: return "Very Poor";
    default: return "Unknown";
  }
}

// Render data into the weather window
async function renderWeatherData() {
  try {
    const response = await fetch("http://localhost:3000/api/weather/paris");
    const data = await response.json();

    // Set city
    document.getElementById("weatherCity")!.textContent = `${data.city}`;

    
    // Set current icon and temperature
    const iconImg = document.getElementById("weatherIcon") as HTMLImageElement;
    iconImg.src = data.current.icon;
    iconImg.alt = data.current.description;
    
    document.getElementById("weatherTemp")!.textContent = `Weather : ${data.current.temp.toFixed(1)}°C - ${data.current.description}`;
    document.getElementById("weatherFeels_Like")!.textContent = `But feels like ${data.current.feels_like.toFixed(1)}°C`;
    
    // Set air quality
    const aqiDescription = aqiMeaning(data.air);
    document.getElementById("weatherAQI")!.textContent = `Air Quality Index: ${data.air} - ${aqiDescription}`;
    document.getElementById("humidity")!.textContent = `Humidity: ${data.current.humidity} %`;
    document.getElementById("wind")!.textContent = `Wind speed: ${data.current.wind} km/h`;

    // Forecast rendering
    const forecastEl = document.getElementById("weatherForecast")!;
    forecastEl.innerHTML = "";

    data.forecast.forEach((entry: any) => {
      const date = new Date(entry.time);
      const dayMonth = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

      const div = document.createElement("div");
      div.className = "space-y-1";
      div.innerHTML = `
        <div class="text-sm">${dayMonth}</div>
        <img src="${entry.icon}" alt="forecast icon" class="w-8 h-8 mx-auto" />
        <div class="text-sm">${entry.temp.toFixed(1)}°C</div>
      `;
      forecastEl.appendChild(div);
    });

  } catch (error) {
    console.error("[Weather Fetch Error]", error);
    const cityEl = document.getElementById("weatherCity");
    if (cityEl) cityEl.textContent = "Failed to load weather data.";
  }
}


///MAIN SECTION

export function setupInfoWindow(weatherWindow: DesktopWindow) {
  const openWeatherBtn = document.getElementById("openWeatherBtn") as HTMLButtonElement;

  openWeatherBtn?.addEventListener("click", async () => {
    weatherWindow.open();
    await renderWeatherData();
  });
}