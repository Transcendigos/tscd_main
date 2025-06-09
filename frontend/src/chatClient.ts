import { DesktopWindow } from "./DesktopWindow.js";

interface User {
  id: number; 
  username: string;
  picture?: string | null;
}

type WebSocketUser = {
    id?: number | string;
    userId?: number | string;
    username: string;
    picture?: string | null;
};

interface ApiUser {
    id: string;
    username: string;
    picture?: string | null;
    isOnline: boolean;
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
  type?: string;
  fromUserId?: number | string;
  fromUsername?: string;
  toUserId?: number | string;
  content?: string;
  timestamp?: string;
  message?: string;
  user?: WebSocketUser;
  users?: (ApiUser)[];
  messageId?: number;
  gameId?: string;
  inviterUsername?: string;
  inviterId?: string;
  initialState?: any;
  yourPlayerId?: string;
  opponentUsername?: string;
  opponentId?: string;
  ball?: any;
  players?: any;
  status?: string;
  winnerId?: string | null;
  scores?: any;
  declinedByUsername?: string;
}

const userPlaceholderColors: string[] = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", 
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];



const openProfileWindows = new Map<number, DesktopWindow>();

let socket: WebSocket | null = null;
let currentUserId: number | null = null; 
let currentUsername: string | null = null;

let chatUserListEl: HTMLElement | null;
let chatWithUserEl: HTMLElement | null;

function getUserIdString(user: WebSocketUser): string | null {
    if (typeof user.id !== 'undefined') return String(user.id);
    if (typeof user.userId !== 'undefined') return String(user.userId);
    return null;
}

export function initializeChatSystem() {
  chatUserListEl = document.getElementById("chatUserList");
  chatWithUserEl = document.getElementById("chatWithUser");

  if (!chatUserListEl) {
    console.error("Main Chat User List element not found! Cannot initialize chat system.");
    return;
  }
  connectWebSocket();

  chatUserListEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const listItem = target.closest("li");
    if (listItem && listItem.parentElement === chatUserListEl && listItem.dataset.userId) {
      const userIdNumeric = parseInt(listItem.dataset.userId, 10);
      const username = listItem.dataset.username || "User";
      const picture = listItem.dataset.userPicture || null;

      if (currentUserId && userIdNumeric === currentUserId) {
        console.log("Chat: Cannot open a private chat with yourself.");
        return;
      }
      launchPrivateChatWindow({ id: userIdNumeric, username, picture });
    }
  });
}

function updateUserStatus(userId: string, isOnline: boolean) {
    const numericId = parseInt(userId.substring(5), 10);
    if (isNaN(numericId)) return;

    const statusIndicator = document.getElementById(`chat-user-status-${numericId}`);
    if (statusIndicator) {
        statusIndicator.style.display = isOnline ? 'block' : 'none';
    }
}


async function showUserProfile(user: User) {
    if (openProfileWindows.has(user.id)) {
        openProfileWindows.get(user.id)?.open();
        return;
    }

    const res = await fetch(`/api/profile/${user.id}`, { credentials: 'include' });
    if (!res.ok) {
        alert("Could not fetch user profile.");
        return;
    }
    const { profile } = await res.json();

    const profileWindowHtml = `
    <div id="userProfileWindow_${user.id}" class="border-2 border-[#8be076] w-[350px] text-[#4cb4e7] text-sm flex flex-col bg-slate-900/80 backdrop-blur-sm absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out opacity-0 scale-95 invisible pointer-events-none" style="min-width: 300px; min-height: 150px;">
      <div id="userProfileDragHandle_${user.id}" class="px-1.5 py-1 flex items-center justify-between border-b-2 border-[#8be076] cursor-grab active:cursor-grabbing select-none">
        <span class="font-bold">${profile.username}'s Profile</span>
        <button id="closeUserProfileBtn_${user.id}" class="w-5 h-5 border border-[#8be076] flex items-center justify-center font-bold hover:bg-[#f8aab6] hover:text-slate-900 transition-colors">X</button>
      </div>
      <div class="flex-grow p-4 flex items-center space-x-4 bg-slate-800/50">
        <img src="${profile.picture || '/favicon.jpg'}" onerror="this.onerror=null;this.src='/favicon.jpg';" class="w-20 h-20 rounded-full object-cover border-2 border-[#8be076]">
        <div class="space-y-1">
            <p class="text-xl font-bold text-white">${profile.username}</p>
            <p class="text-sm text-slate-300">${profile.email}</p>
        </div>
      </div>
      <div id="userProfileResizeHandle_${user.id}" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"></div>
    </div>`;

    document.getElementById("main")?.insertAdjacentHTML('beforeend', profileWindowHtml);
    
    const newProfileWindow = new DesktopWindow({
        windowId: `userProfileWindow_${user.id}`,
        dragHandleId: `userProfileDragHandle_${user.id}`,
        resizeHandleId: `userProfileResizeHandle_${user.id}`,
        closeButtonId: `closeUserProfileBtn_${user.id}`,
        boundaryContainerId: 'main',
        visibilityToggleId: `userProfileWindow_${user.id}`,
        onCloseCallback: () => {
            openProfileWindows.delete(user.id);
            document.getElementById(`userProfileWindow_${user.id}`)?.remove();
        }
    });

    openProfileWindows.set(user.id, newProfileWindow);
    newProfileWindow.open();
}


