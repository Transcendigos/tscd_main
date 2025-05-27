// frontend/src/chatClient.ts

interface User {
    id: number;
    username: string;
    picture?: string | null;
}

interface ChatMessage {
    id?: number;
    type?: 'newMessage' | 'message_sent_ack' | 'error' | 'auth_success';
    fromUserId?: number;
    fromUsername?: string;
    toUserId?: number;
    content: string;
    timestamp?: string;
    message?: string; // For error or info messages from server
    user?: User;      // For auth_success payload from server
    messageId?: number; // For message_sent_ack
}

let socket: WebSocket | null = null;
let currentUserId: number | null = null; // Will be set by 'auth_success' from server
let currentPeer: User | null = null;

// DOM Elements
let chatUserListEl: HTMLElement | null;
let chatMessagesAreaEl: HTMLElement | null;
let chatMessageInputEl: HTMLInputElement | null;
let chatSendBtnEl: HTMLButtonElement | null;
let chatWithUserEl: HTMLElement | null;

export function initializeChatSystem() {
    console.log("Initializing Chat System...");

    chatUserListEl = document.getElementById('chatUserList');
    chatMessagesAreaEl = document.getElementById('chatMessagesArea');
    chatMessageInputEl = document.getElementById('chatMessageInput') as HTMLInputElement;
    chatSendBtnEl = document.getElementById('chatSendBtn') as HTMLButtonElement;
    chatWithUserEl = document.getElementById('chatWithUser');

    if (!chatUserListEl || !chatMessagesAreaEl || !chatMessageInputEl || !chatSendBtnEl || !chatWithUserEl) {
        console.error("Chat UI elements not found! Cannot initialize chat system.");
        return;
    }

    // Attempt to connect WebSocket. Backend will handle auth via HttpOnly cookie.
    connectWebSocket();

    chatSendBtnEl.addEventListener('click', sendMessage);
    chatMessageInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !chatSendBtnEl?.disabled) {
            sendMessage();
        }
    });

    chatUserListEl.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        // Ensure we're clicking on a direct LI child or a span inside it
        const listItem = target.closest('li');
        if (listItem && listItem.parentElement === chatUserListEl && listItem.dataset.userId) {
            const userId = parseInt(listItem.dataset.userId, 10);
            const username = listItem.dataset.username || "User"; // Use a data attribute for username
            const picture = listItem.dataset.userPicture || null;
            selectUserToChatWith({ id: userId, username, picture });
        }
    });
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log("Chat: WebSocket already open or connecting.");
        return;
    }

    console.log("Chat: Attempting to establish WebSocket connection...");
    socket = new WebSocket('ws://localhost:3000/ws/chat'); // Ensure backend is on port 3000

    socket.onopen = () => {
        console.log("Chat: WebSocket Connection Opened! Waiting for server to authenticate via cookie.");
        // Client no longer sends an explicit auth message with token.
        // Backend will authenticate using HttpOnly cookie sent with the upgrade request.
    };

    socket.onmessage = (event) => {
        try {
            const message: ChatMessage = JSON.parse(event.data as string);
            console.log("Chat: Received message:", message);

            if (message.type === 'auth_success' && message.user) {
                currentUserId = message.user.userId; // Ensure this matches backend payload key
                console.log(`Chat: Authenticated successfully as ${message.user.username} (ID: ${currentUserId})`);
                
                if (currentUserId) {
                    loadUserList(); // Load user list now that WS is confirmed authenticated by server
                } else {
                    console.error("Chat: currentUserId is not set after auth_success. Cannot load user list.");
                }
            } else if (message.type === 'newMessage') {
                if (message.fromUserId === currentPeer?.id || (message.toUserId === currentUserId && message.fromUserId === currentPeer?.id)) {
                    displayMessage(message);
                } else {
                    console.log("Chat: Received message for a different or non-selected conversation.", message);
                    // TODO: Implement notifications for new messages from other users not currently in view
                }
            } else if (message.type === 'message_sent_ack') {
                console.log("Chat: Message acknowledged by server", message);
                // Optionally update UI, e.g., change a "sending..." indicator to "sent"
            } else if (message.type === 'error') {
                console.error("Chat: Server sent an error:", message.message);
                if (message.message && (message.message.toLowerCase().includes("authentication required") || message.message.toLowerCase().includes("authentication failed"))) {
                    alert("Chat session could not be established or was terminated. Please ensure you are logged in.");
                    // Optionally disable chat UI elements further
                }
            }
        } catch (e) {
            console.error("Chat: Error processing message from server", e, event.data);
        }
    };

    socket.onerror = (error) => {
        console.error("Chat: WebSocket Error:", error);
        // Suggest re-login if it seems like an auth or persistent connection issue
        // alert("Chat connection error. Please try logging out and back in.");
    };

    socket.onclose = (event) => {
        console.log("Chat: WebSocket Connection Closed:", event.code, event.reason);
        socket = null; 
        currentUserId = null; // Reset authentication status
        currentPeer = null;   // Reset current conversation peer

        // Disable chat input when disconnected
        if (chatMessageInputEl) chatMessageInputEl.disabled = true;
        if (chatSendBtnEl) chatSendBtnEl.disabled = true;
        if (chatWithUserEl) chatWithUserEl.textContent = "Chat disconnected. Please log in.";
        if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs">Disconnected</li>'; // Update user list
    };
}

