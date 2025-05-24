// frontend/src/chatClient.ts

interface User {
    id: number;
    username: string;
    picture?: string | null;
}

interface ChatMessage {
    id?: number; // Might not be present for messages being sent by client initially
    type?: 'newMessage' | 'message_sent_ack' | 'error' | 'auth_success'; // For server messages
    fromUserId?: number;
    fromUsername?: string;
    toUserId?: number;
    content: string;
    timestamp?: string;
    message?: string; // For error or info messages
    user?: User; // For auth_success
    messageId?: number; // For message_sent_ack
}

let socket: WebSocket | null = null;
let currentUserId: number | null = null;
let currentPeer: User | null = null;
let authToken: string | null = null; // Will be set after user logs in

// DOM Elements (cache them for performance)
let chatUserListEl: HTMLElement | null;
let chatMessagesAreaEl: HTMLElement | null;
let chatMessageInputEl: HTMLInputElement | null;
let chatSendBtnEl: HTMLButtonElement | null;
let chatWithUserEl: HTMLElement | null;

// Function to initialize all chat elements and event listeners
export function initializeChatSystem() {
    console.log("Initializing Chat System...");

    chatUserListEl = document.getElementById('chatUserList');
    chatMessagesAreaEl = document.getElementById('chatMessagesArea');
    chatMessageInputEl = document.getElementById('chatMessageInput') as HTMLInputElement;
    chatSendBtnEl = document.getElementById('chatSendBtn') as HTMLButtonElement;
    chatWithUserEl = document.getElementById('chatWithUser');

    if (!chatUserListEl || !chatMessagesAreaEl || !chatMessageInputEl || !chatSendBtnEl || !chatWithUserEl) {
        console.error("Chat UI elements not found!");
        return;
    }

    // Attempt to get auth token (this needs to be robustly handled based on your auth flow)
    // For now, assume it's stored in localStorage after login, or retrieved from a cookie if possible
    // THIS IS A PLACEHOLDER - you need to integrate with your actual auth token retrieval
    authToken = getAuthToken(); // You'll need to implement getAuthToken()

    if (authToken) {
        connectWebSocket();
        loadUserList();
    } else {
        console.warn("Chat: No auth token found. WebSocket not connected. Please log in.");
        // Optionally disable chat features or show a login prompt within the chat window
    }

    chatSendBtnEl.addEventListener('click', sendMessage);
    chatMessageInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !chatSendBtnEl?.disabled) {
            sendMessage();
        }
    });

    // Event listener for user list (using event delegation)
    chatUserListEl.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target && target.tagName === 'LI' && target.dataset.userId) {
            const userId = parseInt(target.dataset.userId, 10);
            const username = target.textContent || "User";
            const picture = target.dataset.userPicture || null;
            selectUserToChatWith({ id: userId, username, picture });
        }
    });
}

// Placeholder for getting the auth token
// You need to implement this based on how your frontend stores/accesses the JWT
function getAuthToken(): string | null {
    // --- TEMPORARY HARDCODED TOKEN FOR TESTING UserA ---
    const hardcodedUserAToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiSnVsZXMgRml0YSIsImVtYWlsIjoiZml0YWp1bGVzQGdtYWlsLmNvbSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NKN05xTVktRGI1TE5nZzM5Z2lJaEEwOC1MOUNBMDRfdF81R3RiazNVWDFZbXNLY0E9czk2LWMiLCJpYXQiOjE3NDgwOTcwNTAsImV4cCI6MTc0ODcwMTg1MH0.3BkeiYZSsXgCqjzS2A9Wai450wUjIy3JW-6xkVCoAe8"; // << PASTE YOUR TOKEN HERE

    if (hardcodedUserAToken) {
        console.log("Chat: Using HARDCODED auth token for testing UserA.");
        return hardcodedUserAToken;
    }
    // --- END TEMPORARY HARDCODED TOKEN ---


    // Original logic (commented out for now during testing)
    /*
    const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
    if (match) return match[2];

    console.warn("getAuthToken: Could not retrieve auth token. Implement this properly.");
    */

    // If hardcoded token is somehow empty, return null to prevent errors
    console.warn("getAuthToken: Hardcoded token is missing. Please paste a valid token.");
    return null;
}


