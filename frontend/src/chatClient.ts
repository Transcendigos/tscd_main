import { DesktopWindow } from "./DesktopWindow.js";
import { fetchAndDisplayTournaments, showTournamentBracket } from "./tournament.ts";



interface User {
  id: number;
  username: string;
  picture?: string | null;
}

interface UserProfileData {
    id: number;
    username: string;
    email?: string;
    picture?: string;
    wins?: number;
    losses?: number;
    winRatio?: string;
    matchHistory?: any[];
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
    isBlockedByMe: boolean;
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
  drawingDataUrl?: string;
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
  tournamentId?: string;
  matchId?: number;
}

const userPlaceholderColors: string[] = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];



const openProfileWindows = new Map<number, DesktopWindow>();
const blockedSet = new Set<number>();

export let socket: WebSocket | null = null;
export let currentUserId: number | null = null;
export let currentUsername: string | null = null;

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

  const generalChatInput = document.getElementById("generalChatMessageInput") as HTMLInputElement;
  const generalChatSendBtn = document.getElementById("generalChatSendBtn") as HTMLButtonElement;

  const sendPublicMessage = () => {
    const content = generalChatInput.value.trim();
    if (content && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'publicMessage',
            content: content
        }));
        generalChatInput.value = '';
    }
  };

  generalChatSendBtn.addEventListener('click', sendPublicMessage);
  generalChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendPublicMessage();
    }
  });

  chatUserListEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches('input[type="checkbox"]')) { return; }

    const listItem = target.closest("li");
    if (listItem && listItem.parentElement === chatUserListEl && listItem.dataset.userId) {
      const userIdNumeric = parseInt(listItem.dataset.userId, 10);

      if (listItem.dataset.isBlocked === 'true') {
        return;
      }

      const username = listItem.dataset.username || "User";
      const picture = listItem.dataset.userPicture || null;

      if (currentUserId && userIdNumeric === currentUserId) { return; }

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

    const prefixedId = `user_${user.id}`;

    try {
        // Fetch all data in parallel, just like in your populateUserProfile function
        const [profileRes, summaryRes, historyRes] = await Promise.all([
            fetch(`http://localhost:3000/api/profile/${user.id}`, { credentials: 'include' }),
            fetch(`/api/stats/summary/${prefixedId}`),
            fetch(`/api/stats/match-history/${prefixedId}`)
        ]);

        if (!profileRes.ok || !summaryRes.ok || !historyRes.ok) {
            console.error('Failed to fetch all profile data for user:', user.id);
            alert(`Could not load full profile for ${user.username}.`);
            return;
        }

        const { profile } = await profileRes.json();
        const summary = await summaryRes.json();
        const history = await historyRes.json();
        const fullProfile: UserProfileData = { ...profile, ...summary, matchHistory: history };

        const historyRowsHtml = fullProfile.matchHistory && fullProfile.matchHistory.length > 0
            ? fullProfile.matchHistory.map(match => {
                const resultClass = match.result === 'Win' ? 'text-green-400' : 'text-red-400';
                return `
                    <tr class="border-t border-slate-700/50">
                        <td class="p-2">${match.opponent}</td>
                        <td class="p-2">${match.yourScore} - ${match.opponentScore}</td>
                        <td class="p-2 font-bold ${resultClass}">${match.result}</td>
                        <td class="p-2 opacity-70 text-xs">${new Date(match.date).toLocaleDateString()}</td>
                    </tr>`;
            }).join('')
            : '<tr><td colspan="4" class="text-center p-4 text-slate-400">No match history.</td></tr>';

        const profileWindowHtml = `
        <div id="userProfileWindow_${user.id}" class="border-2 border-[#8be076] w-[450px] text-sm flex flex-col bg-slate-900/90 backdrop-blur-sm absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out opacity-0 scale-95 invisible pointer-events-none">
          <div id="userProfileDragHandle_${user.id}" class="px-2 py-1 flex items-center justify-between border-b-2 border-[#8be076] cursor-grab active:cursor-grabbing select-none">
            <span class="font-bold text-white">${fullProfile.username}'s Profile</span>
            <button id="closeUserProfileBtn_${user.id}" class="w-5 h-5 border border-[#8be076] flex items-center justify-center font-bold hover:bg-[#f8aab6] hover:text-slate-900 transition-colors">X</button>
          </div>
          <div class="flex-grow p-4 flex flex-col space-y-3 bg-slate-800/50 text-slate-300">
            <div class="flex items-center space-x-4">
                <img src="${fullProfile.picture || '/favicon.jpg'}" onerror="this.onerror=null;this.src='/favicon.jpg';" class="w-20 h-20 rounded-full object-cover border-2 border-[#8be076]">
                <div class="space-y-1">
                    <p class="text-2xl font-bold text-white">${fullProfile.username}</p>
                    <p class="text-sm text-slate-400">${fullProfile.email || 'No public email'}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-white">
                <div class="bg-slate-700/50 p-2 rounded-lg"><p class="font-bold text-xl text-green-400">${fullProfile.wins || 0}</p><p class="text-xs text-slate-400">Wins</p></div>
                <div class="bg-slate-700/50 p-2 rounded-lg"><p class="font-bold text-xl text-red-400">${fullProfile.losses || 0}</p><p class="text-xs text-slate-400">Losses</p></div>
                <div class="bg-slate-700/50 p-2 rounded-lg"><p class="font-bold text-xl">${fullProfile.winRatio || 'N/A'}</p><p class="text-xs text-slate-400">Win Ratio</p></div>
            </div>
            <div class="flex-grow bg-slate-900/50 rounded-lg overflow-hidden flex flex-col">
                <h3 class="text-center font-bold text-xs p-1 bg-slate-900/80 text-white">Match History</h3>
                <div class="overflow-y-auto" style="max-height: 150px;">
                    <table class="w-full text-left text-xs">
                        <tbody id="profileMatchHistory_${user.id}">${historyRowsHtml}</tbody>
                    </table>
                </div>
            </div>
          </div>
          <div id="userProfileResizeHandle_${user.id}" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"></div>
        </div>`;

        document.getElementById("main")?.insertAdjacentHTML('beforeend', profileWindowHtml);

        const newProfileWindow = new DesktopWindow({
            windowId: `userProfileWindow_${user.id}`, dragHandleId: `userProfileDragHandle_${user.id}`,
            resizeHandleId: `userProfileResizeHandle_${user.id}`, closeButtonId: `closeUserProfileBtn_${user.id}`,
            boundaryContainerId: 'main', visibilityToggleId: `userProfileWindow_${user.id}`,
            onCloseCallback: () => {
                openProfileWindows.delete(user.id);
                document.getElementById(`userProfileWindow_${user.id}`)?.remove();
            }
        });

        openProfileWindows.set(user.id, newProfileWindow);
        newProfileWindow.open();

    } catch (error) {
        console.error("Failed to show user profile:", error);
        alert("Could not load user profile. The user's data may be private or an error occurred.");
    }
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

// MODIFIED LOGIC: Simplified pong invitation function
async function handleInvitePlayerToPong(opponent: User) {
  if (!opponent || typeof opponent.id === 'undefined') {
    console.error("[Frontend] Invalid opponent data for Pong invite:", opponent);
    alert("Cannot invite player: invalid opponent data.");
    return;
  }
  const opponentPlayerIdForAPI = `user_${opponent.id}`;

  try {
    const response = await fetch('/api/pong/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponentPlayerId: opponentPlayerIdForAPI })
    });

    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      console.log(`[Frontend] Invitation sent to ${opponent.username}.`);
      // No longer need to do anything else here, the backend handles the invite
    } else {
      console.error("[Frontend] Failed to send invitation. API error. Status:", response.status, "Response Data:", responseData);
      alert(`Failed to send invitation: ${responseData.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("[Frontend] Network or unexpected error in handleInvitePlayerToPong:", error);
    alert('An error occurred while sending the invitation.');
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
      } else if (message.type === 'newPublicMessage') {
        displayPublicMessage(message);
      } else if (message.type === 'message_sent_ack') {
        console.log("Chat: Message acknowledged by server", message);
      // MODIFIED LOGIC: Handle game invitation without a gameId
      } else if (message.type === 'PONG_GAME_INVITE') {
        const { inviterUsername, inviterId } = message;
        if (inviterUsername && inviterId) {
            console.log(`[CHATCLIENT] Received Pong game invite from ${inviterUsername} (ID: ${inviterId})`);

            let inviterNumericId: number | null = null;
            if (typeof inviterId === 'string' && inviterId.startsWith('user_')) {
                inviterNumericId = parseInt(inviterId.substring(5), 10);
            } else if (typeof inviterId === 'number') {
                inviterNumericId = inviterId;
            }

            if (inviterNumericId !== null && !isNaN(inviterNumericId)) {
                let chatInfo = activePrivateChats.get(inviterNumericId);
                if (chatInfo && chatInfo.messagesArea) {
                    displayInviteInChat(chatInfo.messagesArea, inviterUsername, inviterId);
                } else {
                    console.warn(`Chat window with ${inviterUsername} (ID: ${inviterNumericId}) not found. Attempting to open then display invite.`);
                    const inviterUserObject: User = {id: inviterNumericId, username: inviterUsername, picture: message.user?.picture};
                    launchPrivateChatWindow(inviterUserObject).then(() => {
                        setTimeout(() => {
                            chatInfo = activePrivateChats.get(inviterNumericId!);
                            if (chatInfo && chatInfo.messagesArea) {
                                displayInviteInChat(chatInfo.messagesArea, inviterUsername, inviterId);
                            } else {
                                console.error("Failed to display invite even after attempting to open chat window for", inviterUsername);
                                alert(`${inviterUsername} invited you to Pong! Open your chat to respond.`);
                            }
                        }, 200);
                    });
                }
            } else {
                console.error("Could not parse numeric ID for inviter from PONG_GAME_INVITE:", inviterId);
                alert(`${inviterUsername || 'A player'} has invited you to a game of Pong! (ID error)`);
            }
        } else {
            console.warn("[CHATCLIENT] Received PONG_GAME_INVITE with missing data:", message);
        }
      } else if (message.type === 'PONG_INVITE_WAS_DECLINED') {
        const { declinedByUsername } = message;
        console.log(`[CHATCLIENT] Pong invitation was declined by ${declinedByUsername}.`);
        alert(`Your Pong invitation was declined by ${declinedByUsername}.`);
      } else if (message.type === 'PONG_GAME_STARTED') {
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
      } else if (message.type === 'BLOCK_STATUS_UPDATE') {
        loadUserList();
      } else if (message.type === 'error') {
        console.error("Chat: Server sent an error:", message.message);
        if (message.message && (message.message.toLowerCase().includes("authentication required") || message.message.toLowerCase().includes("authentication failed"))) {
          alert("Chat session could not be established or was terminated. Please ensure you are logged in.");
        }
      } else if (message.type === 'TOURNAMENT_LOBBY_UPDATE') {
        console.log("Received TOURNAMENT_LOBBY_UPDATE, refreshing lobby...");
        // Check if the tournament window is currently visible before refreshing
        const tournamentWindow = document.getElementById('tournamentWindow');
        if (tournamentWindow && !tournamentWindow.classList.contains('invisible')) {
            fetchAndDisplayTournaments();
        }

      } else if (message.type === 'TOURNAMENT_STARTED') {
        const tournamentId = message.tournamentId;
        if (tournamentId) {
            console.log(`[ChatClient] Announcing tournament start for ID: ${tournamentId}`);
            // Fire a global event that main.ts can listen for
            const event = new CustomEvent('tournament:start', { detail: { tournamentId } });
            window.dispatchEvent(event);
        }
      
      } else if (message.type === 'MATCH_READY') {
          console.log("Received MATCH_READY, refreshing bracket to show button.");
          const tournamentWindow = document.getElementById('tournamentWindow');
          if (tournamentWindow && !tournamentWindow.classList.contains('invisible')) {
              showTournamentBracket(message.tournamentId!);
          }

      } else if (message.type === 'BRACKET_UPDATE') {
          console.log("Received BRACKET_UPDATE, refreshing bracket.");
          const tournamentWindow = document.getElementById('tournamentWindow');
          if (tournamentWindow && !tournamentWindow.classList.contains('invisible') && message.tournamentId) {
              showTournamentBracket(message.tournamentId);
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

async function handleBlockToggle(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    checkbox.disabled = true;

    const userId = checkbox.dataset.userId;
    const endpoint = checkbox.checked ? '/api/chat/block' : '/api/chat/unblock';
    const bodyKey = checkbox.checked ? 'userIdToBlock' : 'userIdToUnblock';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ [bodyKey]: userId })
        });
        if (res.ok) {
            loadUserList();
        } else {
            alert('Failed to update block status.');
            checkbox.checked = !checkbox.checked;
        }
    } catch (error) {
        console.error("Error toggling block status:", error);
        alert('An error occurred.');
        checkbox.checked = !checkbox.checked;
    } finally {
        checkbox.disabled = false;
    }
}

async function loadUserList() {
    if (!chatUserListEl) { console.error("Chat: chatUserListEl not found."); return; }
    if (!currentUserId) {
        console.warn("Chat: Not authenticated (currentUserId not set). Cannot load user list.");
        chatUserListEl.innerHTML = '<li class="text-slate-400 text-xs p-1.5">Authentication pending...</li>';
        return;
    }

    try {
        const usersResponse = await fetch("/api/chat/users", { credentials: 'include' });
        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch user list. Status: ${usersResponse.status}`);
        }

        const usersFromServer: ApiUser[] = await usersResponse.json();
        chatUserListEl.innerHTML = "";

        if (usersFromServer.length === 0) {
            chatUserListEl.innerHTML = '<li class="text-xs p-1.5">No other users available.</li>';
        } else {
            usersFromServer.forEach((user) => {
                const numericUserId = parseInt(user.id.substring(5), 10);
                if (isNaN(numericUserId)) return;

                const li = document.createElement("li");
                li.dataset.username = user.username;
                li.dataset.userId = numericUserId.toString();
                li.dataset.isBlocked = user.isBlockedByMe.toString();

                li.className = "p-1.5 hover:bg-slate-700 text-xs flex items-center space-x-2";
                if (!user.isBlockedByMe) {
                    li.classList.add("cursor-pointer");
                }

                const avatarContainer = document.createElement("div");
                avatarContainer.className = "relative flex-shrink-0";
                const statusCircle = document.createElement("div");
                statusCircle.id = `chat-user-status-${numericUserId}`;
                statusCircle.className = "w-2.5 h-2.5 bg-green-400 rounded-full absolute top-0 left-0 border-2 border-slate-700";
                statusCircle.style.display = user.isOnline ? 'block' : 'none';

                const colorIndex = numericUserId % userPlaceholderColors.length;
                const placeholder = document.createElement("div");
                placeholder.className = `w-5 h-5 flex items-center justify-center text-xs text-slate-900 pointer-events-none flex-shrink-0 ${userPlaceholderColors[colorIndex]}`;
                placeholder.textContent = user.username.substring(0, 1).toUpperCase();
                avatarContainer.appendChild(placeholder);
                avatarContainer.appendChild(statusCircle);
                li.appendChild(avatarContainer);

                const nameSpan = document.createElement("span");
                nameSpan.textContent = user.username;
                nameSpan.className = `pointer-events-none flex-grow ${user.isBlockedByMe ? 'text-slate-500 line-through' : ''}`;
                li.appendChild(nameSpan);

                const blockCheckbox = document.createElement('input');
                blockCheckbox.type = 'checkbox';
                blockCheckbox.title = `Block ${user.username}`;
                blockCheckbox.className = 'ml-auto accent-[#D4535B] h-4 w-4 flex-shrink-0';
                blockCheckbox.dataset.userId = numericUserId.toString();
                blockCheckbox.checked = user.isBlockedByMe;
                blockCheckbox.addEventListener('change', handleBlockToggle);
                li.appendChild(blockCheckbox);

                chatUserListEl?.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Chat: Error loading user list:", error);
        if (chatUserListEl) chatUserListEl.innerHTML = '<li class="text-red-400 text-xs p-1.5">Failed to load users.</li>';
    }
}


function createPrivateChatWindowHtml(peerUser: User): string {
  const peerIdNumeric = peerUser.id;
  const peerUsernameSafe = (peerUser.username || "User").replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[match]!));
  return `
        <div id="privateChatWindow_${peerIdNumeric}" class="border-2 w-[450px] text-sm flex flex-col bg-slate-900/60 absolute left-1/3 top-1/3 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out backdrop-blur-xs opacity-0 scale-95 invisible pointer-events-none drop-shadow-xl/30" style="width: 380px; height: auto; min-width: 350px; min-height: 400px; max-width: 600px; max-height: 80vh;">
            <div id="privateChatDragHandle_${peerIdNumeric}" class="bg-slate-900/50 px-1.5 py-1 flex items-center justify-between border-b-2 cursor-grab active:cursor-grabbing select-none">
                <div class="flex items-center space-x-1.5"><span class="font-bold">Chat with ${peerUsernameSafe}</span></div>
                <div class="flex items-center space-x-1">
                    <button id="viewProfileBtn_${peerIdNumeric}" title="View ${peerUsernameSafe}'s Profile" class="px-2 py-0.5 border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 font-bold text-xs transition-colors">Profile</button>
                    <button id="invitePongBtn_${peerIdNumeric}" title="Invite ${peerUsernameSafe} to Pong" class="px-2 py-0.5 border border-seLightBlue text-seLightBlue hover:bg-seLightBlue hover:text-slate-900 font-bold text-xs transition-colors">Invite</button>
                    <button aria-label="Close private chat with ${peerUsernameSafe}" id="closePrivateChatBtn_${peerIdNumeric}" class="w-5 h-5 border flex items-center justify-center font-bold hover-important transition-colors">X</button>
                </div>
            </div>
            <div class="flex-grow p-2 overflow-y-auto space-y-2 divide-y divide-slate-600/60" id="privateMessagesArea_${peerIdNumeric}" style="min-height: 200px;"></div>

            <div id="drawingContainer_${peerIdNumeric}" class="p-2 border-t hidden flex items-start space-x-3 bg-slate-800">
                <div id="drawingToolbar_${peerIdNumeric}" class="p-1 border-2 border-t-slate-600 border-l-slate-600 border-b-slate-950 border-r-slate-950 bg-slate-800 flex flex-col gap-2">
                    <div id="colorPalette_${peerIdNumeric}" class="grid grid-cols-2 gap-1">
                        <button class="w-5 h-5 bg-black tool-color border-2 border-solid" data-color="black"></button>
                        <button class="w-5 h-5 bg-white tool-color border-2 border-solid" data-color="white"></button>
                        <button class="w-5 h-5 bg-slate-400 tool-color border-2 border-solid" data-color="#94a3b8"></button>
                        <button class="w-5 h-5 bg-red-600 tool-color border-2 border-solid" data-color="#E53E3E"></button>
                        <button class="w-5 h-5 bg-yellow-400 tool-color border-2 border-solid" data-color="#F6E05E"></button>
                        <button class="w-5 h-5 bg-green-500 tool-color border-2 border-solid" data-color="#38A169"></button>
                        <button class="w-5 h-5 bg-blue-600 tool-color border-2 border-solid" data-color="#3182CE"></button>
                        <button class="w-5 h-5 bg-purple-500 tool-color border-2 border-solid" data-color="#805AD5"></button>
                    </div>
                    <div class="border-t border-slate-700"></div>
                    <div id="sizeSelector_${peerIdNumeric}" class="flex flex-col space-y-2 items-center justify-center">
                        <button class="w-full h-3 flex items-center justify-center tool-size border-2 border-solid" data-size="1"><div class="h-px w-4/5 bg-seLightBlue"></div></button>
                        <button class="w-full h-3 flex items-center justify-center tool-size border-2 border-solid" data-size="3"><div class="h-0.5 w-4/5 bg-seLightBlue"></div></button>
                        <button class="w-full h-3 flex items-center justify-center tool-size border-2 border-solid" data-size="6"><div class="h-1 w-4/5 bg-seLightBlue"></div></button>
                    </div>
                    <div class="border-t border-slate-700"></div>
                    <button id="eraserBtn_${peerIdNumeric}" title="Eraser" class="h-5 w-full flex items-center justify-center p-0.5 border-2 border-solid">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-eraser-fill" viewBox="0 0 16 16"><path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828zm.66 11.34L3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293z"/></svg>
                    </button>
                </div>
                <div class="flex-grow flex flex-col items-center justify-start pt-3">
                    <canvas id="drawingCanvas_${peerIdNumeric}" width="160" height="160" class="bg-white border-2 border-t-slate-950 border-l-slate-950 border-b-slate-600 border-r-slate-600 cursor-crosshair"></canvas>
                    <div class="flex justify-between items-center mt-2 w-full max-w-[160px]">
                        <button id="clearCanvasBtn_${peerIdNumeric}" class="retro-button text-xs font-bold px-3 py-1 border hover:bg-supRed hover:text-slate-900">CLEAR</button>
                        <button id="sendDrawingBtn_${peerIdNumeric}" class="retro-button text-xs font-bold px-3 py-1 border hover:bg-seLightGreen hover:text-slate-900">SEND</button>
                    </div>
                </div>
            </div>

            <div class="p-2 border-t">
                <div class="flex space-x-2">
                    <button id="toggleDrawBtn_${peerIdNumeric}" title="Open Drawing Pad" class="border p-1.5 hover:bg-slate-700 transition-colors">✏️</button>
                    <input type="text" id="privateMessageInput_${peerIdNumeric}" placeholder="Message ${peerUsernameSafe}..." class="flex-grow p-1.5 bg-slate-900 border text-xs focus:ring-1 focus:ring-[#4cb4e7] focus:border-[#4cb4e7] outline-none" />
                    <button id="privateSendBtn_${peerIdNumeric}" class="border px-3 py-1.5 font-bold tracking-wider hover:bg-[#8be076] hover:text-slate-900 transition-colors text-xs">SEND</button>
                </div>
            </div>
            <div id="privateChatResizeHandle_${peerIdNumeric}" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 opacity-50 hover:opacity-100 transition-opacity"></div>
        </div>`;
}

