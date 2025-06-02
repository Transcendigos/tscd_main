export async function settingUserProfile() {
    try {
        const res = await fetch('http://localhost:3000/api/profile', { credentials: 'include' });
        if (!res.ok) {
            console.error('Failed to fetch profile');
            return;
        }

        const { profile } = await res.json();

        const imgEl = document.getElementById('profileImage') as HTMLImageElement | null;
        const usernameEl = document.getElementById('profileUsername');
        const emailEl = document.getElementById('profileEmail');

        if (!imgEl || !usernameEl || !emailEl) {
            console.warn("Profile elements not found in DOM.");
            return;
        }
        console.log('image is ', profile.image);
        const fallbackImage = '/favicon.jpg';
        const resolvedSrc = profile.picture || fallbackImage;
        const absoluteResolvedSrc = resolvedSrc.startsWith('http')
            ? resolvedSrc
            : new URL(resolvedSrc, window.location.origin).href;


        // Avoid flickering
        if (imgEl.src !== absoluteResolvedSrc) {
            imgEl.src = resolvedSrc;
        }

        console.log(imgEl);
        imgEl.alt = `${profile.username}'s profile picture`;

        imgEl.onerror = () => {
            if (!imgEl.src.includes(fallbackImage)) {
                imgEl.src = fallbackImage;
            }
        };

        usernameEl.textContent = `username: ${profile.username}`;
        emailEl.textContent = `email: ${profile.email}`;
    } catch (error) {
        console.error("Error loading user profile:", error);
    }
}

