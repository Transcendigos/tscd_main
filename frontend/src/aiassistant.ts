import { DesktopWindow } from "./DesktopWindow.js";

export function resetAIWindow() {
  const input = document.getElementById("chatInput") as HTMLInputElement;
  const messages = document.getElementById("chatMessages");

  if (input) {
    input.value = "";
    input.disabled = false;
  }

  if (messages) {
    messages.innerHTML = ""; // Clear all previous messages
  }

  window.speechSynthesis.cancel(); // Stop any ongoing speech
}

async function detectLanguage(text: string): Promise<string> {
  const res = await fetch("https://libretranslate.de/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text }),
  });
  const data = await res.json();
  return data[0]?.language || "en";
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const res = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: sourceLang,
      target: targetLang,
      format: "text"
    }),
  });
  const data = await res.json();
  return data.translatedText;
}

function speak(text: string, lang = "en") {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  synth.speak(utter);
}

export function setupAIWindow(musicWindow: DesktopWindow, systemMessage: string) {
  const form = document.getElementById("chatForm") as HTMLFormElement;
  const input = document.getElementById("chatInput") as HTMLInputElement;
  const messages = document.getElementById("chatMessages") as HTMLElement;

  if (!form || !input || !messages) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userMsg = input.value.trim();
    if (!userMsg) return;

    const userDiv = document.createElement("div");
    userDiv.className = "text-right text-[#8be076] font-semibold";
    userDiv.textContent = userMsg;
    messages.appendChild(userDiv);

    input.value = "";
    input.disabled = true;

    const botDiv = document.createElement("div");
    botDiv.className = "text-left text-[#4cb4e7]";
    messages.appendChild(botDiv);

    const normalized = userMsg.toLowerCase();

    const phraseTriggers: Record<string, () => void> = {
      "play music": () => { document.getElementById("musicBtn")?.click() },
      "play pong": () => { document.getElementById("clickMeBtn")?.click(); (window as any).aiWindow?.close?.() },
      "play multiplayer": () => alert("multiplayer feature is coming soon!"),
      "play tournament": () => alert("Tournament feature is coming soon!"),
      "open weather": () => { document.getElementById("openWeatherBtn")?.click() },
      "open settings": () => { document.getElementById("settingTab")?.click() },
      "open profile": () => { document.getElementById("profileBtn")?.click() },
      "open info": () => { document.getElementById("infoTab")?.click() },
      "open logout": () => { document.getElementById("logoutTab")?.click() },
      "open system": () => { document.getElementById("openGrafanaBtn")?.click() },
      "open about": () => { document.getElementById("openAboutBtn")?.click() },
      "open chat": () => { document.getElementById("chatBtn")?.click() },
      "open command": () => { document.getElementById("openCommandBtn")?.click() },
      "open stats": () => { document.getElementById("statsTab")?.click() },
      "close music": () => { document.getElementById("closemusicBtn")?.click() },
      "close pong": () => { document.getElementById("closepongBtn")?.click(); (window as any).aiWindow?.close?.() },
      "close multiplayer": () => alert("multiplayer feature is coming soon!"),
      "close tournament": () => alert("Tournament feature is coming soon!"),
      "close weather": () => { document.getElementById("closeweatherBtn")?.click() },
      "close settings": () => { document.getElementById("closesettingBtn")?.click() },
      "close profile": () => { document.getElementById("closeprofileBtn")?.click() },
      "close info": () => { document.getElementById("closeinfoBtn")?.click() },
      "close logout": () => { document.getElementById("closelogoutBtn")?.click() },
      "close system": () => { document.getElementById("closegrafanaBtn")?.click() },
      "close about": () => { document.getElementById("closeaboutBtn")?.click() },
      "close chat": () => { document.getElementById("closeChatBtn")?.click() },
      "close command": () => { document.getElementById("closecommandBtn")?.click() },
      "close stats": () => { document.getElementById("closestatsBtn")?.click() },
    };

    for (const phrase in phraseTriggers) {
      if (normalized.includes(phrase)) {
        phraseTriggers[phrase]();
      }
    }

    try {
      const userLang = "en"
      const translatedInput = userMsg;

      const moodKeywords = ["chill", "sad", "happy", "focus", "jazz", "epic", "lofi", "gaming", "romantic"];
      const websiteKeywords = ["open", "play", "close"];

      const matchedMood = moodKeywords.find(mood => translatedInput.toLowerCase().includes(mood));
      const matchedWebsite = websiteKeywords.find(web => translatedInput.toLowerCase().includes(web));

      let finalText = "waiting AI bot";
      if (matchedMood) {
        finalText = "Opening the music player with a fitted playlist...";
      }
      if (matchedWebsite) {
        finalText = "Opening/closing the proper window - See ya soon";
      }
      if (matchedMood) {
        const musicRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(matchedMood)}`);
        const musicData = await musicRes.json();
        if (musicData.embed) {
          const iframe = document.getElementById("spotifyIframe") as HTMLIFrameElement;
          iframe.src = musicData.embed;
          musicWindow.open();
        }
      }
      else if (matchedWebsite) {
      }
      else {
        const res = await fetch("/api/gpt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system: systemMessage, message: translatedInput }),
        });

        const data = await res.json();
        finalText = data.reply || "[no response]";

        if (userLang !== "en") {
          finalText = await translateText(finalText, "en", userLang);
        }
      }

      let index = 0;
      function typeCharByChar(text: string, callback: () => void) {
        if (index < text.length) {
          botDiv.textContent += text[index];
          index++;
          messages.scrollTop = messages.scrollHeight;
          setTimeout(() => typeCharByChar(text, callback), 20);
        } else {
          callback();
        }
      }

      typeCharByChar(finalText, () => speak(finalText, userLang));

    } catch (err) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "text-red-500 font-bold";
      errorDiv.textContent = "Error talking to AI.";
      messages.appendChild(errorDiv);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}