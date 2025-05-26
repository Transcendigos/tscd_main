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
  const tryInit = () => {
    if (window.google && window.google.accounts && window.google.accounts.id) 
    {
      console.log("Loaded Google Client");

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      const targets = ["google-signin-signin", "google-signin-signup"];
      targets.forEach((id) => {
        const container = document.getElementById(id);
        if (container) 
        {
          window.google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            width: 250,
          });
          console.log(`Rendered Google button in #${id}`);
        }
        else 
        {
          console.warn(`Container #${id} not found for Google button`);
        }
      });

    } else {
      // Retry in 100ms
      setTimeout(tryInit, 100);
    }
  };

  tryInit();
}