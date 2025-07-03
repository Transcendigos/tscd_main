// frontend/src/google_auth.js


declare global {
  interface Window {
    google?: any;
  }
}

function handleCredentialResponse(response: any) {
  fetch("/api/google-login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential: response.credential }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Frontend:", data);

      // ✅ Close both signup and signin windows if open
      const closeWindowById = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove("opacity-100", "scale-100", "visible", "pointer-events-auto");
          el.classList.add("opacity-0", "scale-95", "invisible", "pointer-events-none");
        }
      };

      closeWindowById("signupWindow");
      closeWindowById("signinWindow");
      window.dispatchEvent(new Event("auth:updated"));
    })
    .catch((err) => console.error("issue:", err));
}

export function initGoogleSignIn() {
    const tryInit = async () => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            try {
                // 1. Fetch the Client ID from your new backend endpoint
                console.log("Fetching config from /api/config...");
                const response = await fetch('/api/config');
                if (!response.ok) {
                    throw new Error(`Failed to fetch config, status: ${response.status}`);
                }
                const config = await response.json();
                const googleClientId = config.googleClientId;

                if (!googleClientId) {
                    console.error("ERROR: Google Client ID was not received from the server.");
                    return; // Stop if we don't have an ID
                }

                // 2. Initialize Google Sign-In with the fetched ID
                console.log("✅ Received Google Client ID. Initializing...");
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleCredentialResponse,
                });

                // 3. Render the buttons now that initialization is complete
                const targets = ["google-signin-signin", "google-signin-signup"];
                targets.forEach((id) => {
                    const container = document.getElementById(id);
                    if (container) {
                        window.google.accounts.id.renderButton(container, {
                            theme: "filled_blue",
                            shape: "rectangular",
                            size: "medium",
                            width: 250,
                            text: "continue_with",
                        });
                        console.log(`Rendered Google button in #${id}`);
                    } else {
                        console.warn(`Container #${id} not found for Google button`);
                    }
                });

            } catch (error) {
                console.error("Fatal error during Google Sign-In initialization:", error);
            }
        } else {
            // Retry in 100ms if the Google library hasn't loaded yet
            setTimeout(tryInit, 100);
        }
    };

    tryInit();
}