export function sendPongPlayerInput(gameId: string, input: 'up' | 'down' | 'stop_up' | 'stop_down') {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = { type: 'PONG_PLAYER_INPUT', gameId, input };
    socket.send(JSON.stringify(payload));
  } else {
    console.error('WebSocket not connected. Cannot send PONG_PLAYER_INPUT.');
  }
}

export function sendPongPlayerReady(gameId: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      type: 'PONG_PLAYER_READY',
      gameId: gameId,
    };
    socket.send(JSON.stringify(payload));
    console.log(`[CHATCLIENT] Sent PONG_PLAYER_READY for gameId: ${gameId}`);
  } else {
    console.error('[CHATCLIENT] WebSocket not connected. Cannot send PONG_PLAYER_READY.');
  }
}

function sendPongJoinGame(gameId: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = { type: "PONG_JOIN_GAME", gameId: gameId };
    socket.send(JSON.stringify(payload));
    console.log(`Sent PONG_JOIN_GAME for gameId: ${gameId}`);
    // alert(`Joining Pong game: ${gameId}. Waiting for game to start...`);
  } else {
    console.error("WebSocket not connected. Cannot send PONG_JOIN_GAME.");
    alert('Error: Not connected to server to join game.');
  }
}

async function handleInvitePlayerToPong(opponent: User) {
  if (!opponent || typeof opponent.id === 'undefined') {
    console.error("[Frontend] Invalid opponent data for Pong invite:", opponent);
    alert("Cannot invite player: invalid opponent data.");
    return;
  }
  const opponentPlayerIdForAPI = `user_${opponent.id}`; 

  console.log(`[Frontend] handleInvitePlayerToPong called for opponent:`, opponent, `API ID: ${opponentPlayerIdForAPI}`);
  try {
    console.log('[Frontend] Before fetch to /api/pong/games');
    const response = await fetch('/api/pong/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponentPlayerId: opponentPlayerIdForAPI })
    });
    console.log('[Frontend] After fetch, response status:', response.status);
    const responseData = await response.json().catch(err => {
        console.error('[Frontend] Failed to parse response JSON:', err);
        return { error: "Failed to parse server response.", detail: "Response was not valid JSON." };
    });
    console.log('[Frontend] Response data from /api/pong/games:', responseData);

    if (response.ok) {
      const gameId = responseData.gameId;
      if (gameId) {
        console.log(`[Frontend] Game created with ID: ${gameId}. Inviter sending PONG_JOIN_GAME.`);
        // alert(`Pong invitation sent to ${opponent.username}! Starting game room...`);
        sendPongJoinGame(gameId);
      } else {
        console.error("[Frontend] Game created, but no gameId in response:", responseData);
        alert(`Error starting game: ${responseData.message || 'No game ID returned from server.'}`);
      }
    } else {
      console.error("[Frontend] Failed to create game. API error. Status:", response.status, "Response Data:", responseData);
      alert(`Error inviting to game: ${responseData.error || response.statusText || `Server error: ${response.status}`}`);
    }
  } catch (error) {
    console.error("[Frontend] Network or unexpected error in handleInvitePlayerToPong:", error);
    alert("Could not contact server to invite player to game. Please try again.");
  }
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("Chat: WebSocket already open or connecting.");
    return;
  }
  console.log("Chat: Attempting to establish WebSocket connection...");
  socket = new WebSocket("ws://localhost:3000/ws/chat");

  socket.onopen = () => {
    console.log("Chat: WebSocket Connection Opened! Waiting for server to authenticate via cookie.");
  };

  socket.onmessage = (event) => {

    try {
      const message: ChatMessage & { users?: (User & { isOnline?: boolean })[] } = JSON.parse(event.data as string);

      if (message.type === 'auth_success') {
          if (message.user) {
              const userIdStr = getUserIdString(message.user);
              const numericId = userIdStr ? parseInt(userIdStr.replace('user_', ''), 10) : null;
              
              if (numericId) {
                  currentUserId = numericId;
                  currentUsername = message.user.username || null;
                  console.log(`Chat: Authenticated successfully as ${currentUsername} (Numeric ID: ${currentUserId})`);
                  loadUserList();
              } else {
                  console.error("Chat: Unparseable userId in auth_success:", message.user);
              }
          }
      } else if (message.type === 'userOnline') {
          if (message.user) {
              const userIdStr = getUserIdString(message.user);
              if (userIdStr) {
                  updateUserStatus(userIdStr, true);
              }
          }
          loadUserList();
      } else if (message.type === 'userOffline') {
            if (message.user) {
                const userIdStr = getUserIdString(message.user);
                 if (userIdStr) {
                    updateUserStatus(userIdStr, false);
                }
            }
            loadUserList();
        } else if (message.type === 'newMessage') {
        let numericSenderId: number | null = null;
        if (typeof message.fromUserId === 'string' && message.fromUserId.startsWith('user_')) {
          numericSenderId = parseInt(message.fromUserId.substring(5), 10);
        } else if (typeof message.fromUserId === 'number') {
          numericSenderId = message.fromUserId;
        }

        let numericReceiverId: number | null = null;
        if (typeof message.toUserId === 'string' && message.toUserId.startsWith('user_')) {
          numericReceiverId = parseInt(message.toUserId.substring(5), 10);
        } else if (typeof message.toUserId === 'number') {
          numericReceiverId = message.toUserId;
        }

        if (numericSenderId === null || isNaN(numericSenderId)) {
          console.warn("Chat: Received newMessage with unparseable fromUserId.", message);
          return;
        }

        let numericPeerIdForMapLookup: number | null = null;
        if (numericSenderId === currentUserId) {
          numericPeerIdForMapLookup = numericReceiverId;
        } else if (numericReceiverId === currentUserId) {
          numericPeerIdForMapLookup = numericSenderId;
        } else {
          console.warn("Chat: Received newMessage not directly involving current user.", message, currentUserId);
          return;
        }
        
        if (numericPeerIdForMapLookup === null || isNaN(numericPeerIdForMapLookup)) {
          console.warn("Chat: Could not determine relevant numeric peer ID for newMessage.", message);
          return;
        }

        const chatInfo = activePrivateChats.get(numericPeerIdForMapLookup);
        if (chatInfo) {
          displayMessageInWindow(message, chatInfo.messagesArea, numericPeerIdForMapLookup);
          if (!chatInfo.windowInstance.isVisible()) {
            const fromUsername = message.fromUsername || `User ${numericSenderId}`;
            console.log(`Notification: New message from ${fromUsername}`);
            const dragHandle = document.getElementById(`privateChatDragHandle_${numericPeerIdForMapLookup}`);
            if (dragHandle) dragHandle.style.animation = 'pulseBorder 1.5s infinite';
          }
        } else {
          const fromUsername = message.fromUsername || `User ${numericSenderId}`;
          console.log(`Chat: Rcvd message for numeric peer ID ${numericPeerIdForMapLookup} (original sender: ${message.fromUserId}), no window open. User: ${fromUsername}`, message);
          if (numericSenderId !== currentUserId && message.fromUsername) { 
            alert(`New message from ${fromUsername}! Open their chat from the user list to see it.`);
          }
        }
      } else if (message.type === 'message_sent_ack') {
        console.log("Chat: Message acknowledged by server", message);
      } else if (message.type === 'PONG_GAME_INVITE') {
        const { gameId, inviterUsername, inviterId } = message;
        if (gameId && inviterUsername && inviterId) {
            console.log(`[CHATCLIENT] Received Pong game invite for game ${gameId} from ${inviterUsername} (ID: ${inviterId})`);
            
            let inviterNumericId: number | null = null;
            if (typeof inviterId === 'string' && inviterId.startsWith('user_')) {
                inviterNumericId = parseInt(inviterId.substring(5), 10);
            } else if (typeof inviterId === 'number') {
                inviterNumericId = inviterId;
            }

            if (inviterNumericId !== null && !isNaN(inviterNumericId)) {
                let chatInfo = activePrivateChats.get(inviterNumericId);
                if (chatInfo && chatInfo.messagesArea) {
                    displayInviteInChat(chatInfo.messagesArea, gameId, inviterUsername, inviterId);
                } else {
                    console.warn(`Chat window with ${inviterUsername} (ID: ${inviterNumericId}) not found. Attempting to open then display invite.`);
                    const inviterUserObject: User = {id: inviterNumericId, username: inviterUsername, picture: message.user?.picture}; 
                    launchPrivateChatWindow(inviterUserObject).then(() => {
                        setTimeout(() => { 
                            chatInfo = activePrivateChats.get(inviterNumericId!);
                            if (chatInfo && chatInfo.messagesArea) {
                                displayInviteInChat(chatInfo.messagesArea, gameId, inviterUsername, inviterId);
                            } else {
                                console.error("Failed to display invite even after attempting to open chat window for", inviterUsername);
                                alert(`${inviterUsername} invited you to Pong! Open your chat to respond (invite ID: ${gameId}).`);
                            }
                        }, 200);
                    });
                }
            } else {
                    console.error("Could not parse numeric ID for inviter from PONG_GAME_INVITE:", inviterId);
                    if (confirm(`${inviterUsername || 'A player'} has invited you to a game of Pong! (ID error) Accept?`)) {
                        sendPongJoinGame(gameId);
                    }
                }
            } else {
                console.warn("[CHATCLIENT] Received PONG_GAME_INVITE with missing data:", message);
            }
      } else if (message.type === 'PONG_INVITE_WAS_DECLINED') {

        const { gameId, declinedByUsername } = message;
        console.log(`[CHATCLIENT] Pong invitation for game ${gameId} was declined by ${declinedByUsername}.`);
        alert(`Your Pong invitation was declined by ${declinedByUsername}.`);
      } 
      
      else if (message.type === 'PONG_GAME_STARTED') {
        const { gameId, initialState, yourPlayerId, opponentUsername, opponentId } = message;
        console.log(`PONG_GAME_STARTED received for game ${gameId}. You are ${yourPlayerId}. Opponent: ${opponentUsername} (${opponentId})`, JSON.parse(JSON.stringify(initialState)));
        const gameStartEvent = new CustomEvent("pongGameStart", { detail: { gameId, initialState, yourPlayerId, opponentId, opponentUsername } });
        window.dispatchEvent(gameStartEvent);
      } else if (message.type === 'PONG_GAME_STATE_UPDATE') {
        // console.log('[CLIENT CHAT] Received PONG_GAME_STATE_UPDATE:', JSON.parse(JSON.stringify(message))); 
        const gameUpdateEvent = new CustomEvent("pongGameStateUpdate", { detail: message });
        window.dispatchEvent(gameUpdateEvent);
      } else if (message.type === 'PONG_GAME_OVER') {
        const { gameId, winnerId, scores } = message;
        console.log(`PONG_GAME_OVER received for game ${gameId}`, message);
        const gameOverEvent = new CustomEvent("pongGameOver", { detail: { gameId, winnerId, scores } });
        window.dispatchEvent(gameOverEvent);
      } else if (message.type === 'PONG_ERROR') {
        const { gameId, message: pongErrorMessage } = message;
        console.error(`Pong Error for game ${gameId || "N/A"}: ${pongErrorMessage}`);
        alert(`Pong Game Error: ${pongErrorMessage}`);
      } else if (message.type === 'error') {
        console.error("Chat: Server sent an error:", message.message);
        if (message.message && (message.message.toLowerCase().includes("authentication required") || message.message.toLowerCase().includes("authentication failed"))) {
          alert("Chat session could not be established or was terminated. Please ensure you are logged in.");
        }
      } else {
        console.warn("Received unhandled message type from server:", message.type, message);
      }
    } catch (e) {
      console.error("Chat: Error processing message from server", e, event.data);
    }
  };

  socket.onerror = (error) => { console.error("Chat: WebSocket Error:", error); };

  socket.onclose = (event) => {
    console.log("Chat: WebSocket Connection Closed:", event.code, event.reason);
    socket = null;
    currentUserId = null;
    currentUsername = null;
    activePrivateChats.forEach((chatInfo) => {
      if (chatInfo.inputField) chatInfo.inputField.disabled = true;
      if (chatInfo.sendButton) chatInfo.sendButton.disabled = true;
      const headerSpan = chatInfo.windowInstance.element?.querySelector(`#privateChatDragHandle_${chatInfo.peer.id} span .font-bold`);
      if (headerSpan) (headerSpan as HTMLElement).textContent = `Chat with ${chatInfo.peer.username} (Disconnected)`;
    });
    if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">Chat disconnected. Please refresh or log in.</li>';
    if (chatWithUserEl) chatWithUserEl.textContent = "Chat Disconnected";
  };
}

