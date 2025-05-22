declare global {
  interface Window {
    google?: any;
  }
}

function handleCredentialResponse(response: any) {
  fetch("http://localhost:3000/api/google-login", {
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
      // Redirect or update UI as needed
    })
    .catch((err) => console.error("issue:", err));
}

export function initGoogleSignIn() {
  const tryInit = () => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      console.log("Loaded client ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      const buttonDiv = document.getElementById("google-signin");
      if (buttonDiv) {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: "outline",
          size: "large",
        });
      }
    } else {
      // Retry in 100ms
      setTimeout(tryInit, 100);
    }
  };

  tryInit();
}