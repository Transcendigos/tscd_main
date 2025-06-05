export function setupTournamentButtonBehavior(): void {
  const wrapper = document.getElementById("tournamentWrapper");
  const tournamentBtn = document.getElementById("tournamentBtn");
  const splitButtons = document.getElementById("splitButtons");

  
  
  if (!wrapper || !tournamentBtn || !splitButtons) return ;
  
  wrapper.addEventListener("mouseenter", () => {
    tournamentBtn.classList.add("hidden");
    splitButtons.classList.remove("hidden");
    console.log("--Mouse Enter Detected--");
  });

  wrapper.addEventListener("mouseleave", () => {
    tournamentBtn.classList.remove("hidden");
    splitButtons.classList.add("hidden");
  });

  const localBtn = splitButtons.children[0] as HTMLElement;
  const onlineBtn = splitButtons.children[1] as HTMLElement;

  localBtn.id = "localBtn";
  onlineBtn.id = "onlineBtn";

  localBtn.addEventListener("click", () => {
    document.getElementById("tournamentBtn")?.click(); // simule le clic
  });

  console.log("button behavior set");

  onlineBtn.addEventListener("click", () => {
    alert("Online Tournament: Coming Soon 👀");
  });
}