async function loadUserList() {
  if (!chatUserListEl) {
    console.error("Chat: chatUserListEl not found.");
    return;
  }
  if (!currentUserId) {
    console.warn("Chat: Not authenticated (currentUserId not set). Cannot load user list.");
    chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">Authentication pending...</li>';
    return;
  }
  
  try {
    const response = await fetch("/api/chat/users", { method: "GET", credentials: "include" });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat: Failed to load user list", response.status, errorText);
      if (chatUserListEl) {
        chatUserListEl.innerHTML = `<li class="text-red-400 text-xs p-1.5">Error loading users: ${response.status}</li>`;
      }
      if (response.status === 401) {
        alert("Chat: Session expired or unauthorized for user list. Please log in again.");
      }
      return;
    }

    // Use the new ApiUser interface here.
    const usersFromServer: ApiUser[] = await response.json();
    chatUserListEl.innerHTML = "";

    if (usersFromServer.length === 0) {
      chatUserListEl.innerHTML = '<li class="text-xs p-1.5">No other users available.</li>';
    } else {
      usersFromServer.forEach((user) => { 
        const numericUserId = parseInt(user.id.substring(5), 10);
        if (isNaN(numericUserId)) {
            console.warn("Skipping user with unparseable ID from /api/chat/users:", user);
            return;
        }

        const li = document.createElement("li");
        li.dataset.username = user.username;
        li.dataset.userId = numericUserId.toString();
        if (user.picture) {
            li.dataset.userPicture = user.picture;
        }
        li.className = "p-1.5 hover:bg-slate-700 cursor-pointer text-xs flex items-center space-x-2";

        const avatarContainer = document.createElement("div");
        avatarContainer.className = "relative flex-shrink-0";

        const statusCircle = document.createElement("div");
        statusCircle.id = `chat-user-status-${numericUserId}`;
        statusCircle.className = "w-2.5 h-2.5 bg-green-400 rounded-full absolute top-0 left-0 border-2 border-slate-700";
        statusCircle.style.display = user.isOnline ? 'block' : 'none';

        const colorIndex = numericUserId % userPlaceholderColors.length;
        const selectedBgColor = userPlaceholderColors[colorIndex];
        const placeholder = document.createElement("div");
        placeholder.className = `w-5 h-5 flex items-center justify-center text-xs text-slate-900 pointer-events-none flex-shrink-0 ${selectedBgColor}`;
        placeholder.textContent = user.username.substring(0, 1).toUpperCase();

        avatarContainer.appendChild(placeholder);
        avatarContainer.appendChild(statusCircle);
        li.appendChild(avatarContainer);

        const nameSpan = document.createElement("span");
        nameSpan.textContent = user.username;
        nameSpan.className = "pointer-events-none";
        li.appendChild(nameSpan);

        chatUserListEl?.appendChild(li);
      });
    }
  } catch (error) {
    console.error("Chat: Error loading user list (exception):", error);
    if (chatUserListEl) {
      chatUserListEl.innerHTML = '<li class="text-red-400 text-xs p-1.5">Failed to load users.</li>';
    }
  }
}


