export function setupSpotifySearch() {
  const input = document.getElementById("spotifySearchInput") as HTMLInputElement;
  const iframe = document.getElementById("spotifyIframe") as HTMLIFrameElement;

  if (!input || !iframe) return;

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      const q = input.value.trim();
      const res = await fetch(`http://localhost:3000/api/spotify/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      console.log(data.embed);
      if (data.embed) {
        iframe.src = data.embed;
      } else {
        alert("No playlist found.");
      }
    }
  });
}