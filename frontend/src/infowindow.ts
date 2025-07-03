import { DesktopWindow } from "./DesktopWindow.js";



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

async function renderWeatherData() {
  try {
    const response = await fetch("/api/weather/paris");
    const data = await response.json();

    document.getElementById("weatherCity")!.textContent = "PARIS, FR";
    (document.getElementById("weatherIcon") as HTMLImageElement).src = data.current.icon;
    document.getElementById("weatherTemp")!.textContent = `${data.current.temp.toFixed(1)}°C`;
    document.getElementById("weatherDescription")!.textContent = data.current.description;

    document.getElementById("weatherFeels_Like")!.textContent = `${data.current.feels_like.toFixed(1)}°C`;
    document.getElementById("humidity")!.textContent = `${data.current.humidity}%`;
    document.getElementById("wind")!.textContent = `${data.current.wind.toFixed(1)} km/h`;
    document.getElementById("weatherAQI")!.textContent = aqiMeaning(data.air);

    const weatherForecast = document.getElementById("weatherForecast")!;
    weatherForecast.innerHTML = "";

    weatherForecast.innerHTML = data.forecast.map(f => {
      const date = new Date(f.time);
      const day = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      return `
        <div class="forecast-day-card">
          <span class="font-bold">${day}</span>
          <img src="${f.icon}" class="w-12 h-12" alt="icon" />
          <span class="text-sm">${Math.round(f.temp)}°C</span>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("[Weather Fetch Error]", error);
    const cityEl = document.getElementById("weatherCity");
    if (cityEl) cityEl.textContent = "Failed to load weather data.";
  }
}


export function setupInfoWindow(weatherWindow: DesktopWindow, grafanaWindow: DesktopWindow, commandWindow: DesktopWindow, aboutWindow: DesktopWindow) {

  const openWeatherBtn = document.getElementById("openWeatherBtn") as HTMLButtonElement;
  openWeatherBtn?.addEventListener("click", async () => {
    weatherWindow.open();
    await renderWeatherData();
  });

  const openGrafanaBtn = document.getElementById("openGrafanaBtn") as HTMLButtonElement;
  openGrafanaBtn?.addEventListener("click", async () => {
    grafanaWindow.open();
  });
  
  const openCommandBtn = document.getElementById("openCommandBtn") as HTMLButtonElement;
  openCommandBtn?.addEventListener("click", async () => {
    commandWindow.open();
  });  
  
  const openAboutBtn = document.getElementById("openAboutBtn") as HTMLButtonElement;
  openAboutBtn?.addEventListener("click", async () => {
    aboutWindow.open();
  });
}