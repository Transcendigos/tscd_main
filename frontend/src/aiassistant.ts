import { DesktopWindow } from "./DesktopWindow.js";

export function setupAIWindow(musicWindow: DesktopWindow) {
  const form = document.getElementById("chatForm") as HTMLFormElement;
  const input = document.getElementById("chatInput") as HTMLInputElement;
  const messages = document.getElementById("chatMessages");

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

    try {
      const res = await fetch("http://localhost:3000/api/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();
      let fullText = data.reply || "[no response]";

      // Detect mood in reply
      const gptReply = fullText.toLowerCase();
      const possibleKeywords = ["chill", "sad", "happy", "focus", "jazz", "epic", "lofi", "gaming", "romantic"];
      let mood_index = -1;
      let playlistEmbed: string | null = null;

      for (let i = 0; i < possibleKeywords.length; i++) {
        if (gptReply.includes(possibleKeywords[i])) {
          mood_index = i;
          const mood = possibleKeywords[i];
          const musicRes = await fetch(`http://localhost:3000/api/spotify/search?q=${encodeURIComponent(mood)}`);
          const musicData = await musicRes.json();
          playlistEmbed = musicData.embed;
          break;
        }
      }

      // Special slow typing if mood_index is matched (but not 0)
      if (mood_index !== -1 && mood_index !== 0) {
        fullText = "Opening the music player with a playlist that fit your mood !";
      }

      let index = 0;
      function typeNextChar() {
        if (index < fullText.length) {
          botDiv.textContent += fullText[index];
          index++;
          messages.scrollTop = messages.scrollHeight;
          setTimeout(typeNextChar, 20);
        }
      }
      typeNextChar();

      // Play music if matched
      if (playlistEmbed) {
        const iframe = document.getElementById("spotifyIframe") as HTMLIFrameElement;
        if (iframe) iframe.src = playlistEmbed;
        musicWindow.open();
      }

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
