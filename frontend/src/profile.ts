import { currentUserId as myUserId } from './chatClient.js';

const hide = (id: string) => document.getElementById(id)!.classList.add("hidden");

function getApiUrl(path: string) {
  const base = import.meta.env.VITE_API_URL || '';
  return base + path;
}

async function resetAllForms() {
    (document.getElementById("newUsername") as HTMLInputElement).value = '';
    (document.getElementById("newEmail") as HTMLInputElement).value = '';
    (document.getElementById("newPassword") as HTMLInputElement).value = '';
    (document.getElementById("profilePicInput") as HTMLInputElement).value = '';
    (document.getElementById("verifyTotpInput") as HTMLInputElement).value = '';
    hide("usernameForm");
    hide("emailForm");
    hide("passwordForm");
    hide("pictureForm");
    const usernameMsg = document.getElementById("UsernameUpdateStatus")!;
    const emailMsg = document.getElementById("emailUpdateStatus")!;
    const passwordMsg = document.getElementById("passwordUpdateStatus")!;
    const pictureMsg = document.getElementById("pictureUpdateStatus")!;
    const deleteMsg = document.getElementById("deleteUpdateStatus")!;
    usernameMsg.textContent = "";
    emailMsg.textContent = "";
    passwordMsg.textContent = "";
    pictureMsg.textContent = "";
    deleteMsg.textContent = "";
}

export async function settingUserSetting() {
    try {
        resetAllForms();
        const profileImage = document.getElementById('profileImageSetting') as HTMLImageElement | null;
        const currentUsername = document.getElementById('currentUsername');
        const currentEmail = document.getElementById('currentEmail');

        const res = await fetch(getApiUrl('/api/profile'), { credentials: 'include' });
        if (!res.ok) {
            console.error('Failed to fetch profile');
            return;
        }

        const { profile } = await res.json();
        if (!profileImage || !currentUsername || !currentEmail) {
            console.warn("Profile elements not found in DOM.");
            return;
        }

        const fallbackImage = '/favicon.jpg';
        const resolvedSrc = profile.picture || fallbackImage;
        const absoluteResolvedSrc = resolvedSrc.startsWith('http')
            ? resolvedSrc
            : new URL(resolvedSrc, window.location.origin).href;

        if (profileImage.src !== absoluteResolvedSrc) {
            profileImage.src = resolvedSrc;
        }

        profileImage.alt = `${profile.username}'s profile picture`;
        profileImage.onerror = () => {
            if (!profileImage.src.includes(fallbackImage)) {
                profileImage.src = fallbackImage;
            }
        };

        currentUsername.textContent = profile.username;
        currentEmail.textContent = profile.email;
        profileImage.src = profile.picture;

        // Refresh TOTP state and UI
        console.log("Refreshing TOTP state");
        const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
        const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;
        const totp2faoption = document.getElementById('totp2faoption');

        qrContainer.classList.add('hidden');

        const resMe = await fetch(getApiUrl("/api/me"), { credentials: "include" });
        const data = await resMe.json();

        if (data.signedIn && data.user) {
            totp2faCheckbox.checked = data.user.totp_enabled;
        }

        const emailBtn = document.getElementById("changeEmailBtn") as HTMLButtonElement | null;
        const passwordBtn = document.getElementById("changePasswordBtn") as HTMLButtonElement | null;
        const emailSetting = document.getElementById("emailsetting");
        const passwordSetting = document.getElementById("passwordsetting");

        if (data.user && data.user.method_sign === "google") {
            // 🔒 Disable fields for Google users
            totp2faCheckbox.disabled = true;
            totp2faCheckbox.title = "Google sign-in users cannot enable 2FA here.";
            totp2faoption?.classList.add("opacity-50", "cursor-not-allowed", "select-none");
            totp2faoption?.classList.remove("hover-important");
            totp2faoption!.title = "Google sign-in users cannot enable 2FA here.";

            emailBtn?.setAttribute("disabled", "true");
            emailBtn?.classList.add("opacity-50", "cursor-not-allowed");
            emailBtn!.title = "Email cannot be changed for Google-authenticated accounts.";

            passwordBtn?.setAttribute("disabled", "true");
            passwordBtn?.classList.add("opacity-50", "cursor-not-allowed");
            passwordBtn!.title = "Password cannot be changed for Google-authenticated accounts.";

            emailSetting?.classList.add("opacity-50", "cursor-not-allowed", "select-none");
            emailSetting?.removeAttribute("title");

            passwordSetting?.classList.add("opacity-50", "cursor-not-allowed", "select-none");
            passwordSetting?.removeAttribute("title");

        } else {
            // ✅ Enable fields for local users
            totp2faCheckbox.disabled = false;
            totp2faCheckbox.title = "";
            totp2faoption?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
            totp2faoption?.classList.add("cursor-pointer");
            totp2faoption!.title = "";

            emailBtn?.removeAttribute("disabled");
            emailBtn?.classList.remove("opacity-50", "cursor-not-allowed");
            emailBtn!.title = "";

            passwordBtn?.removeAttribute("disabled");
            passwordBtn?.classList.remove("opacity-50", "cursor-not-allowed");
            passwordBtn!.title = "";

            emailSetting?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
            emailSetting?.removeAttribute("title");

            passwordSetting?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
            passwordSetting?.removeAttribute("title");
        }

    } catch (error) {
        console.error("Error loading user profile:", error);
    }
}