function createPrivateChatWindowHtml(peerUser: User): string { 
  const peerIdNumeric = peerUser.id;
  const peerUsernameSafe = (peerUser.username || "User").replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[match]!));
  return `
        <div id="privateChatWindow_${peerIdNumeric}" class="border-2 w-[450px] text-sm flex flex-col bg-slate-900/60 absolute left-1/3 top-1/3 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out backdrop-blur-xs opacity-0 scale-95 invisible pointer-events-none drop-shadow-xl/30" style="width: 300px; height: 350px; min-width: 300px; min-height: 350px; max-width: 600px; max-height: 80vh;">
            <div id="privateChatDragHandle_${peerIdNumeric}" class="bg-slate-900/50 px-1.5 py-1 flex items-center justify-between border-b-2 cursor-grab active:cursor-grabbing select-none">
                <div class="flex items-center space-x-1.5"><button id="viewProfileBtn_${peerUser.id}" title="View ${peerUser.username}'s profile" class="font-bold hover:underline">Chat with ${peerUser.username}</button></div>
                <div class="flex items-center space-x-1">
                    <button id="invitePongBtn_${peerIdNumeric}" title="Invite ${peerUsernameSafe} to Pong" class="px-2 py-0.5 border border-green-500 text-green-400 hover:bg-green-500 hover:text-slate-900 text-xs rounded transition-colors">Invite Pong</button>
                    <button aria-label="Close private chat with ${peerUsernameSafe}" id="closePrivateChatBtn_${peerIdNumeric}" class="w-5 h-5 border flex items-center justify-center font-bold hover-important transition-colors">X</button>
                </div>
            </div>
            <div class="flex-grow p-2 overflow-y-auto space-y-2 divide-y divide-slate-600/60" id="privateMessagesArea_${peerIdNumeric}"></div>
            <div class="p-2 border-t">
                <div class="flex space-x-2">
                    <input type="text" id="privateMessageInput_${peerIdNumeric}" placeholder="Message ${peerUsernameSafe}..." class="flex-grow p-1.5 bg-slate-900 border text-xs focus:ring-1 focus:ring-[#4cb4e7] focus:border-[#4cb4e7] outline-none" />
                    <button id="privateSendBtn_${peerIdNumeric}" class="border px-3 py-1.5 font-bold tracking-wider hover:bg-[#8be076] hover:text-slate-900 transition-colors text-xs">SEND</button>
                </div>
            </div>
            <div id="privateChatResizeHandle_${peerIdNumeric}" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 opacity-50 hover:opacity-100 transition-opacity"></div>
        </div>`;
}

