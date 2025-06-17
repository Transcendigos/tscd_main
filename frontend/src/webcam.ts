// src/webcam.ts

/**
 * Initializes and starts the webcam feed, displaying it in the specified video element.
 * @param videoElementId The ID of the HTML <video> element to display the feed.
 * @param errorMessageElementId The ID of the HTML element to display error messages.
 * @returns A Promise that resolves with the MediaStream if successful, or null otherwise.
 */
export async function startWebcamFeed(videoElementId?: string, errorMessageElementId?: string): Promise<MediaStream | null> {
    const videoElement = videoElementId ? document.getElementById(videoElementId) as HTMLVideoElement | null : null;
    const errorMessageElement = errorMessageElementId ? document.getElementById(errorMessageElementId) as HTMLElement | null : null;

    function displayError(message: string): void {
        console.error(message);
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
        }
    }

    if (errorMessageElement) {
        errorMessageElement.textContent = '';
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        displayError("Webcam API (getUserMedia) is not supported in this browser.");
        return null;
    }

    try {
        const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        // Only try to use the videoElement if it was found
        if (videoElement) {
            videoElement.srcObject = stream;
            console.log(`Webcam stream started for video element: ${videoElementId}.`);
        } else {
            console.log("Webcam stream acquired without a video element.");
        }
        
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
}

export function takePicture(stream: MediaStream): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');

        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            // Wait for the video to have dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (!context) {
                return reject(new Error('Failed to get 2D context from canvas.'));
            }

            // Draw the current video frame to the canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get the image as a data URL
            const dataUrl = canvas.toDataURL('image/png');

            // Stop the video tracks to turn off the webcam light
            stream.getTracks().forEach(track => track.stop());

            resolve(dataUrl);
        };

        video.onerror = (err) => {
            reject(err);
        };
    });
};