export async function settingUserProfile() {
    try {
        const res = await fetch(getApiUrl('/api/profile'), { credentials: 'include' });
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
        console.log('image is ', profile.picture);
        const fallbackImage = '/favicon.jpg';
        imgEl.src = profile.picture || fallbackImage;

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

export async function populateUserProfile() {
    if (!myUserId) {
        console.error("Profile: User not authenticated.");
        document.getElementById('profileUsername')!.textContent = "Error: Not Signed In";
        return;
    }
    
    const prefixedId = `user_${myUserId}`;

    try {
        // Fetch all necessary data in parallel for maximum speed
        const [profileRes, summaryRes, historyRes] = await Promise.all([
            fetch('http://localhost:3000/api/profile', { credentials: 'include' }),
            fetch(`/api/stats/summary/${prefixedId}`),
            fetch(`/api/stats/match-history/${prefixedId}`)
            // Note: You will need to create an endpoint to fetch friends list
            // fetch(`/api/friends/${prefixedId}`)
        ]);

        if (!profileRes.ok || !summaryRes.ok || !historyRes.ok) {
            throw new Error('Failed to fetch all profile data.');
        }

        const { profile } = await profileRes.json();
        const summary = await summaryRes.json();
        const history = await historyRes.json();
        // const friends = await friendsRes.json(); // Uncomment when you have a friends endpoint

        // --- Populate Header ---
        (document.getElementById('profileImage') as HTMLImageElement).src = profile.picture || '/favicon.jpg';
        document.getElementById('profileUsername')!.textContent = profile.username;
        document.getElementById('profileEmail')!.textContent = profile.email;

        // --- Populate Stats Bar ---
        document.getElementById('profileWins')!.textContent = summary.wins;
        document.getElementById('profileLosses')!.textContent = summary.losses;
        document.getElementById('profileWinRatio')!.textContent = summary.winRatio;

        // --- Populate Friends List (Example) ---
        // This part is a placeholder until you create the backend endpoint for it.
        const friendsList = document.getElementById('profileFriendsList')!;
        friendsList.innerHTML = `<li class="opacity-50 text-xs">Friends list coming soon...</li>`; 
        // Once you have the data, you would use a map function like this:
        /*
        friendsList.innerHTML = friends.map(friend => `
            <li class="flex items-center justify-between text-xs p-1 bg-slate-900/50">
                <span>${friend.username}</span>
                <span class="text-${friend.is_online ? 'green' : 'gray'}-400">${friend.is_online ? 'Online' : 'Offline'}</span>
            </li>
        `).join('') || `<li class="opacity-50 text-xs">No friends added yet.</li>`;
        */

        // --- Populate Match History ---
        const historyBody = document.getElementById('profileMatchHistory');
        if (historyBody) {
            historyBody.innerHTML = ''; // Clear previous history
            if (history.length === 0) {
                historyBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-slate-400">No match history found.</td></tr>`;
            } else {
                history.forEach(match => {
                    const resultClass = match.result === 'Win' ? 'text-green-400' : 'text-red-400';
                    const row = document.createElement('tr');
                    row.className = 'border-t border-slate-700/50';
                    row.innerHTML = `
                        <td class="p-2">${match.opponent}</td>
                        <td class="p-2">${match.yourScore} - ${match.opponentScore}</td>
                        <td class="p-2 font-bold ${resultClass}">${match.result}</td>
                        <td class="p-2 opacity-70">${new Date(match.date).toLocaleDateString()}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }
        }

    } catch (error) {
        console.error("Error populating user profile:", error);
        document.getElementById('profileUsername')!.textContent = "Failed to load data";
    }
}