async function launchPrivateChatWindow(peerUser: User) { 
  if (activePrivateChats.has(peerUser.id)) {
    const existingChat = activePrivateChats.get(peerUser.id);
    if (existingChat) {
      existingChat.windowInstance.open();
      existingChat.inputField.focus();
    }
    return;
  }
  const windowHtml = createPrivateChatWindowHtml(peerUser);
  const mainElement = document.getElementById("main");
  if (!mainElement) { console.error("Main element ('main') not found to append chat window!"); return; }
  mainElement.insertAdjacentHTML("beforeend", windowHtml);

  requestAnimationFrame(async () => {
    const windowId = `privateChatWindow_${peerUser.id}`;
    const dragHandleId = `privateChatDragHandle_${peerUser.id}`;
    const closeButtonId = `closePrivateChatBtn_${peerUser.id}`;
    const resizeHandleId = `privateChatResizeHandle_${peerUser.id}`;
    const messagesAreaId = `privateMessagesArea_${peerUser.id}`;
    const inputFieldId = `privateMessageInput_${peerUser.id}`;
    const sendButtonId = `privateSendBtn_${peerUser.id}`;
    const invitePongButtonId = `invitePongBtn_${peerUser.id}`;
    const newWindowElement = document.getElementById(windowId);
    if (!newWindowElement) { console.error(`Failed to find new window element ${windowId} after insertion.`); return; }
    
    try {
      const newWindowInstance = new DesktopWindow({
        windowId: windowId, dragHandleId: dragHandleId, resizeHandleId: resizeHandleId,
        closeButtonId: closeButtonId, boundaryContainerId: "main", visibilityToggleId: windowId,
        initialShow: false,
        onCloseCallback: () => {
          const chatInfo = activePrivateChats.get(peerUser.id);
          if (chatInfo && chatInfo.windowInstance.element) chatInfo.windowInstance.element.remove();
          activePrivateChats.delete(peerUser.id);
        },
      });
      newWindowInstance.open();
      const messagesArea = document.getElementById(messagesAreaId) as HTMLElement;
      const inputField = document.getElementById(inputFieldId) as HTMLInputElement;
      const sendButton = document.getElementById(sendButtonId) as HTMLButtonElement;
      const invitePongButton = document.getElementById(invitePongButtonId) as HTMLButtonElement;

      if (!messagesArea || !inputField || !sendButton || !invitePongButton) {
        console.error(`Chat: Could not find all interactive chat sub-elements for ${peerUser.username}.`);
        newWindowElement.remove(); return;
      }
      activePrivateChats.set(peerUser.id, { peer: peerUser, windowInstance: newWindowInstance, messagesArea: messagesArea, inputField: inputField, sendButton: sendButton });
      sendButton.addEventListener("click", () => { sendMessageToPeer(peerUser, inputField.value); inputField.value = ""; inputField.focus(); });
      inputField.addEventListener("keypress", (e) => { if (e.key === "Enter" && !sendButton.disabled) { sendMessageToPeer(peerUser, inputField.value); inputField.value = ""; }});
      invitePongButton.addEventListener('click', () => {
        invitePongButton.disabled = true; invitePongButton.textContent = "Invited";
        handleInvitePlayerToPong(peerUser);
        setTimeout(() => {
          const currentButton = document.getElementById(invitePongButtonId) as HTMLButtonElement;
          if(currentButton) { currentButton.disabled = false; currentButton.textContent = "Invite Pong"; }
        }, 5000); 
      });
      await loadChatHistoryForWindow(peerUser, messagesArea);
      inputField.focus();
    } catch (error) {
      console.error(`Error initializing DesktopWindow or chat for ${peerUser.username}:`, error);
      const elToRemoveOnCatch = document.getElementById(windowId);
      if (elToRemoveOnCatch) elToRemoveOnCatch.remove();
    }

      const viewProfileButton = document.getElementById(`viewProfileBtn_${peerUser.id}`);
        if (viewProfileButton) {
            viewProfileButton.addEventListener('click', () => {
                showUserProfile(peerUser);
            });
        }
  });
}