async function launchPrivateChatWindow(peerUser: User) {
  // If a chat window for this user is already open, just focus it.
  if (activePrivateChats.has(peerUser.id)) {
    const existingChat = activePrivateChats.get(peerUser.id);
    if (existingChat) {
      existingChat.windowInstance.open();
      if (existingChat.inputField) {
        existingChat.inputField.focus();
      }
    }
    return;
  }

  // Create the window's HTML and add it to the page
  const windowHtml = createPrivateChatWindowHtml(peerUser);
  const mainElement = document.getElementById("main");
  if (!mainElement) {
    console.error("Main element ('main') not found to append chat window!");
    return;
  }
  mainElement.insertAdjacentHTML("beforeend", windowHtml);

  // Use requestAnimationFrame to ensure the element is in the DOM before we manipulate it
  requestAnimationFrame(async () => {
    const windowId = `privateChatWindow_${peerUser.id}`;
    const newWindowElement = document.getElementById(windowId);
    if (!newWindowElement) {
      console.error(`Failed to find new window element ${windowId} after insertion.`);
      return;
    }

    try {
      // Initialize the DesktopWindow instance for dragging, resizing, and closing
      const newWindowInstance = new DesktopWindow({
        windowId: windowId,
        dragHandleId: `privateChatDragHandle_${peerUser.id}`,
        resizeHandleId: `privateChatResizeHandle_${peerUser.id}`,
        closeButtonId: `closePrivateChatBtn_${peerUser.id}`,
        boundaryContainerId: "main",
        visibilityToggleId: windowId,
        initialShow: false, // Don't show it immediately, we'll open it after setup
        onCloseCallback: () => {
          // Cleanup when the window is closed
          const chatInfo = activePrivateChats.get(peerUser.id);
          if (chatInfo && chatInfo.windowInstance.element) {
            chatInfo.windowInstance.element.remove();
          }
          activePrivateChats.delete(peerUser.id);
        },
      });

      // Get all the interactive elements from the new window
      const messagesArea = document.getElementById(`privateMessagesArea_${peerUser.id}`) as HTMLElement;
      const inputField = document.getElementById(`privateMessageInput_${peerUser.id}`) as HTMLInputElement;
      const sendButton = document.getElementById(`privateSendBtn_${peerUser.id}`) as HTMLButtonElement;
      const invitePongButton = document.getElementById(`invitePongBtn_${peerUser.id}`) as HTMLButtonElement;
      const viewProfileButton = document.getElementById(`viewProfileBtn_${peerUser.id}`) as HTMLButtonElement;

      // --- Drawing Canvas Elements & Logic ---
      const toggleDrawBtn = document.getElementById(`toggleDrawBtn_${peerUser.id}`) as HTMLButtonElement;
      const drawingContainer = document.getElementById(`drawingContainer_${peerUser.id}`) as HTMLDivElement;
      const canvas = document.getElementById(`drawingCanvas_${peerUser.id}`) as HTMLCanvasElement;
      const clearCanvasBtn = document.getElementById(`clearCanvasBtn_${peerUser.id}`) as HTMLButtonElement;
      const sendDrawingBtn = document.getElementById(`sendDrawingBtn_${peerUser.id}`) as HTMLButtonElement;
      const colorPalette = document.getElementById(`colorPalette_${peerUser.id}`) as HTMLDivElement;
      const sizeSelector = document.getElementById(`sizeSelector_${peerUser.id}`) as HTMLDivElement;
      const eraserBtn = document.getElementById(`eraserBtn_${peerUser.id}`) as HTMLButtonElement;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Failed to get canvas context");
        return;
      }

      // Drawing state variables
      let currentColor = 'black';
      let currentSize = 1;
      let isErasing = false;
      let isDrawing = false;
      let lastX = 0;
      let lastY = 0;
      
      const updateToolVisuals = () => {
        const activeStyle = { top: "#020617", left: "#020617", bottom: "#4b5563", right: "#4b5563" }; // Inset
        const inactiveStyle = { top: "#4b5563", left: "#4b5563", bottom: "#020617", right: "#020617" }; // Outset
        const applyStyles = (el: HTMLElement, isActive: boolean) => {
            el.style.borderTopColor = isActive ? activeStyle.top : inactiveStyle.top;
            el.style.borderLeftColor = isActive ? activeStyle.left : inactiveStyle.left;
            el.style.borderBottomColor = isActive ? activeStyle.bottom : inactiveStyle.bottom;
            el.style.borderRightColor = isActive ? activeStyle.right : inactiveStyle.right;
        };
        colorPalette.querySelectorAll('.tool-color').forEach(b => applyStyles(b as HTMLButtonElement, (b as HTMLElement).dataset.color === currentColor && !isErasing));
        sizeSelector.querySelectorAll('.tool-size').forEach(b => applyStyles(b as HTMLButtonElement, parseInt((b as HTMLElement).dataset.size!) === currentSize));
        applyStyles(eraserBtn, isErasing);
      };
      updateToolVisuals();

      // Event listeners for drawing tools
      colorPalette.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.tool-color') as HTMLButtonElement;
        if(button) { currentColor = button.dataset.color || 'black'; isErasing = false; updateToolVisuals(); }
      });
      sizeSelector.addEventListener('click', (e) => {
         const button = (e.target as HTMLElement).closest('.tool-size') as HTMLButtonElement;
         if(button) { currentSize = parseInt(button.dataset.size || '1', 10); updateToolVisuals(); }
      });
      eraserBtn.addEventListener('click', () => { isErasing = true; updateToolVisuals(); });

      // Mouse events for drawing on the canvas
      canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        ctx.lineWidth = currentSize;
        ctx.strokeStyle = isErasing ? '#FFFFFF' : currentColor;
        ctx.lineCap = 'round';
        [lastX, lastY] = [e.offsetX, e.offsetY];
      });
      canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            [lastX, lastY] = [e.offsetX, e.offsetY];
        }
      });
      canvas.addEventListener('mouseup', () => isDrawing = false);
      canvas.addEventListener('mouseout', () => isDrawing = false);

      // Listeners for drawing UI buttons
      toggleDrawBtn.addEventListener('click', () => drawingContainer.classList.toggle('hidden'));
      clearCanvasBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
      sendDrawingBtn.addEventListener('click', () => {
        const dataUrl = canvas.toDataURL('image/png');
        if (socket && socket.readyState === WebSocket.OPEN && currentUserId) {
          socket.send(JSON.stringify({ type: "privateMessage", toUserId: peerUser.id.toString(), drawingDataUrl: dataUrl }));
          displayMessageInWindow({ fromUserId: currentUserId, drawingDataUrl: dataUrl }, messagesArea, peerUser.id);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawingContainer.classList.add('hidden');
        }
      });
      // --- End of Drawing Logic ---

      // Final check and setup for main chat functionality
      if (!messagesArea || !inputField || !sendButton || !invitePongButton || !viewProfileButton) {
        throw new Error(`Could not find all interactive chat sub-elements for ${peerUser.username}.`);
      }

      activePrivateChats.set(peerUser.id, { peer: peerUser, windowInstance: newWindowInstance, messagesArea, inputField, sendButton });

      // Attach main event listeners
      sendButton.addEventListener("click", () => { sendMessageToPeer(peerUser, inputField.value); inputField.value = ""; inputField.focus(); });
      inputField.addEventListener("keypress", (e) => { if (e.key === "Enter" && !sendButton.disabled) { sendMessageToPeer(peerUser, inputField.value); inputField.value = ""; }});
      invitePongButton.addEventListener('click', () => handleInvitePlayerToPong(peerUser));
      viewProfileButton.addEventListener('click', () => showUserProfile(peerUser));

      // Load history, open the window, and focus the input field
      await loadChatHistoryForWindow(peerUser, messagesArea);
      newWindowInstance.open();
      inputField.focus();

    } catch (error) {
      console.error(`Error initializing DesktopWindow or chat for ${peerUser.username}:`, error);
      newWindowElement.remove(); // Clean up the failed window
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
    return;
  }
  if (isNaN(msgFromNumericId)) {
    return;
  }

  const messageContainerDiv = document.createElement("div");
  const senderInfoDiv = document.createElement("div");
  const messageContentDiv = document.createElement("div");

  if (msg.drawingDataUrl) {
    const img = document.createElement('img');
    img.src = msg.drawingDataUrl;
    img.alt = `${msg.fromUsername}'s drawing`;
    img.className = "max-w-full h-auto border rounded-md bg-white mt-1";
    messageContentDiv.appendChild(img);
  }

  if (msg.content) {
    const textNode = document.createElement('div');
    textNode.textContent = msg.content;
    textNode.className = "text-xs break-words";
    messageContentDiv.appendChild(textNode);
  }

  if (msgFromNumericId === currentUserId) {
    messageContainerDiv.className = "flex flex-col items-end my-2 py-2";
    senderInfoDiv.className = "text-xs font-bold underline text-right";
    senderInfoDiv.textContent = `You:`;
  } else if (msgFromNumericId === peerIdOfThisWindowNumeric) {
    messageContainerDiv.className = "flex flex-col items-start my-2 py-2";
    senderInfoDiv.className = "text-xs font-bold underline text-left";
    senderInfoDiv.textContent = `${msg.fromUsername || `User ${msgFromNumericId}`}:`;
  } else {
    return;
  }

  messageContainerDiv.appendChild(senderInfoDiv);
  messageContainerDiv.appendChild(messageContentDiv);
  messagesArea.appendChild(messageContainerDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}


