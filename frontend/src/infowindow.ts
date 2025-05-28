import { DesktopWindow } from "./DesktopWindow.js";

export function setupInfoWindow(logoutWindow: DesktopWindow) {

  //WEATHER SECTION
  openWeatherBtn?.addEventListener("click", async () => {
    try {
      const myNewWindow = new DesktopWindow({
        windowId: "PREFIXWindow",
        dragHandleId: "PREFIXDragHandle",
        resizeHandleId: "PREFIXResizeHandle",
        boundaryContainerId: "main",
        visibilityToggleId: "PREFIXWindow",
        openTriggerId: "spawner",
        closeButtonId: "closePREFIXBtn",
      });
    } catch (error) {
      console.error("Failed to initialize 'PREFIXWindow':", error);
    }
  });

  closeWeatherBtn?.addEventListener("click", () => {
    if (!weatherWindow) return;
    weatherWindow.classList.remove("opacity-100", "scale-100", "visible", "pointer-events-auto");
    weatherWindow.classList.add("opacity-0", "scale-95", "invisible", "pointer-events-none");
  });
/////////////////////////////////////////////////////////////////////////////////////////


}