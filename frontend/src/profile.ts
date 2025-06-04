const hide = (id: string) => document.getElementById(id)!.classList.add("hidden");

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

        const res = await fetch('http://localhost:3000/api/profile', { credentials: 'include' });
        if (!res.ok) {
            console.error('Failed to fetch profile');
            return;
        }
        const { profile } = await res.json();
        console.log(profile);
        if (!profileImage || !currentUsername || !currentEmail) {
            console.warn("Profile elements not found in DOM.");
            return;
        }
        console.log('image is ', profile.picture);
        const fallbackImage = '/favicon.jpg';
        const resolvedSrc = profile.picture || fallbackImage;
        const absoluteResolvedSrc = resolvedSrc.startsWith('http')
            ? resolvedSrc
            : new URL(resolvedSrc, window.location.origin).href;

        // Avoid flickering
        if (profileImage.src !== absoluteResolvedSrc) {
            profileImage.src = resolvedSrc;
        }

        console.log(profileImage);
        profileImage.alt = `${profile.username}'s profile picture`;

        profileImage.onerror = () => {
            if (!profileImage.src.includes(fallbackImage)) {
                profileImage.src = fallbackImage;
            }
        };
        currentUsername.textContent = profile.username;
        currentEmail.textContent = profile.email;
        profileImage.src = profile.picture;




        console.log("Refreshing TOTP state");
        const qrContainer = document.getElementById('qrContainer') as HTMLDivElement;
        qrContainer.classList.add('hidden');
        const totp2faCheckbox = document.getElementById('totp2faCheckbox') as HTMLInputElement;

        try {
            const res = await fetch("http://localhost:3000/api/me", { credentials: "include" });
            const data = await res.json();
            if (data.signedIn && data.user) {
                totp2faCheckbox.checked = data.user.totp_enabled;
            }
            if (data.user && data.user.method_sign === "google") {
                const totp2faoption = document.getElementById('totp2faoption');
                totp2faoption.classList.add("opacity-50", "cursor-not-allowed", "select-none");
                totp2faoption.classList.remove("hover-important", "cursor-default");
                totp2faoption.title = "Google sign-in users cannot enable 2FA here.";

                totp2faCheckbox.disabled = true;
                totp2faCheckbox.title = true
                    ? "Google sign-in users cannot enable 2FA here."
                    : "";

                const emailBtn = document.getElementById("changeEmailBtn");
                const passwordBtn = document.getElementById("changePasswordBtn");

                if (emailBtn?.parentNode) {
                    const emailsetting = document.getElementById('emailsetting');
                    emailsetting.classList.add("opacity-50", "cursor-not-allowed", "select-none");
                    emailsetting.classList.remove("hover-important", "cursor-default");
                    emailsetting.title = "Email cannot be changed for Google-authenticated accounts.";
                    const newEmailBtn = emailBtn.cloneNode(true) as HTMLElement;
                    newEmailBtn.classList.add("opacity-50", "cursor-not-allowed");
                    newEmailBtn.title = "Email cannot be changed for Google-authenticated accounts.";
                    emailBtn.parentNode.replaceChild(newEmailBtn, emailBtn);
                }

                if (passwordBtn?.parentNode) {
                    const passwordsetting = document.getElementById('passwordsetting');
                    passwordsetting.classList.add("opacity-50", "cursor-not-allowed", "select-none");
                    passwordsetting.classList.remove("hover-important", "cursor-default");
                    passwordsetting.title = "Password cannot be changed for Google-authenticated accounts.";
                    const newPasswordBtn = passwordBtn.cloneNode(true) as HTMLElement;
                    newPasswordBtn.classList.add("opacity-50", "cursor-not-allowed");
                    newPasswordBtn.title = "Password cannot be changed for Google-authenticated accounts.";
                    passwordBtn.parentNode.replaceChild(newPasswordBtn, passwordBtn);
                }
            }
            else {
                // ✅ Add this block to re-enable everything for local users
                const totp2faoption = document.getElementById('totp2faoption');
                totp2faoption?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
                totp2faoption?.classList.add("cursor-pointer");
                totp2faoption!.title = "";

                totp2faCheckbox.disabled = false;
                totp2faCheckbox.title = "";

                const emailBtn = document.getElementById("changeEmailBtn") as HTMLElement;
                const passwordBtn = document.getElementById("changePasswordBtn") as HTMLElement;

                document.getElementById("emailsetting")?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
                document.getElementById("emailsetting")?.removeAttribute("title");

                document.getElementById("passwordsetting")?.classList.remove("opacity-50", "cursor-not-allowed", "select-none");
                document.getElementById("passwordsetting")?.removeAttribute("title");

                if (emailBtn) {
                    emailBtn.classList.remove("opacity-50", "cursor-not-allowed");
                    emailBtn.removeAttribute("title");
                }

                if (passwordBtn) {
                    passwordBtn.classList.remove("opacity-50", "cursor-not-allowed");
                    passwordBtn.removeAttribute("title");
                }

            }
        } catch (err) {
            console.error("Failed to refresh TOTP state:", err);
            totp2faCheckbox.checked = false;
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
    }
}



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
        console.log('image is ', profile.picture);
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

