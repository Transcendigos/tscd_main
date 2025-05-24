const socketA = new WebSocket('ws://localhost:3000/ws/chat');
const userAToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoianVsaW8iLCJlbWFpbCI6Imp1bGlvQHByb3V0LnBldCIsImlhdCI6MTc0ODA5Mjk4NCwiZXhwIjoxNzQ4Njk3Nzg0fQ.zQYvVZa6RZUtnNyMe_5hmzC4Q5x9_D4h3FhLi8kLeEc"; // PASTE USER A's TOKEN
let userA_ID = null; // Will be set on auth_success

socketA.onopen = function(event) {
    console.log("UserA: WebSocket Connection Opened!");
    // Send authentication message
    socketA.send(JSON.stringify({
        type: "auth",
        token: userAToken
    }));
    console.log("UserA: Sent auth message.");
};

socketA.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log("UserA: Received message:", message);
    if (message.type === 'auth_success' && message.user) {
        userA_ID = message.user.userId;
        console.log("UserA Authenticated! UserID:", userA_ID, "Username:", message.user.username);
    }
    // You can add more logic here to display messages nicely if you want
};

socketA.onerror = function(error) {
    console.error("UserA: WebSocket Error:", error);
};

socketA.onclose = function(event) {
    console.log("UserA: WebSocket Connection Closed:", event.code, event.reason);
};

// Function to send a message (we'll call this later)
function sendUserAMessage(toUserId, content) {
    if (socketA.readyState === WebSocket.OPEN && userA_ID) {
        const msg = {
            type: "privateMessage",
            toUserId: parseInt(toUserId),
            content: content
            // The backend uses the authenticatedUserId for sender, so no need to resend token here
        };
        socketA.send(JSON.stringify(msg));
        console.log("UserA: Sent private message:", msg);
    } else {
        console.error("UserA: WebSocket not open or not authenticated to send message.");
    }
}

