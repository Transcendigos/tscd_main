// src/webcam.ts

/**
 * Initializes and starts the webcam feed, displaying it in the specified video element.
 * @param videoElementId The ID of the HTML <video> element to display the feed.
 * @param errorMessageElementId The ID of the HTML element to display error messages.
 * @returns A Promise that resolves with the MediaStream if successful, or null otherwise.
 */
export async function startWebcamFeed(videoElementId: string, errorMessageElementId: string): Promise<MediaStream | null> {
    const videoElement = document.getElementById(videoElementId) as HTMLVideoElement | null;
    const errorMessageElement = document.getElementById(errorMessageElementId) as HTMLElement | null;

    function displayError(message: string): void {
        console.error(message);
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
        }
    }

    if (!videoElement) {
        displayError(`Error: Video element with ID "${videoElementId}" not found.`);
        return null;
    }

    if (errorMessageElement) {
        errorMessageElement.textContent = '';
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            videoElement.srcObject = stream;
            console.log(`Webcam stream started for video element: ${videoElementId}.`);
            return stream;

        } catch (error: unknown) {
            let message = "Could not access the webcam. ";
            if (error instanceof Error) {
                console.error(`Error accessing the webcam (${error.name}): ${error.message}`);
                switch (error.name) {
                    case "NotFoundError":
                    case "DevicesNotFoundError":
                        message += "No camera found.";
                        break;
                    case "NotAllowedError":
                    case "PermissionDeniedError":
                        message += "Permission denied. Please allow camera access.";
                        break;
                    case "NotReadableError":
                    case "TrackStartError":
                        message += "Camera is already in use or a hardware error occurred.";
                        break;
                    case "OverconstrainedError":
                         message += "The requested camera constraints could not be met.";
                         break;
                    case "TypeError":
                         message += "A technical error occurred (TypeError).";
                         break;
                    default:
                        message += `An unexpected error occurred: ${error.name || 'Unknown Error'}.`;
                }
            } else {
                console.error("An unknown error occurred:", error);
                message += `An unknown error occurred.`;
            }
            displayError(message);
            return null;
        }
    } else {
        displayError("Webcam API (getUserMedia) is not supported in this browser.");
        return null;
    }
};