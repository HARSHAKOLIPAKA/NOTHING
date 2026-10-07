/* =========================================================
   CHATFLUX CLIENT
   Socket.IO + Frontend Logic
   ========================================================= */


/* =========================================================
   CONNECT TO SERVER
   ========================================================= */

const socket = io();


/* =========================================================
   ELEMENTS
   ========================================================= */

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");

const usernameInput = document.getElementById("usernameInput");
const joinButton = document.getElementById("joinButton");
const loginError = document.getElementById("loginError");

const currentUsername = document.getElementById("currentUsername");
const avatarLetter = document.getElementById("avatarLetter");

const messages = document.getElementById("messages");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const typingIndicator =
    document.getElementById("typingIndicator");

const onlineStatus =
    document.getElementById("onlineStatus");

const onlineCount =
    document.getElementById("onlineCount");

const usersList =
    document.getElementById("usersList");


/* =========================================================
   APP STATE
   ========================================================= */

let myUsername = "";

let typingTimer = null;

let isTyping = false;


/* =========================================================
   LOGIN
   ========================================================= */

joinButton.addEventListener("click", joinChat);


usernameInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        joinChat();
    }

});


function joinChat() {

    const username = usernameInput.value.trim();

    loginError.textContent = "";


    if (!username) {

        loginError.textContent =
            "Please enter a username.";

        usernameInput.focus();

        return;
    }


    if (username.length < 2) {

        loginError.textContent =
            "Username must contain at least 2 characters.";

        usernameInput.focus();

        return;
    }


    joinButton.disabled = true;

    joinButton.querySelector("span").textContent =
        "Connecting...";


    socket.emit("join chat", username);
}


/* =========================================================
   JOIN SUCCESSFUL
   ========================================================= */

socket.on("join successful", (data) => {

    myUsername = data.username;

    currentUsername.textContent =
        myUsername;

    avatarLetter.textContent =
        myUsername.charAt(0).toUpperCase();


    loginScreen.classList.add("hidden");

    chatScreen.classList.remove("hidden");


    updateStatus(true);


    messageInput.focus();


    socket.emit("request online users");

});


/* =========================================================
   SERVER ERROR
   ========================================================= */

socket.on("server error", (data) => {

    loginError.textContent =
        data.message || "Something went wrong.";

    joinButton.disabled = false;

    joinButton.querySelector("span").textContent =
        "Enter Chat";

});


/* =========================================================
   CONNECTION
   ========================================================= */

socket.on("connect", () => {

    updateStatus(true);

});


socket.on("disconnect", () => {

    updateStatus(false);

});


function updateStatus(connected) {

    if (!onlineStatus) {
        return;
    }


    if (connected) {

        onlineStatus.innerHTML =
            `<span class="status-dot"></span>
             Connected`;

    } else {

        onlineStatus.innerHTML =
            `<span
                class="status-dot"
                style="background:#fb7185;box-shadow:0 0 8px rgba(251,113,133,.8)"
             ></span>
             Reconnecting...`;

    }

}


/* =========================================================
   CHAT MESSAGE
   ========================================================= */

socket.on("chat message", (data) => {

    addMessage(data);

});


function addMessage(data) {

    removeWelcomeMessage();


    const message = document.createElement("div");

    const isMine =
        data.username === myUsername;


    message.className =
        `message ${isMine ? "mine" : ""}`;


    const content =
        document.createElement("div");

    content.className =
        "message-content";


    const meta =
        document.createElement("div");

    meta.className =
        "message-meta";


    const name =
        document.createElement("span");

    name.className =
        "message-name";

    name.textContent =
        isMine ? "You" : data.username;


    const time =
        document.createElement("span");

    time.className =
        "message-time";

    time.textContent =
        formatTime(data.time);


    meta.appendChild(name);

    meta.appendChild(time);


    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.textContent =
        data.message;


    content.appendChild(meta);

    content.appendChild(bubble);

    message.appendChild(content);

    messages.appendChild(message);


    scrollToBottom();

}


