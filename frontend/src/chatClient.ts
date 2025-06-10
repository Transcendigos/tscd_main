import { DesktopWindow } from "./DesktopWindow.js";

interface User {
    id: number;
    username: string;
    picture?: string | null;
}

interface ActiveChatWindow {
    peer: User;
    windowInstance: DesktopWindow;
    messagesArea: HTMLElement;
    inputField: HTMLInputElement;
    sendButton: HTMLButtonElement;
}
const activePrivateChats = new Map<number, ActiveChatWindow>();

interface ChatMessage {
    id?: number;
    type?: 'newMessage' | 'message_sent_ack' | 'error' | 'auth_success';
    fromUserId?: number;
    fromUsername?: string;
    toUserId?: number;
    content: string;
    timestamp?: string;
    message?: string;
    user?: User;
    messageId?: number;
}


const userPlaceholderColors: string[] = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500'
];

let socket: WebSocket | null = null;
let currentUserId: number | null = null;
let currentUsername: string | null = null;

let chatUserListEl: HTMLElement | null;
let chatWithUserEl: HTMLElement | null; // Main chat window's header (for "General Chat" title)

export function initializeChatSystem() {
    console.log("Initializing Chat System (for dynamic windows)...");

    chatUserListEl = document.getElementById('chatUserList');
    chatWithUserEl = document.getElementById('chatWithUser'); // For main window's "General Chat" title

    if (!chatUserListEl) {
        console.error("Main Chat User List element not found! Cannot initialize chat system.");
        return;
    }

    connectWebSocket();

    chatUserListEl.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const listItem = target.closest('li');
        if (listItem && listItem.parentElement === chatUserListEl && listItem.dataset.userId) {
            const userId = parseInt(listItem.dataset.userId, 10);
            const username = listItem.dataset.username || "User";
            const picture = listItem.dataset.userPicture || null;
            
            if (currentUserId && userId === currentUserId) {
                console.log("Chat: Cannot open a private chat with yourself.");
                return;
            }
            launchPrivateChatWindow({ id: userId, username, picture });
        }
    });
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log("Chat: WebSocket already open or connecting.");
        return;
    }

    console.log("Chat: Attempting to establish WebSocket connection...");
    socket = new WebSocket('ws://localhost:3000/ws/chat');

    socket.onopen = () => {
        console.log("Chat: WebSocket Connection Opened! Waiting for server to authenticate via cookie.");
    };

    socket.onmessage = (event) => {
        try {
            const message: ChatMessage = JSON.parse(event.data as string);
            console.log("Chat: Received message:", message);

            if (message.type === 'auth_success' && message.user) {
                currentUserId = message.user.userId;
                currentUsername = message.user.username;
                console.log(`Chat: Authenticated successfully as ${message.user.username} (ID: ${currentUserId})`);
                if (currentUserId) {
                    loadUserList();
                } else {
                    console.error("Chat: currentUserId is not set after auth_success. Cannot load user list.");
                }
            } else if (message.type === 'userOnline') {
                console.log("Chat: User came online, reloading user list:", message.user);
                loadUserList();
            } else if (message.type === 'userOffline') {
                console.log("Chat: User went offline, reloading user list:", message.user);
                loadUserList(); 
            } else if (message.type === 'newMessage') {
                const relevantPeerId = (message.fromUserId === currentUserId) 
                                       ? message.toUserId 
                                       : message.fromUserId;
                
                if (!relevantPeerId) {
                    console.warn("Chat: Received newMessage without a clear peer ID.", message);
                    return;
                }

                const chatInfo = activePrivateChats.get(relevantPeerId);
                if (chatInfo) {
                    displayMessageInWindow(message, chatInfo.messagesArea, relevantPeerId);
                    if (!chatInfo.windowInstance.isVisible()) { // Check if DesktopWindow has isVisible()
                        console.log(`Notification: New message from ${message.fromUsername || 'user ' + relevantPeerId}`);
                        const dragHandle = document.getElementById(`privateChatDragHandle_${relevantPeerId}`);
                        if (dragHandle) {
                           dragHandle.style.animation = 'pulseBorder 1.5s infinite';
                           // Add CSS for @keyframes pulseBorder if you want this visual effect
                        }
                    }
                } else {
                    console.log(`Chat: Rcvd message for user ID ${relevantPeerId}, no window open. User: ${message.fromUsername}`, message);
                    if (message.fromUserId && message.fromUsername && message.fromUserId !== currentUserId) {
                        alert(`New message from ${message.fromUsername || 'a user'}! Open their chat from the user list to see it.`);
                    }
                }
            } else if (message.type === 'message_sent_ack') {
                console.log("Chat: Message acknowledged by server", message);
            } else if (message.type === 'error') {
                console.error("Chat: Server sent an error:", message.message);
                if (message.message && (message.message.toLowerCase().includes("authentication required") || message.message.toLowerCase().includes("authentication failed"))) {
                    alert("Chat session could not be established or was terminated. Please ensure you are logged in.");
                }
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
        socket = null; 
        currentUserId = null;
        
        activePrivateChats.forEach(chatInfo => {
            if(chatInfo.inputField) chatInfo.inputField.disabled = true;
            if(chatInfo.sendButton) chatInfo.sendButton.disabled = true;
            const headerSpan = chatInfo.windowInstance.element?.querySelector(`#privateChatDragHandle_${chatInfo.peer.id} span .font-bold`); // More specific selector
            if (headerSpan) (headerSpan as HTMLElement).textContent = `Chat with ${chatInfo.peer.username} (Disconnected)`;
        });
        if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">Chat disconnected. Please refresh or log in.</li>';
        if (chatWithUserEl) chatWithUserEl.textContent = "Chat Disconnected";
    };
}

async function loadUserList() {
    if (!chatUserListEl) {
        console.error("Chat: chatUserListEl not found, cannot load users.");
        return;
    }
    if (!currentUserId) {
        console.warn("Chat: Not authenticated via WebSocket (currentUserId not set). Cannot load user list.");
        chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">Authentication pending...</li>';
        return;
    }

    console.log("Chat: Attempting to load user list via API.");
    try {
        const response = await fetch('/api/chat/users', {
            method: 'GET',
            credentials: 'include',
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Chat: Failed to load user list", response.status, errorText);
            if (chatUserListEl) chatUserListEl.innerHTML = `<li class="text-red-400 text-xs p-1.5">Error loading users: ${response.status}</li>`;
            if (response.status === 401) {
                 alert("Chat: Session expired or unauthorized for user list. Please log in again.");
            }
            return;
        }

        const users: User[] = await response.json();
        chatUserListEl.innerHTML = '';
        if (users.length === 0) {
            chatUserListEl.innerHTML = '<li class=" text-xs p-1.5">No other users available.</li>';
        } else {
            users.forEach(user => {
                const li = document.createElement('li');
                li.dataset.username = user.username; 
                li.dataset.userId = user.id.toString();
                if (user.picture) li.dataset.userPicture = user.picture;
                
                li.className = 'p-1.5 hover:bg-slate-700 cursor-pointer text-xs flex items-center space-x-2';
                

                // -------- REMOVED FROM NOW DUE TO ISSUE WITH GOOGLE PP --------
                // if (user.picture) {
                //     const img = document.createElement('img');
                //     img.src = user.picture;
                //     img.alt = user.username;
                //     img.className = 'w-5 h-5 object-cover pointer-events-none';
                //     li.appendChild(img);
                // } else {
                //     const placeholder = document.createElement('div');
                //     placeholder.className = 'w-5 h-5 bg-slate-500 flex items-center justify-center text-xs text-slate-300 pointer-events-none';
                //     placeholder.textContent = user.username.substring(0,1).toUpperCase();
                //     li.appendChild(placeholder);
                // }



                const colorIndex = user.id % userPlaceholderColors.length;
                const selectedBgColor = userPlaceholderColors[colorIndex];

                const placeholder = document.createElement('div');
                placeholder.className = `w-5 h-5 flex items-center justify-center text-xs text-slate-900 pointer-events-none flex-shrink-0 ${selectedBgColor}`;
                placeholder.textContent = user.username.substring(0,1).toUpperCase();
                li.appendChild(placeholder);




                const nameSpan = document.createElement('span');
                nameSpan.textContent = user.username;
                nameSpan.className = 'pointer-events-none';
                li.appendChild(nameSpan);

                chatUserListEl?.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Chat: Error loading user list (exception):", error);
        if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-red-400 text-xs p-1.5">Failed to load users.</li>';
    }
}

function createPrivateChatWindowHtml(peerUser: User): string {
    const peerId = peerUser.id;
    const peerUsername = (peerUser.username || 'User').replace(/[&<>"']/g, (match) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]!;
    });

    return `
        <div id="privateChatWindow_${peerId}"
             class="border-2 w-[450px] text-sm flex flex-col
                    bg-slate-900/60 
                    absolute left-1/3 top-1/3 transform -translate-x-1/2 -translate-y-1/2 
                    transition-all duration-300 ease-in-out backdrop-blur-xs
                    opacity-0 scale-95 invisible pointer-events-none drop-shadow-xl/30"
             style="width: 300px; height: 350px; min-width: 300px; min-height: 350px; max-width: 600px; max-height: 80vh;">

            <div id="privateChatDragHandle_${peerId}"
                 class="bg-slate-900/50 px-1.5 py-1 flex items-center justify-between border-b-2 cursor-grab active:cursor-grabbing select-none">
                <div class="flex items-center space-x-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="font-bold">Chat with ${peerUsername}</span>
                </div>
                <button aria-label="Close private chat with ${peerUsername}" id="closePrivateChatBtn_${peerId}"
                        class="w-5 h-5 border flex items-center justify-center font-bold hover-important transition-colors">
                    X
                </button>
            </div>

            <div class="flex-grow p-2 overflow-y-auto space-y-2 divide-y divide-slate-600/60" id="privateMessagesArea_${peerId}">
            </div>

            <div class="p-2 border-t">
                <div class="flex space-x-2">
                    <input type="text" id="privateMessageInput_${peerId}" placeholder="Message ${peerUsername}..."
                           class="flex-grow p-1.5 bg-slate-900 border text-xs focus:ring-1 focus:ring-[#4cb4e7] focus:border-[#4cb4e7] outline-none" />
                    <button id="privateSendBtn_${peerId}"
                            class="border px-3 py-1.5 font-bold tracking-wider hover:bg-[#8be076] hover:text-slate-900 transition-colors text-xs">
                        SEND
                    </button>
                </div>
            </div>

            <div id="privateChatResizeHandle_${peerId}" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 opacity-50 hover:opacity-100 transition-opacity">
            </div>
        </div>`;
}

async function launchPrivateChatWindow(peerUser: User) {
    console.log(`%c[LaunchWindow] Attempting for ${peerUser.username} (ID: ${peerUser.id}). Is window already in activePrivateChats? ${activePrivateChats.has(peerUser.id)}`, "color: purple; font-weight: bold;");

    if (activePrivateChats.has(peerUser.id)) {
        const existingChat = activePrivateChats.get(peerUser.id);
        if (existingChat) {
            existingChat.windowInstance.open();
            console.log(`Chat: Window for ${peerUser.username} already open. Focusing.`);
            existingChat.inputField.focus();
        }
        return;
    }

    console.log(`Chat: Launching NEW private chat window for ${peerUser.username} (ID: ${peerUser.id})`);

    const windowHtml = createPrivateChatWindowHtml(peerUser);
    const mainElement = document.getElementById('main');
    if (!mainElement) {
        console.error("Main element ('main') not found to append chat window!");
        return;
    }

    mainElement.insertAdjacentHTML('beforeend', windowHtml);

    requestAnimationFrame(async () => {
        const windowId = `privateChatWindow_${peerUser.id}`;
        const dragHandleId = `privateChatDragHandle_${peerUser.id}`;
        const closeButtonId = `closePrivateChatBtn_${peerUser.id}`;
        const resizeHandleId = `privateChatResizeHandle_${peerUser.id}`;
        const messagesAreaId = `privateMessagesArea_${peerUser.id}`;
        const inputFieldId = `privateMessageInput_${peerUser.id}`;
        const sendButtonId = `privateSendBtn_${peerUser.id}`;

        const newWindowElement = document.getElementById(windowId);
        const dragHandleElement = document.getElementById(dragHandleId);
        const closeButtonElement = document.getElementById(closeButtonId);
        const resizeHandleElement = document.getElementById(resizeHandleId);
        const visibilityToggleElementForPrivateChat = newWindowElement; 

        if (!newWindowElement || !dragHandleElement || !closeButtonElement || !visibilityToggleElementForPrivateChat || !resizeHandleElement ) {
            console.error(`[Debug] Essential elements for DesktopWindow missing for ${windowId}.`);
            const elToRemoveOnFailure = document.getElementById(windowId);
            if (elToRemoveOnFailure) elToRemoveOnFailure.remove();
            return;
        }

        try {
            const newWindowInstance = new DesktopWindow({
                windowId: windowId,
                dragHandleId: dragHandleId,
                resizeHandleId: resizeHandleId, 
                closeButtonId: closeButtonId,
                boundaryContainerId: "main",
                visibilityToggleId: windowId,
                initialShow: false, 
                onCloseCallback: () => {
                    const chatInfo = activePrivateChats.get(peerUser.id);
                    if (chatInfo && chatInfo.windowInstance.element) {
                        chatInfo.windowInstance.element.remove();
                    }
                    activePrivateChats.delete(peerUser.id);
                    console.log(`Chat: Closed and DOM element removed for private chat window with ${peerUser.username}`);
                }
            });
            
            newWindowInstance.open();

            const messagesArea = document.getElementById(messagesAreaId) as HTMLElement;
            const inputField = document.getElementById(inputFieldId) as HTMLInputElement;
            const sendButton = document.getElementById(sendButtonId) as HTMLButtonElement;

            if (!messagesArea || !inputField || !sendButton) {
                console.error(`Chat: Could not find all interactive chat sub-elements for private chat window with ${peerUser.username}. WindowId: ${windowId}`);
                newWindowElement.remove();
                return;
            }

            activePrivateChats.set(peerUser.id, {
                peer: peerUser,
                windowInstance: newWindowInstance,
                messagesArea: messagesArea,
                inputField: inputField,
                sendButton: sendButton
            });

            sendButton.addEventListener('click', () => {
                sendMessageToPeer(peerUser, inputField.value);
                inputField.value = '';
                inputField.focus();
            });
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !sendButton.disabled) {
                    sendMessageToPeer(peerUser, inputField.value);
                    inputField.value = '';
                }
            });
            
            await loadChatHistoryForWindow(peerUser, messagesArea); 
            inputField.focus();
            console.log(`%c[Debug] Successfully set up private chat window for ${peerUser.username}`, "color: green;");

        } catch (error) {
            console.error(`Error initializing DesktopWindow or setting up private chat for ${peerUser.username}:`, error);
            const elToRemoveOnCatch = document.getElementById(windowId);
            if (elToRemoveOnCatch) elToRemoveOnCatch.remove();
        }
    });
}

async function loadChatHistoryForWindow(peerUser: User, messagesArea: HTMLElement) {
    console.log(`%c[LoadHistory] For ${peerUser.username} (ID: ${peerUser.id}). Target messagesArea:`, "color: blue; font-weight: bold;", messagesArea);

    if (!currentUserId) {
        console.warn("Chat: Cannot load history, current user not authenticated (currentUserId is null).");
        messagesArea.innerHTML = '<div class="text-center text-xs text-red-400 p-2">Authentication error.</div>';
        return;
    }
    
    messagesArea.innerHTML = '<div class="text-center text-xs text-slate-400 p-2">Loading history...</div>';
    try {
        const response = await fetch(`/api/chat/history/${peerUser.id}`, {
            method: 'GET',
            credentials: 'include',
        });

        console.log(`%c[LoadHistory] Response status for ${peerUser.username}: ${response.status}`, "color: blue;");

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Chat: Failed to load chat history for ${peerUser.username}`, response.status, errorText);
            messagesArea.innerHTML = `<div class="text-center text-red-400 text-xs p-2">Error loading history: ${response.status}</div>`;
            return;
        }
        
        const rawHistory: any[] = await response.json();
        messagesArea.innerHTML = ''; 
        
        console.log(`%c[LoadHistory] Fetched ${rawHistory.length} raw historical messages for ${peerUser.username}.`, "color: blue;");

        if (rawHistory.length === 0) {
             messagesArea.innerHTML = '<div class="text-center text-xs text-slate-400 p-2">No messages yet. Start the conversation!</div>';
        } else {
            const history: ChatMessage[] = rawHistory.map(rawMsg => ({
                id: rawMsg.id,
                fromUserId: rawMsg.sender_id,
                fromUsername: rawMsg.sender_username,
                toUserId: rawMsg.receiver_id, 
                content: rawMsg.message_content,
                timestamp: rawMsg.timestamp,
                type: 'newMessage'
            }));

            history.forEach(msg => {
                displayMessageInWindow(msg, messagesArea, peerUser.id);
            });
        }
    } catch (error) {
        console.error(`Chat: Exception loading chat history for ${peerUser.username}:`, error);
        messagesArea.innerHTML = `<div class="text-center text-red-400 text-xs p-2">Failed to load history.</div>`;
    }
}


function sendMessageToPeer(peerUser: User, content: string) {
    content = content.trim();
    if (content === '' || !socket || socket.readyState !== WebSocket.OPEN || !currentUserId) {
        console.error("Chat: Cannot send message. Conditions not met.");
        return;
    }

    const messageToSendPayload = {
        type: "privateMessage",
        toUserId: peerUser.id,
        content: content,
    };
    socket.send(JSON.stringify(messageToSendPayload));
    console.log("Chat: Sent private message payload to peer:", peerUser.id, messageToSendPayload);

    const chatInfo = activePrivateChats.get(peerUser.id);
    if (chatInfo) {
        displayMessageInWindow({
            fromUserId: currentUserId,
            fromUsername: currentUsername || "You",
            toUserId: peerUser.id,
            content: content,
            timestamp: new Date().toISOString()
        }, chatInfo.messagesArea, peerUser.id);
    }
}

function displayMessageInWindow(msg: ChatMessage, messagesArea: HTMLElement, peerIdOfThisWindow: number) {
    console.log(`%c[DisplayMessage] msg.fromUserId: ${msg.fromUserId}, currentUserId: ${currentUserId}, peerIdOfThisWindow: ${peerIdOfThisWindow}, fromUsername: ${msg.fromUsername}`, "color: teal");

    if (!messagesArea) {
        console.error("displayMessageInWindow: messagesArea is not valid!");
        return;
    }

    const messageContainerDiv = document.createElement('div');
    const senderInfoDiv = document.createElement('div');
    const messageContentDiv = document.createElement('div');

    senderInfoDiv.textContent = `${msg.fromUsername || 'User'}:`;
    senderInfoDiv.classList.add('text-xs', 'font-bold', 'underline');

    messageContentDiv.textContent = msg.content;
    messageContentDiv.className = 'px-3 text-xs break-all break-words';

    if (msg.fromUserId === currentUserId) {
        messageContainerDiv.className = 'text-[#FFE2BF] flex flex-row items-start my-2 py-2';
        senderInfoDiv.style.color = '#FFE2BF';
    } else if (msg.fromUserId === peerIdOfThisWindow) {
        messageContainerDiv.className = 'flex flex-row items-start my-2 py-2';
    } else {
        console.warn("displayMessageInWindow: Message doesn't match current context.", { msg, peerIdOfThisWindow });
        return; 
    }
    
    messageContainerDiv.appendChild(senderInfoDiv);
    messageContainerDiv.appendChild(messageContentDiv);
    messagesArea.appendChild(messageContainerDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}


export function resetChatSystem() {
    console.log("Chat: Resetting chat system due to logout or auth change.");
    if (socket) {
        socket.onclose = null;
        socket.close(1000, "User logged out");
        socket = null;
    }
    currentUserId = null;
    activePrivateChats.forEach(chatInfo => {
        chatInfo.windowInstance.element?.remove();
    });
    activePrivateChats.clear();
    if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs">Logged out.</li>';
    if (chatWithUserEl) chatWithUserEl.textContent = "Log in to chat";
}