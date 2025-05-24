

export function setupSettingForm() {
    const settingTab = document.getElementById("settingTab");
    const settingWindow = document.getElementById("settingWindow");
    const closesettingBtn = document.getElementById("closesettingBtn");
    
    // const settingForm = document.getElementById("settingForm") as HTMLFormElement;
    settingTab?.addEventListener("click", () => {
        settingWindow?.classList.remove("hidden");
    });

    closesettingBtn?.addEventListener("click", () => {
        settingWindow?.classList.add("hidden");
    });

}