function displayPublicMessage(msg: ChatMessage) {
    const messagesArea = document.getElementById("chatMessagesArea");
    if (!messagesArea) return;

    const messageContainerDiv = document.createElement("div");
    messageContainerDiv.className = "text-left text-xs py-1";

    const isMyMessage = msg.fromUserId === `user_${currentUserId}`;
    const usernameColor = isMyMessage ? 'text-[#8be076]' : 'text-[#4cb4e7]';
    const messageColor = isMyMessage ? 'text-white' : 'text-slate-300';

    messageContainerDiv.innerHTML = `
        <strong class="${usernameColor}">${msg.fromUsername}:</strong>
        <span class="${messageColor} ml-1 break-all">${msg.content}</span>
    `;

    messagesArea.appendChild(messageContainerDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}


// NEW LOGIC: Updated invitation display and handling
function displayInviteInChat(
    messagesArea: HTMLElement,
    inviterUsername: string,
    inviterPrefixedId: string
) {
    const inviteMessageDiv = document.createElement('div');
    inviteMessageDiv.id = `invite_${inviterPrefixedId}_${Date.now()}`;
    inviteMessageDiv.className = 'p-2 my-1 rounded-md bg-slate-700 border border-slate-600 text-sm';
    inviteMessageDiv.innerHTML = `
        <span><strong>${inviterUsername}</strong> invites you to play Pong!</span>
        <button data-action="accept" data-inviterid="${inviterPrefixedId}" data-invitername="${inviterUsername}" class="ml-2 px-3 py-1 bg-[#53D4C0] hover:bg-green-600 text-white text-xs font-semibold rounded-md transition-colors">Accept</button>
        <button data-action="decline" data-inviterid="${inviterPrefixedId}" class="ml-1 px-3 py-1 bg-[#D4535B] hover:bg-red-600 text-white text-xs font-semibold rounded-md transition-colors">Decline</button>
    `;

    const acceptButton = inviteMessageDiv.querySelector('button[data-action="accept"]') as HTMLButtonElement;
    const declineButton = inviteMessageDiv.querySelector('button[data-action="decline"]') as HTMLButtonElement;

    if (acceptButton) {
        acceptButton.onclick = () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                console.log(`[CHATCLIENT] Accepting Pong invite from: ${inviterUsername}`);
                socket.send(JSON.stringify({
                    type: 'PONG_ACCEPT_INVITE',
                    inviterId: inviterPrefixedId,
                    inviterUsername: inviterUsername
                }));
                inviteMessageDiv.innerHTML = `<span>Accepted Pong invitation from <strong>${inviterUsername}</strong>. Waiting for game to start...</span>`;
            } else {
                alert("Cannot accept invite: WebSocket is not connected.");
                inviteMessageDiv.innerHTML = `<span>Could not accept invitation from <strong>${inviterUsername}</strong> (connection error).</span>`;
            }
        };
    }

    if (declineButton) {
        declineButton.onclick = () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                console.log(`[CHATCLIENT] Declined Pong invite from: ${inviterUsername}`);
                socket.send(JSON.stringify({
                    type: 'PONG_INVITE_DECLINED',
                    inviterId: inviterPrefixedId
                }));
                 inviteMessageDiv.innerHTML = `<span>You declined the Pong invitation from <strong>${inviterUsername}</strong>.</span>`;
            } else {
                alert("Cannot decline invite: WebSocket is not connected.");
                inviteMessageDiv.innerHTML = `<span>Could not decline invitation from <strong>${inviterUsername}</strong> (connection error).</span>`;
            }
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

export function sendPongLeaveGame(gameId: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = { type: 'PONG_LEAVE_GAME', gameId };
    socket.send(JSON.stringify(payload));
    console.log(`[CHATCLIENT] Sent PONG_LEAVE_GAME for gameId: ${gameId}`);
  } else {
    console.error('[CHATCLIENT] WebSocket not connected. Cannot send PONG_LEAVE_GAME.');
  }
}