async function loadUserList() {
    if (!chatUserListEl) {
        console.error("Chat: chatUserListEl not found, cannot load users.");
        return;
    }
    // currentUserId should be set if WebSocket is authenticated
    if (!currentUserId) {
        console.warn("Chat: Not authenticated via WebSocket (currentUserId not set). Cannot load user list securely.");
        // Although API call relies on cookie, this client-side check is good.
        chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs">Authentication pending...</li>';
        return;
    }

    console.log("Chat: Attempting to load user list via API.");
    try {
        const response = await fetch('/api/chat/users', {
            method: 'GET',
            credentials: 'include', // Crucial for sending HttpOnly auth_token cookie
            headers: {
                // 'Content-Type': 'application/json' // Not needed for GET
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text(); // Get error text for logging
            console.error("Chat: Failed to load user list", response.status, errorText);
            if (chatUserListEl) chatUserListEl.innerHTML = `<li class="text-red-400 text-xs">Error loading users: ${response.status}</li>`;
            if (response.status === 401) {
                 alert("Chat: Session expired or unauthorized for user list. Please log in again.");
            }
            return;
        }

        const users: User[] = await response.json();
        chatUserListEl.innerHTML = ''; // Clear existing list
        if (users.length === 0) {
            chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">No other users available.</li>';
        } else {
            users.forEach(user => {
                const li = document.createElement('li');
                // Store username in a data attribute as well for easier retrieval
                li.dataset.username = user.username; 
                li.dataset.userId = user.id.toString();
                if (user.picture) li.dataset.userPicture = user.picture;
                
                li.className = 'p-1.5 hover:bg-slate-700 cursor-pointer rounded text-xs flex items-center space-x-2';
                
                // Optional: Add picture element
                if (user.picture) {
                    const img = document.createElement('img');
                    img.src = user.picture;
                    img.alt = user.username;
                    img.className = 'w-5 h-5 rounded-full object-cover';
                    li.appendChild(img);
                } else {
                    // Placeholder icon if no picture
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-xs text-slate-300';
                    placeholder.textContent = user.username.substring(0,1).toUpperCase();
                    li.appendChild(placeholder);
                }
                const nameSpan = document.createElement('span');
                nameSpan.textContent = user.username;
                li.appendChild(nameSpan);

                chatUserListEl?.appendChild(li);
            });
        }
    } catch (error) { // Catches network errors or issues with response.json() if response wasn't JSON
        console.error("Chat: Error loading user list (exception):", error);
        if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-red-400 text-xs">Failed to load users.</li>';
    }
}

async function selectUserToChatWith(user: User) {
    if (!currentUserId || !chatMessagesAreaEl || !chatWithUserEl || !chatMessageInputEl || !chatSendBtnEl) {
        console.warn("Chat: Cannot select user to chat, not authenticated or UI elements missing.");
        return;
    }
    
    currentPeer = user;
    chatWithUserEl.textContent = `Chat with ${user.username}`;
    chatMessagesAreaEl.innerHTML = ''; 
    chatMessageInputEl.disabled = false;
    chatSendBtnEl.disabled = false;
    chatMessageInputEl.placeholder = `Message ${user.username}...`
    chatMessageInputEl.focus();

    // Highlight selected user in the list
    if (chatUserListEl) {
        Array.from(chatUserListEl.children).forEach(child => {
            const li = child as HTMLLIElement;
            if (li.dataset.userId === user.id.toString()) {
                li.classList.add('bg-mblue', 'text-white'); // Your selection color
            } else {
                li.classList.remove('bg-mblue', 'text-white');
            }
        });
    }

    console.log(`Chat: Selected user ${user.username} (ID: ${user.id}). Fetching history...`);

    try {
        const response = await fetch(`/api/chat/history/${user.id}`, {
            method: 'GET',
            credentials: 'include', // Crucial for sending HttpOnly auth_token cookie
            headers: {}, 
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Chat: Failed to load chat history", response.status, errorText);
            if (chatMessagesAreaEl) chatMessagesAreaEl.innerHTML = `<div class="text-center text-red-400 text-xs">Error loading history: ${response.status}</div>`;
            if (response.status === 401) {
                 alert("Chat: Session expired or unauthorized for history. Please log in again.");
            }
            return;
        }
        const history: ChatMessage[] = await response.json();
        history.forEach(msg => displayMessage(msg));
    } catch (error) {
        console.error("Chat: Error loading chat history (exception):", error);
        if (chatMessagesAreaEl) chatMessagesAreaEl.innerHTML = `<div class="text-center text-red-400 text-xs">Failed to load history.</div>`;
    }
}

function sendMessage() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentPeer || !chatMessageInputEl || !currentUserId) {
        console.error("Chat: Cannot send message. WebSocket not open, no peer selected, or not authenticated.");
        alert("Chat connection is not active or no user selected.");
        return;
    }
    const content = chatMessageInputEl.value.trim();
    if (content === '') return;

    const messageToSendPayload = {
        type: "privateMessage",
        toUserId: currentPeer.id,
        content: content,
    };

    socket.send(JSON.stringify(messageToSendPayload));
    console.log("Chat: Sent private message payload:", messageToSendPayload);

    // Optimistically display the message
    const optimisticMessage: ChatMessage = {
        fromUserId: currentUserId,
        fromUsername: "You",
        toUserId: currentPeer.id,
        content: content,
        timestamp: new Date().toISOString()
    };
    displayMessage(optimisticMessage);

    chatMessageInputEl.value = '';
    chatMessageInputEl.focus();
}

function displayMessage(msg: ChatMessage) {
    if (!chatMessagesAreaEl) return;

    const messageDiv = document.createElement('div');
    const messageBubble = document.createElement('div'); // Changed span to div for better block behavior
    messageBubble.textContent = msg.content;
    // Basic styling, can be enhanced
    messageBubble.className = 'border-b border-[#4cb4e7] px-3 py-1.5 font-bold text-xs inline-block max-w-[80%] break-words shadow'; 

    if (msg.fromUserId === currentUserId) { // Message from self
        messageDiv.className = 'flex justify-end my-1.5'; // Use flex for alignment
        messageBubble.classList.add('text-[#8be076]'); 
    } else { // Message from peer
        messageDiv.className = 'flex justify-start my-1.5';
        messageBubble.classList.add('text-[#f8aab6]'); 
    }
    messageDiv.appendChild(messageBubble);
    chatMessagesAreaEl.appendChild(messageDiv);
    chatMessagesAreaEl.scrollTop = chatMessagesAreaEl.scrollHeight; // Scroll to bottom
}