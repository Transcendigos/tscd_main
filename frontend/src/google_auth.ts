declare global {
  interface Window {
    google: any;
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
      console.log("Google login successful:", data);
      // Redirect or update UI as needed
    })
    .catch((err) => console.error("Google login failed:", err));
}

export function initGoogleSignIn() {
    console.log("Loaded client ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });

  window.google.accounts.id.renderButton(
    document.getElementById("google-signin"),
    {
      theme: "outline",
      size: "large",
    }
  );
}