/* =========================================================
   SYSTEM MESSAGE
   ========================================================= */

socket.on("system message", (data) => {

    addSystemMessage(data.text);

});


function addSystemMessage(text) {

    removeWelcomeMessage();


    const element =
        document.createElement("div");

    element.className =
        "system-message";

    element.textContent =
        text;

    messages.appendChild(element);


    scrollToBottom();

}


/* =========================================================
   REMOVE WELCOME
   ========================================================= */

function removeWelcomeMessage() {

    const welcome =
        messages.querySelector(".welcome-message");

    if (welcome) {
        welcome.remove();
    }

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

messageForm.addEventListener("submit", (event) => {

    event.preventDefault();

    sendMessage();

});


function sendMessage() {

    const message =
        messageInput.value.trim();


    if (!message) {
        return;
    }


    socket.emit(
        "chat message",
        message
    );


    messageInput.value = "";


    stopTyping();

    messageInput.focus();

}


/* =========================================================
   TYPING
   ========================================================= */

messageInput.addEventListener("input", () => {

    if (!myUsername) {
        return;
    }


    if (!isTyping) {

        isTyping = true;

        socket.emit("typing");

    }


    clearTimeout(typingTimer);


    typingTimer =
        setTimeout(() => {

            stopTyping();

        }, 900);

});


function stopTyping() {

    if (!isTyping) {
        return;
    }


    isTyping = false;

    socket.emit("stop typing");

}


/* =========================================================
   USER TYPING
   ========================================================= */

socket.on("user typing", (data) => {

    typingIndicator.textContent =
        `${data.username} is typing...`;

});


socket.on("user stopped typing", () => {

    typingIndicator.textContent = "";

});


/* =========================================================
   ONLINE USERS
   ========================================================= */

socket.on("online users", (users) => {

    renderUsers(users);

});


function renderUsers(users) {

    usersList.innerHTML = "";


    onlineCount.textContent =
        users.length;


    users.forEach((user) => {

        const item =
            document.createElement("div");

        item.className =
            "user-item";


        const avatar =
            document.createElement("div");

        avatar.className =
            "user-item-avatar";

        avatar.textContent =
            user.username
                .charAt(0)
                .toUpperCase();


        const name =
            document.createElement("span");

        name.className =
            "user-item-name";

        name.textContent =
            user.username;


        item.appendChild(avatar);

        item.appendChild(name);

        usersList.appendChild(item);

    });

}


/* =========================================================
   PRIVATE MESSAGE
   ========================================================= */

socket.on("private message", (data) => {

    /*
       Private messaging foundation is already supported
       by the server.

       For now we display the message in the chat.
       A future version can have separate private
       conversation screens.
    */

    addPrivateMessage(data);

});


function addPrivateMessage(data) {

    removeWelcomeMessage();


    const element =
        document.createElement("div");

    element.className =
        "system-message";


    if (data.sender === myUsername) {

        element.textContent =
            `Private message sent to ${data.receiver}`;

    } else {

        element.textContent =
            `Private message from ${data.sender}: ${data.message}`;

    }


    messages.appendChild(element);


    scrollToBottom();

}


/* =========================================================
   TIME
   ========================================================= */

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }


    const date =
        new Date(timestamp);


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    requestAnimationFrame(() => {

        messages.scrollTop =
            messages.scrollHeight;

    });

}


/* =========================================================
   EMOJI BUTTON
   ========================================================= */

const emojiButton =
    document.querySelector(".emoji-button");


if (emojiButton) {

    emojiButton.addEventListener(
        "click",
        () => {

            messageInput.value += "😊";

            messageInput.focus();

        }
    );

}


/* =========================================================
   ENTER KEY
   ========================================================= */

messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


/* =========================================================
   INITIAL FOCUS
   ========================================================= */

window.addEventListener("load", () => {

    usernameInput.focus();

});