function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log("Chat: WebSocket already open or connecting.");
        return;
    }
    if (!authToken) {
        console.error("Chat: Cannot connect WebSocket without auth token.");
        return;
    }

    socket = new WebSocket('ws://localhost:3000/ws/chat'); // Ensure backend is on port 3000

    socket.onopen = () => {
        console.log("Chat: WebSocket Connection Opened!");
        if (socket && authToken) {
            socket.send(JSON.stringify({ type: "auth", token: authToken }));
            console.log("Chat: Sent auth message.");
        }
    };

    socket.onmessage = (event) => {
        try {
            const message: ChatMessage = JSON.parse(event.data as string);
            console.log("Chat: Received message:", message);

            if (message.type === 'auth_success' && message.user) {
                currentUserId = message.user.id;
                console.log(`Chat: Authenticated successfully as ${message.user.username} (ID: ${currentUserId})`);
            } else if (message.type === 'newMessage') {
                // Only display if it's part of the current conversation
                if (message.fromUserId === currentPeer?.id || message.toUserId === currentPeer?.id && message.fromUserId === currentUserId) {
                    displayMessage(message);
                } else {
                    console.log("Chat: Received message for a different conversation or self.", message);
                    // TODO: Implement notifications for new messages from other users
                }
            } else if (message.type === 'message_sent_ack') {
                console.log("Chat: Message acknowledged by server", message);
                // Optionally update UI to show message as "sent" or "delivered"
            } else if (message.type === 'error') {
                console.error("Chat: Server sent an error:", message.message);
                // Display error to user if appropriate
            }
        } catch (e) {
            console.error("Chat: Error processing message from server", e, event.data);
        }
    };

    socket.onerror = (error) => {
        console.error("Chat: WebSocket Error:", error);
    };

    socket.onclose = (event) => {
        console.log("Chat: WebSocket Connection Closed:", event.code, event.reason);
        socket = null; // Clear the socket
        // Optionally try to reconnect after a delay
    };
}

async function loadUserList() {
    if (!authToken || !chatUserListEl) return;
    try {
        const response = await fetch('/api/chat/users', {
            method: 'GET',
            headers: {
                // Cookies are typically sent automatically by the browser for same-origin
                // or if credentials: 'include' is used for cross-origin, but ensure your
                // backend is expecting the cookie for this auth.
            },
        });
        if (!response.ok) {
            console.error("Chat: Failed to load user list", response.status, await response.text());
            if (response.status === 401) alert("Chat: Session expired or unauthorized. Please log in again.");
            return;
        }
        const users: User[] = await response.json();
        chatUserListEl.innerHTML = ''; // Clear existing list
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.username;
            li.dataset.userId = user.id.toString();
            li.dataset.userPicture = user.picture || ''; // Store picture URL if available
            li.className = 'p-1.5 hover:bg-slate-700 cursor-pointer rounded text-xs';
            chatUserListEl?.appendChild(li);
        });
    } catch (error) {
        console.error("Chat: Error loading user list:", error);
    }
}

async function selectUserToChatWith(user: User) {
    if (!authToken || !chatMessagesAreaEl || !chatWithUserEl || !chatMessageInputEl || !chatSendBtnEl) return;
    
    currentPeer = user;
    chatWithUserEl.textContent = `Chat with ${user.username}`;
    chatMessagesAreaEl.innerHTML = ''; // Clear previous messages
    chatMessageInputEl.disabled = false;
    chatSendBtnEl.disabled = false;
    chatMessageInputEl.focus();

    console.log(`Chat: Selected user ${user.username} (ID: ${user.id}). Fetching history...`);

    // Fetch chat history
    try {
        const response = await fetch(`/api/chat/history/${user.id}`, {
            method: 'GET',
            headers: {}, // Cookies sent automatically
        });
        if (!response.ok) {
            console.error("Chat: Failed to load chat history", response.status, await response.text());
             if (response.status === 401) alert("Chat: Session expired or unauthorized for history. Please log in again.");
            return;
        }
        const history: ChatMessage[] = await response.json();
        history.forEach(msg => displayMessage(msg));
    } catch (error) {
        console.error("Chat: Error loading chat history:", error);
    }
}

function sendMessage() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentPeer || !chatMessageInputEl || !currentUserId) {
        console.error("Chat: Cannot send message. WebSocket not open, no peer selected, or not authenticated.");
        return;
    }
    const content = chatMessageInputEl.value.trim();
    if (content === '') return;

    const messageToSend: Partial<ChatMessage> = {
        toUserId: currentPeer.id,
        content: content,
    };

    socket.send(JSON.stringify(messageToSend));
    console.log("Chat: Sent private message:", messageToSend);

    // Optimistically display the message (can be updated with ack later)
    displayMessage({
        fromUserId: currentUserId, // Current user is sending
        fromUsername: "You", // Or fetch current user's username
        toUserId: currentPeer.id,
        content: content,
        timestamp: new Date().toISOString() // Client-side timestamp for immediate display
    });

    chatMessageInputEl.value = ''; // Clear input
}

function displayMessage(msg: ChatMessage) {
    if (!chatMessagesAreaEl) return;

    const div = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = msg.content;
    span.className = 'px-2 py-1 rounded text-xs inline-block max-w-[80%] break-words'; // Basic styling

    if (msg.fromUserId === currentUserId) { // Message from self
        div.className = 'text-right my-1';
        span.classList.add('bg-mblue', 'text-white'); // Your primary blue for sent messages
    } else { // Message from peer
        div.className = 'text-left my-1';
        span.classList.add('bg-slate-600', 'text-slate-50'); // A neutral color for received messages
    }
    div.appendChild(span);
    chatMessagesAreaEl.appendChild(div);
    chatMessagesAreaEl.scrollTop = chatMessagesAreaEl.scrollHeight; // Scroll to bottom
}


// Modify main.ts to call initializeChatSystem after user is known to be logged in
// For now, we can add a button or call it after a delay for testing.
// Better: integrate with your existing checkSignedIn logic.