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
    document.getElementById("weatherCity")!.textContent = "PARIS";


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
    const weatherForecast = document.getElementById("weatherForecast")!;
    weatherForecast.innerHTML = "";

    weatherForecast.innerHTML = data.forecast.map(f => {
      const date = new Date(f.time);
      const day = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      return `
    <div class="flex flex-col items-center space-y-1">
      <span class="font-semibold">${day}</span>
      <img src="${f.icon}" class="w-14 h-14 -mt-3" alt="icon" />
      <span class="text-sm -mt-3">${Math.round(f.temp)}°C</span>
    </div>
  `;
    }).join("");

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