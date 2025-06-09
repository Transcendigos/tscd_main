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

function setupUnifiedMic(inputEl: HTMLInputElement) {
  const micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.textContent = "🎤";
  micBtn.className = "ml-2 bg-[#4cb4e7] text-black px-2 py-1 rounded font-bold";
  inputEl.parentElement?.appendChild(micBtn);

  const recognition = new (window as any).webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let isRecording = false;

  const voiceCommands: Record<string, () => void> = {
    "open music": () => (window as any).musicWindow?.open?.(),
    "play pong": () => (window as any).pongWindow?.open?.(),
    "show weather": () => (window as any).weatherWindow?.open?.(),
    "start tournament": () => alert("Tournament feature is coming soon!"),
    "open settings": () => (window as any).settingWindow?.open?.(),
    "open profile": () => (window as any).profileWindow?.open?.(),
  };

  micBtn.onclick = () => {
    if (isRecording) {
      console.warn("Already recording");
      return;
    }
    isRecording = true;
    micBtn.textContent = "🎙️";
    recognition.start();
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    console.log("🎤 Recognized:", transcript);

    if (voiceCommands[transcript]) {
      voiceCommands[transcript]();
    } else {
      inputEl.value = transcript;
      inputEl.form?.requestSubmit();
    }

    isRecording = false;
    micBtn.textContent = "🎤";
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event.error);
    micBtn.textContent = "❌";
    isRecording = false;
    setTimeout(() => {
      micBtn.textContent = "🎤";
    }, 1500);
  };

  recognition.onend = () => {
    isRecording = false;
    if (micBtn.textContent !== "❌") {
      micBtn.textContent = "🎤";
    }
  };
}


export function setupAIWindow(musicWindow: DesktopWindow, systemMessage: string) {
  const form = document.getElementById("chatForm") as HTMLFormElement;
  const input = document.getElementById("chatInput") as HTMLInputElement;
  const messages = document.getElementById("chatMessages");

  if (!form || !input || !messages) return;

  setupUnifiedMic(input);

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
      "weather in paris": () => {
        (window as any).infoWindow?.open?.();
        document.getElementById("openWeatherBtn")?.click()
      },
      "play pong": () => { (window as any).pongWindow?.open?.(); document.getElementById("clickMeBtn")?.click() },
      "open profile": () => { (window as any).profileWindow?.open?.() },
      "open settings": () => { (window as any).settingWindow?.open?.() },
      "start tournament": () => { alert("Tournament feature is coming soon!") },
    };
    for (const phrase in phraseTriggers) {
      if (normalized.includes(phrase)) {
        phraseTriggers[phrase]();
      }
    }

    try {
      const userLang = "en" //await detectLanguage(userMsg);
      const translatedInput = userMsg; //userLang !== "en" ? await translateText(userMsg, userLang, "en") : userMsg;


      const moodKeywords = ["chill", "sad", "happy", "focus", "jazz", "epic", "lofi", "gaming", "romantic"];
      const websiteKeywords = ["pong", "play", "setting", "2fa", "password", "email", "user", "chat", "info", "weather", "paris"];

      const matchedMood = moodKeywords.find(mood => translatedInput.toLowerCase().includes(mood));
      const matchedWebsite = websiteKeywords.find(web => translatedInput.toLowerCase().includes(web));
      let finalText = matchedMood ? "Opening the music player with a fitted playlist..." : "waiting AI bot";
      finalText = matchedWebsite ? "Opening the proper window - See ya soon" : "waiting AI bot";


      if (matchedMood) {
        const musicRes = await fetch(`http://localhost:3000/api/spotify/search?q=${encodeURIComponent(matchedMood)}`);
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
        const res = await fetch("http://localhost:3000/api/gpt", {
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