async function loadChatHistoryForWindow(peerUser: User, messagesArea: HTMLElement) { 
  if (!currentUserId) {
    console.warn("Chat: Cannot load history, current user not authenticated.");
    messagesArea.innerHTML = '<div class="text-center text-xs text-red-400 p-2">Authentication error.</div>'; return;
  }
  messagesArea.innerHTML = '<div class="text-center text-xs text-slate-400 p-2">Loading history...</div>';
  try {
    const response = await fetch(`/api/chat/history/${peerUser.id}`, { method: "GET", credentials: "include" }); 
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Chat: Failed to load chat history for ${peerUser.username}`, response.status, errorText);
      messagesArea.innerHTML = `<div class="text-center text-red-400 text-xs p-2">Error loading history: ${response.status}</div>`; return;
    }
    const rawHistory: ChatMessage[] = await response.json();
    messagesArea.innerHTML = "";
    if (rawHistory.length === 0) {
      messagesArea.innerHTML = '<div class="text-center text-xs text-slate-400 p-2">No messages yet. Start the conversation!</div>';
    } else {
      rawHistory.forEach((msg) => { displayMessageInWindow(msg, messagesArea, peerUser.id); });
    }
  } catch (error) {
    console.error(`Chat: Exception loading chat history for ${peerUser.username}:`, error);
    messagesArea.innerHTML = `<div class="text-center text-red-400 text-xs p-2">Failed to load history.</div>`;
  }
}

function sendMessageToPeer(peerUser: User, content: string) { 
  content = content.trim();
  if (content === "" || !socket || socket.readyState !== WebSocket.OPEN || !currentUserId) {
    console.error("Chat: Cannot send message. Conditions not met."); return;
  }
  const messageToSendPayload = { type: "privateMessage", toUserId: peerUser.id.toString(), content: content }; 
  socket.send(JSON.stringify(messageToSendPayload));
  console.log("Chat: Sent private message payload to peer:", peerUser.id, messageToSendPayload);

  const chatInfo = activePrivateChats.get(peerUser.id);
  if (chatInfo) {
    displayMessageInWindow(
      { fromUserId: currentUserId as number, fromUsername: currentUsername || "You", toUserId: peerUser.id, content: content, timestamp: new Date().toISOString() },
      chatInfo.messagesArea,
      peerUser.id
    );
  }
}

function displayMessageInWindow(msg: ChatMessage, messagesArea: HTMLElement, peerIdOfThisWindowNumeric: number) {
  let msgFromNumericId: number;
  if (typeof msg.fromUserId === 'string' && msg.fromUserId.startsWith('user_')) {
    msgFromNumericId = parseInt(msg.fromUserId.substring(5), 10);
  } else if (typeof msg.fromUserId === 'number') {
    msgFromNumericId = msg.fromUserId;
  } else {
    console.warn('[DisplayMessage] Unparseable msg.fromUserId:', msg.fromUserId, msg); return; 
  }
  if (isNaN(msgFromNumericId)){ console.warn('[DisplayMessage] msg.fromUserId resulted in NaN:', msg.fromUserId, msg); return; }
  
  console.log(`[DisplayMessage] msgFromNumericId: ${msgFromNumericId}, currentUserId: ${currentUserId}, peerIdOfThisWindowNumeric: ${peerIdOfThisWindowNumeric}, fromUsername: ${msg.fromUsername}`);

  const messageContainerDiv = document.createElement("div");
  const senderInfoDiv = document.createElement("div");
  const messageContentDiv = document.createElement("div");
  senderInfoDiv.textContent = `${msg.fromUsername || `User ${msgFromNumericId}`}:`;
  senderInfoDiv.classList.add("text-xs", "font-bold", "underline");
  messageContentDiv.textContent = msg.content || "";
  messageContentDiv.className = "px-3 text-xs break-all break-words";

  if (msgFromNumericId === currentUserId) {
    messageContainerDiv.className = "text-[#FFE2BF] flex flex-row items-start my-2 py-2";
    senderInfoDiv.style.color = "#FFE2BF";
  } else if (msgFromNumericId === peerIdOfThisWindowNumeric) {
    messageContainerDiv.className = "flex flex-row items-start my-2 py-2";
  } else {
    console.warn("[DisplayMessage] Message is not from self and not from the expected peer of this window.", { msgFromNumericId, currentUserId, peerIdOfThisWindowNumeric, originalMsg: msg });
    return;
  }
  messageContainerDiv.appendChild(senderInfoDiv);
  messageContainerDiv.appendChild(messageContentDiv);
  messagesArea.appendChild(messageContainerDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}


function displayInviteInChat(
    messagesArea: HTMLElement, 
    gameId: string, 
    inviterUsername: string,
    inviterPrefixedId: string
) {
    const inviteMessageDiv = document.createElement('div');
    inviteMessageDiv.className = 'p-2 my-1 rounded-md bg-slate-700 border border-slate-600 text-sm';
    inviteMessageDiv.innerHTML = `
        <span><strong>${inviterUsername}</strong> invites you to play Pong!</span>
        <button data-action="accept" data-gameid="${gameId}" class="ml-2 px-3 py-1 bg-[#53D4C0] hover:bg-green-600 text-white text-xs font-semibold rounded-md transition-colors">Accept</button>
        <button data-action="decline" data-gameid="${gameId}" data-inviterid="${inviterPrefixedId}" class="ml-1 px-3 py-1 bg-[#D4535B] hover:bg-red-600 text-white text-xs font-semibold rounded-md transition-colors">Decline</button>
    `;
    
    const acceptButton = inviteMessageDiv.querySelector('button[data-action="accept"]') as HTMLButtonElement;
    const declineButton = inviteMessageDiv.querySelector('button[data-action="decline"]') as HTMLButtonElement;

    if (acceptButton) {
        acceptButton.onclick = () => { 
            console.log(`[CHATCLIENT] Accepted Pong invite for game: ${gameId}`);
            sendPongJoinGame(gameId);
            inviteMessageDiv.innerHTML = `<span>Accepted Pong invitation from <strong>${inviterUsername}</strong>. Joining game...</span>`;
        };
    }

    if (declineButton) {
        declineButton.onclick = () => {
            console.log(`[CHATCLIENT] Declined Pong invite for game: ${gameId}`);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'PONG_INVITE_DECLINED',
                    gameId: gameId,
                    inviterId: inviterPrefixedId
                }));
            }
            inviteMessageDiv.innerHTML = `<span>You declined the Pong invitation from <strong>${inviterUsername}</strong>.</span>`;
        };
    }
    messagesArea.appendChild(inviteMessageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

export function resetChatSystem() {
  console.log("Chat: Resetting chat system due to logout or auth change.");
  if (socket) { socket.onclose = null; socket.close(1000, "User logged out"); socket = null; }
  currentUserId = null; currentUsername = null;
  activePrivateChats.forEach((chatInfo) => { chatInfo.windowInstance.element?.remove(); });
  activePrivateChats.clear();
  if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs">Logged out.</li>';
  if (chatWithUserEl) chatWithUserEl.textContent = "Log in to chat";
}


