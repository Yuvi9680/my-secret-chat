// =================================================================================
// JAVASCRIPT LOGIC START
// =================================================================================

// ⚠️ YUVI, APNA FIREBASE CONFIG YAHAN PASTE KARO ⚠️
// Maine aapka config pehle hi daal diya hai.
const firebaseConfig = {
  apiKey: "AIzaSyDVSPhPWVwciDfRF-aQbc6zTHBcub1jYmU",
  authDomain: "my-secret-chat-9779b.firebaseapp.com",
  databaseURL: "https://my-secret-chat-9779b-default-rtdb.firebaseio.com",
  projectId: "my-secret-chat-9779b",
  storageBucket: "my-secret-chat-9779b.firebasestorage.app",
  messagingSenderId: "801250293319",
  appId: "1:801250293319:web:811f00e9e6bde564046362",
  measurementId: "G-EL9ZHXP45E"
};
// ⚠️ FIREBASE CONFIG END ⚠️

// App Password
const APP_PASSWORD = "Yuvraj9680";

// --- Global App State ---
let myClientId;
let currentChatId = null;
let currentFriendId = null;
let currentFriendName = null;
let friendsList = {}; // Stores friend data
let messageListeners = {}; // To detach old listeners
let presenceRef;
let myPresenceRef;
let rtpcConnections = {}; // Store RTCPeerConnection objects
let localStream;
let remoteStream;
let callTimerInterval;

// --- Firebase STUN servers ---
const pcConfig = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
    ]
};

// --- DOM Elements ---
let db; // Firebase database instance
const appContainer = document.getElementById('app-container');
const passwordScreen = document.getElementById('password-screen');
const chatListScreen = document.getElementById('chat-list-screen');
const chatRoomScreen = document.getElementById('chat-room-screen');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const myIdButton = document.getElementById('my-id-button');
const addFriendButton = document.getElementById('add-friend-button');
const chatList = document.getElementById('chat-list');
const backToListBtn = document.getElementById('back-to-list-btn');
const chatRoomName = document.getElementById('chat-room-name');
const chatRoomStatus = document.getElementById('chat-room-status');
const messageList = document.getElementById('message-list');
const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const lockButton = document.getElementById('lock-button');
const sendButton = document.getElementById('send-button');

// Calling DOM Elements
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const incomingCallAlert = document.getElementById('incoming-call-alert');
const incomingCallTitle = document.getElementById('incoming-call-title');
const incomingCallFrom = document.getElementById('incoming-call-from');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const callingScreen = document.getElementById('calling-screen');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const callingStatus = document.getElementById('calling-status');
const callTimer = document.getElementById('call-timer');
const hangupButton = document.getElementById('hangup-button');

// Modal DOM Elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalInputText = document.getElementById('modal-input-text');
const modalInputPassword = document.getElementById('modal-input-password');
const modalButtonPrimary = document.getElementById('modal-button-primary');
const modalButtonSecondary = document.getElementById('modal-button-secondary');

// Context Menu (Message) DOM Elements
const contextMenu = document.getElementById('context-menu');
const contextDeleteMe = document.getElementById('context-delete-me');
const contextDeleteEveryone = document.getElementById('context-delete-everyone');
let contextMsgId = null; // Store which message is long-pressed

// Context Menu (Chat List) DOM Elements
const chatListContextMenu = document.getElementById('chat-list-context-menu');
let contextFriendId = null; // Store which friend is long-pressed


// =======================================
// 1. APP INITIALIZATION
// =======================================

// This runs when the script loads
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    
    // Add main password form listener
    passwordForm.addEventListener('submit', onPasswordSubmit);
    
    // Add navigation listeners
    backToListBtn.addEventListener('click', onBackToList);
    
    // Add chat list listeners
    myIdButton.addEventListener('click', onMyIdClick);
    addFriendButton.addEventListener('click', onAddFriendClick);
    
    // Add message form listeners
    messageForm.addEventListener('submit', onMessageSubmit);
    lockButton.addEventListener('click', onLockClick);
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // Add modal button listeners
    modalButtonPrimary.addEventListener('click', onModalPrimary);
    modalButtonSecondary.addEventListener('click', onModalSecondary);
    
    // Add context menu (message) listeners
    contextDeleteMe.addEventListener('click', onDeleteForMe);
    contextDeleteEveryone.addEventListener('click', onDeleteForEveryone);
    
    // Add call button listeners
    voiceCallBtn.addEventListener('click', () => startCall('voice'));
    videoCallBtn.addEventListener('click', () => startCall('video'));
    declineCallBtn.addEventListener('click', declineCall);
    hangupButton.addEventListener('click', hangUp);

    // Hide context menus on global click
    document.addEventListener('click', hideContextMenus);

} catch (error) {
    console.error("Firebase Initialization Error:", error);
    alert("Could not connect to services. App will not work.");
}


function onPasswordSubmit(e) {
    e.preventDefault();
    if (passwordInput.value === APP_PASSWORD) {
        // Correct password
        passwordError.style.visibility = 'hidden';
        passwordInput.value = '';
        // Initialize app after password
        myClientId = getClientId();
        loadFriends();
        initPresence();
        initCallListener();
        listenForNewChats();
        navigateTo('chat-list-screen');
    } else {
        // Incorrect password
        passwordError.style.visibility = 'visible';
    }
}

// Function to get or create a unique client ID
function getClientId() {
    let id = localStorage.getItem('mySecretClientId');
    if (!id) {
        id = 'client_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('mySecretClientId', id);
    }
    return id;
}

// Function to load saved friends from local storage
function loadFriends() {
    const savedFriends = localStorage.getItem('mySecretFriends');
    if (savedFriends) {
        friendsList = JSON.parse(savedFriends);
        renderChatList();
    }
}

// Function to save friends to local storage
function saveFriends() {
    localStorage.setItem('mySecretFriends', JSON.stringify(friendsList));
}

// Function to initialize Firebase Presence (Online/Offline)
function initPresence() {
    presenceRef = db.ref('presence');
    myPresenceRef = presenceRef.child(myClientId);

    // Set online status when connected
    db.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            myPresenceRef.set(true);
            // Set offline status on disconnect
            myPresenceRef.onDisconnect().remove();
        }
    });
}

// Function to initialize listener for incoming calls
function initCallListener() {
    const callRef = db.ref(`calls/${myClientId}`);
    callRef.on('child_added', (snapshot) => {
        const callData = snapshot.val();
        if (callData && callData.offer) {
            // Incoming call!
            const friendName = friendsList[callData.from]?.name || callData.from;
            showIncomingCallAlert(callData.type, friendName, callData.from, snapshot.key);
        }
        // Listen for hangup signals from caller
        snapshot.ref.on('child_changed', (childSnapshot) => {
            if (childSnapshot.key === 'hungup' && childSnapshot.val() === true) {
                // Caller hung up before we answered
                incomingCallAlert.style.display = 'none';
                snapshot.ref.remove();
            }
        });
    });
}

// =======================================
// 2. PASSWORD & NAVIGATION
// =======================================

function navigateTo(screenId) {
    if (screenId === 'password-screen') appContainer.style.transform = 'translateX(0%)';
    if (screenId === 'chat-list-screen') appContainer.style.transform = 'translateX(-100%)';
    if (screenId === 'chat-room-screen') appContainer.style.transform = 'translateX(-200%)';
}

function onBackToList() {
    navigateTo('chat-list-screen');
    // Detach old message listener
    if (currentChatId && messageListeners[currentChatId]) {
        messageListeners[currentChatId].off();
        delete messageListeners[currentChatId];
    }
    // Stop listening to friend's presence
    if (currentFriendId) {
        presenceRef.child(currentFriendId).off();
    }
    currentChatId = null;
    currentFriendId = null;
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
}

// =======================================
// 3. CHAT LIST LOGIC (FRIENDS)
// =======================================

function onMyIdClick() {
    showModal({
        title: "My Secret ID",
        text: "Share this ID with your friend. This is your permanent, secret identity.",
        inputText: myClientId,
        readOnly: true,
        primaryButton: "Copy",
        secondaryButton: "Close"
    }, (result) => {
        if (result.primary) {
            // Copy to clipboard
            navigator.clipboard.writeText(myClientId).then(() => {
                alert("ID copied to clipboard!");
            }).catch(err => {
                // Fallback for http
                modalInputText.select();
                document.execCommand('copy');
                alert("ID copied to clipboard!");
            });
        }
    });
}

function onAddFriendClick() {
    showModal({
        title: "Add AI Bot",
        text: "Enter your friend's Secret ID to start chatting.",
        inputText: "",
        placeholder: "client_...",
        primaryButton: "Add",
        secondaryButton: "Cancel"
    }, (result) => {
        if (result.primary && result.inputText) {
            const friendId = result.inputText.trim();
            if (friendId === myClientId) {
                alert("You cannot add yourself.");
                return;
            }
            if (friendsList[friendId]) {
                alert("This AI Bot is already in your list.");
                return;
            }
            
            // Add new friend with a default name
            addFriendToList(friendId);
            
            // Open chat immediately
            openChatRoom(friendId, friendsList[friendId].name);
        }
    });
}

// Adds friend to local list
function addFriendToList(friendId) {
    if (friendsList[friendId]) return; // Already exists
    
    const newFriendName = `AI Bot (${friendId.substring(0, 6)}...)`;
    friendsList[friendId] = {
        name: newFriendName,
        chatLock: null // No lock by default
    };
    saveFriends();
    renderChatList();
}

// Function to generate a sorted chat ID
function getChatId(friendId) {
    if (!friendId) return null;
    const ids = [myClientId, friendId].sort();
    return ids.join('_');
}

// Render the list of chats
function renderChatList() {
    chatList.innerHTML = '';
    Object.keys(friendsList).forEach(friendId => {
        const friend = friendsList[friendId];
        const chatListItem = document.createElement('div');
        chatListItem.className = 'chat-list-item';
        chatListItem.dataset.friendId = friendId;
        chatListItem.innerHTML = `
            <div class="chat-list-avatar">${friend.name.charAt(0).toUpperCase()}</div>
            <div class="chat-list-details">
                <div class="chat-list-name">${friend.name}</div>
                <div class="chat-list-preview" id="preview_${friendId}">...</div>
            </div>
            <div class="chat-list-meta">
                <span class="unread-badge" id="unread_${friendId}" style="display: none;">0</span>
            </div>
        `;
        
        // Click to open chat
        chatListItem.addEventListener('click', () => {
            handleChatOpen(friendId, friend.name, friend.chatLock);
        });
        
        // Long press to rename/lock/delete
        chatListItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showChatListContextMenu(friendId, e);
        });
        
        chatList.appendChild(chatListItem);
        
        // Start listening for unread messages
        listenForUnread(friendId);
    });
}

// Handle opening a chat (check for lock)
function handleChatOpen(friendId, friendName, chatLock) {
    if (chatLock) {
        // This chat is locked, ask for password
        showModal({
            title: `Unlock Chat: ${friendName}`,
            text: "This chat is locked. Please enter the password.",
            password: "",
            primaryButton: "Unlock",
            secondaryButton: "Cancel"
        }, (result) => {
            if (result.primary && result.password === chatLock) {
                openChatRoom(friendId, friendName);
            } else if (result.primary) {
                alert("Incorrect password.");
            }
        });
    } else {
        // No lock, open directly
        openChatRoom(friendId, friendName);
    }
}

// Context menu for chat list items
function showChatListContextMenu(friendId, e) {
    contextFriendId = friendId; // Store which friend is long-pressed
    
    const menu = document.getElementById('chat-list-context-menu');
    
    // Add listeners
    menu.querySelector('#context-rename').onclick = () => renameFriend(friendId);
    menu.querySelector('#context-lock').onclick = () => lockFriendChat(friendId);
    menu.querySelector('#context-remove-lock').onclick = () => removeLockFriendChat(friendId);
    menu.querySelector('#context-delete-chat').onclick = () => deleteFriendChat(friendId);
    
    // Show menu at click position
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.style.display = 'block';
}

function renameFriend(friendId) {
    const oldName = friendsList[friendId].name;
    showModal({
        title: "Rename AI Bot",
        text: `Enter a new name for "${oldName}".`,
        inputText: oldName,
        primaryButton: "Save",
        secondaryButton: "Cancel"
    }, (result) => {
        if (result.primary && result.inputText) {
            friendsList[friendId].name = result.inputText;
            saveFriends();
            renderChatList();
        }
    });
}

function lockFriendChat(friendId) {
    showModal({
        title: "Set Chat Lock",
        text: `Set a password for this chat.`,
        password: "",
        placeholder: "New password",
        primaryButton: "Set Lock",
        secondaryButton: "Cancel"
    }, (result) => {
        if (result.primary && result.password) {
            friendsList[friendId].chatLock = result.password;
            saveFriends();
            alert("Chat lock set!");
        }
    });
}

function removeLockFriendChat(friendId) {
    if (!friendsList[friendId].chatLock) {
        alert("This chat is not locked.");
        return;
    }
    showModal({
        title: "Remove Chat Lock",
        text: `Enter the current password to remove the lock.`,
        password: "",
        placeholder: "Current password",
        primaryButton: "Remove",
        secondaryButton: "Cancel"
    }, (result) => {
        if (result.primary && result.password === friendsList[friendId].chatLock) {
            friendsList[friendId].chatLock = null;
            saveFriends();
            alert("Chat lock removed!");
        } else if (result.primary) {
            alert("Incorrect password.");
        }
    });
}

function deleteFriendChat(friendId) {
    if (confirm(`Are you sure you want to permanently delete all messages and history with "${friendsList[friendId].name}"? This cannot be undone.`)) {
        // Delete chat messages from Firebase
        const chatId = getChatId(friendId);
        db.ref(`messages/${chatId}`).remove();
        
        // Delete friend from local storage
        delete friendsList[friendId];
        saveFriends();
        renderChatList();
    }
}

// =======================================
// 4. CHAT ROOM LOGIC (MESSAGES)
// =======================================

function openChatRoom(friendId, friendName) {
    currentChatId = getChatId(friendId);
    currentFriendId = friendId;
    currentFriendName = friendName;

    chatRoomName.textContent = friendName;
    messageList.innerHTML = ''; // Clear old messages

    // Listen for friend's online status
    presenceRef.child(friendId).on('value', (snapshot) => {
        if (snapshot.val() === true) {
            chatRoomStatus.textContent = '● AI Online';
            chatRoomStatus.className = 'online';
        } else {
            chatRoomStatus.textContent = '● AI Offline';
            chatRoomStatus.className = '';
        }
    });

    // Load messages
    loadMessages();
    
    // Snapchat Logic: Clean up messages I've seen before
    cleanupSeenMessages();
    
    // Show the chat room screen
    navigateTo('chat-room-screen');
}

// Load and listen for new messages
function loadMessages() {
    const messagesRef = db.ref(`messages/${currentChatId}`);
    
    // Detach old listener if exists
    if (messageListeners[currentChatId]) {
        messageListeners[currentChatId].off();
    }

    // Listen for new messages
    messageListeners[currentChatId] = messagesRef.orderByChild('timestamp');
    
    messageListeners[currentChatId].on('child_added', (snapshot) => {
        const msg = snapshot.val();
        msg.id = snapshot.key;
        
        // Chat Request Logic: Add friend if they messaged first
        if (!friendsList[msg.senderId] && msg.senderId !== myClientId) {
            addFriendToList(msg.senderId);
        }
        
        displayMessage(msg);
    });
    
    // Listen for message changes (seen, delete)
    messageListeners[currentChatId].on('child_changed', (snapshot) => {
        const msg = snapshot.val();
        msg.id = snapshot.key;
        const msgElement = document.getElementById(msg.id);
        if (msgElement) {
            // Check for deletion
            if (msg.deletedFor && msg.deletedFor[myClientId]) {
                msgElement.remove();
            } else {
                // Update seen status
                const meta = msgElement.querySelector('.message-meta');
                if (meta && msg.seenBy && msg.seenBy[currentFriendId]) {
                    // Avoid adding "Seen" multiple times
                    if (!meta.textContent.includes('Seen')) {
                         meta.textContent += ' ✓ Seen';
                    }
                }
            }
        }
    });
    
    // Listen for message deletion
    messageListeners[currentChatId].on('child_removed', (snapshot) => {
        const msgElement = document.getElementById(snapshot.key);
        if (msgElement) {
            msgElement.remove();
        }
    });
}

// Listen for unread messages for chat list
function listenForUnread(friendId) {
    const chatId = getChatId(friendId);
    const messagesRef = db.ref(`messages/${chatId}`);
    
    // Get last preview message
    messagesRef.orderByChild('timestamp').limitToLast(1).on('value', (snapshot) => {
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const msg = child.val();
                const previewEl = document.getElementById(`preview_${friendId}`);
                if (previewEl) {
                    if (msg.type === 'locked' && msg.senderId === myClientId) {
                        previewEl.textContent = '🔒 Locked Message';
                    } else {
                        previewEl.textContent = msg.text;
                    }
                }
            });
        }
    });
    
    // Get unread count
    messagesRef.orderByChild('seenBy').equalTo(null).on('value', (snapshot) => {
        let unreadCount = 0;
        snapshot.forEach((child) => {
            const msg = child.val();
            // Count only messages *not* sent by me and *not* seen by me
            if (msg.senderId !== myClientId && (!msg.seenBy || !msg.seenBy[myClientId])) {
                unreadCount++;
            }
        });
        
        const badgeEl = document.getElementById(`unread_${friendId}`);
        if (badgeEl) {
            if (unreadCount > 0) {
                badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badgeEl.style.display = 'block';
            } else {
                badgeEl.style.display = 'none';
            }
        }
    });
}

// Listen for new chats from unknown people
function listenForNewChats() {
    db.ref('messages').on('child_added', (snapshot) => {
        const chatId = snapshot.key;
        if (chatId.includes(myClientId)) {
            const friendId = chatId.replace(myClientId, '').replace('_', '');
            if (!friendsList[friendId] && friendId) {
                // This is a new chat from someone not in our list
                addFriendToList(friendId);
            }
        }
    });
}

// Display a single message in the chat window
function displayMessage(msg) {
    // Don't show messages deleted for me
    if (msg.deletedFor && msg.deletedFor[myClientId]) {
        return;
    }
    
    // Check if message is already displayed
    if (document.getElementById(msg.id)) {
        return;
    }
    
    const isUser = msg.senderId === myClientId;
    const container = document.createElement('div');
    container.id = msg.id;
    container.className = isUser ? 'message-container user-prompt' : 'message-container bot-response';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    let messageText = '';
    let isLockedForMe = false;

    if (isUser && msg.type === 'locked') {
        // It's my own locked message. Try to get it from local storage.
        const lockedMsg = getLockedMessage(msg.id);
        if (lockedMsg) {
            messageText = lockedMsg.encryptedText; // Show encrypted text
            isLockedForMe = true;
        } else {
            messageText = '🔒 Locked Message (content lost)';
        }
    } else {
        // It's a friend's message or my own unlocked message
        messageText = msg.text;
    }
    
    bubble.textContent = messageText;

    // Add meta info (timestamp and seen status)
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    let metaText = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isUser && msg.seenBy && msg.seenBy[currentFriendId]) {
        metaText += ' ✓ Seen';
    }
    
    meta.textContent = metaText;
    
    container.appendChild(bubble);
    container.appendChild(meta);
    messageList.prepend(container); // Add to TOP (because of flex-direction: column-reverse)

    // --- Event Listeners for the Bubble ---
    
    // 1. Click (Tap) listener (for unlocking)
    if (isLockedForMe) {
        bubble.style.cursor = 'pointer';
        bubble.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop click from bubbling to document
            const lockedMsg = getLockedMessage(msg.id);
            if (!lockedMsg) return;
            
            showModal({
                title: "Unlock Message",
                text: "Enter password to decrypt this message.",
                password: "",
                primaryButton: "Unlock",
                secondaryButton: "Cancel"
            }, (result) => {
                if (result.primary && result.password) {
                    try {
                        const decrypted = decryptText(lockedMsg.encryptedText, result.password);
                        bubble.textContent = decrypted; // Show decrypted text
                    } catch (e) {
                        alert("Incorrect password.");
                    }
                }
            });
        });
    }
    
    // 2. Context Menu (Long Press) listener (for deleting)
    bubble.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop it from closing immediately
        contextMsgId = msg.id;
        
        // Show delete options
        contextDeleteMe.style.display = 'block';
        contextDeleteEveryone.style.display = 'block';
        
        // Only sender can delete for everyone
        if (!isUser) {
            contextDeleteEveryone.style.display = 'none';
        }
        
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.display = 'block';
    });

    // Mark message as seen
    if (!isUser && (!msg.seenBy || !msg.seenBy[myClientId])) {
        markMessageAsSeen(msg.id);
    }
}

// Mark a message as seen
function markMessageAsSeen(msgId) {
    const seenRef = db.ref(`messages/${currentChatId}/${msgId}/seenBy/${myClientId}`);
    seenRef.set(true);
}

// Snapchat Logic: Check for seen messages on load
function cleanupSeenMessages() {
    const messagesRef = db.ref(`messages/${currentChatId}`);
    messagesRef.orderByChild(`seenBy/${myClientId}`).equalTo(true).once('value', (snapshot) => {
        snapshot.forEach((child) => {
            // This message was seen by me. Delete it FOR ME.
            const msgId = child.key;
            const deletedForRef = db.ref(`messages/${currentChatId}/${msgId}/deletedFor/${myClientId}`);
            deletedForRef.set(true);
        });
    });
}

// --- Message Sending ---
function onMessageSubmit(e) {
    e.preventDefault();
    sendMessage(false);
}

function onLockClick() {
    sendMessage(true);
}

function sendMessage(isLocked) {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;

    if (isLocked) {
        // Ask for password to lock
        showModal({
            title: "Lock Message",
            text: "Create a password for this message. Only you will need it to unlock.",
            password: "",
            placeholder: "Password",
            primaryButton: "Lock & Send",
            secondaryButton: "Cancel"
        }, (result) => {
            if (result.primary && result.password) {
                sendFirebaseMessage(text, true, result.password);
            }
        });
    } else {
        // Send regular unlocked message
        sendFirebaseMessage(text, false, null);
    }
}

function sendFirebaseMessage(text, isLocked, password) {
    const messagesRef = db.ref(`messages/${currentChatId}`);
    const newMessageRef = messagesRef.push();
    const msgId = newMessageRef.key;

    let messageData;

    if (isLocked) {
        // Sender-Side Lock Logic
        // 1. Encrypt text for local storage
        const encryptedText = encryptText(text, password);
        saveLockedMessage(msgId, encryptedText, password);
        
        // 2. Send the REAL (unlocked) text to Firebase
        messageData = {
            senderId: myClientId,
            text: text, // Send real text
            type: 'locked', // Mark as 'locked' so sender's UI can check it
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
    } else {
        // Regular message
        messageData = {
            senderId: myClientId,
            text: text,
            type: 'normal',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
    }

    newMessageRef.set(messageData)
        .then(() => {
            // Message sent
            messageInput.value = '';
            autoResizeTextarea(); // Reset height
        })
        .catch((error) => {
            console.error('Error sending message: ', error);
            alert('Message could not be sent.');
        });
}

// --- Message Deletion ---
function onDeleteForMe() {
    if (!contextMsgId) return;
    // Delete just for me
    const deletedForRef = db.ref(`messages/${currentChatId}/${contextMsgId}/deletedFor/${myClientId}`);
    deletedForRef.set(true);
    
    // Also remove from local storage if it was a locked message
    deleteLockedMessage(contextMsgId);
    
    hideContextMenus();
}

function onDeleteForEveryone() {
    if (!contextMsgId) return;
    // Delete from database (for everyone)
    db.ref(`messages/${currentChatId}/${contextMsgId}`).remove();
    
    // Also remove from local storage if it was a locked message
    deleteLockedMessage(contextMsgId);
    
    hideContextMenus();
}

// Hide context menus on click outside
function hideContextMenus() {
    if (contextMenu) contextMenu.style.display = 'none';
    if (chatListContextMenu) chatListContextMenu.style.display = 'none';
    contextMsgId = null;
    contextFriendId = null;
}

// =======================================
// 5. MODAL (POP-UP) HELPER
// =======================================

let modalCallback = null;

function showModal(options, callback) {
    modalTitle.textContent = options.title || "Confirmation";
    modalText.textContent = options.text || "";
    
    modalInputText.value = options.inputText || "";
    modalInputText.placeholder = options.placeholder || "";
    modalInputText.style.display = options.inputText !== undefined || options.placeholder ? 'block' : 'none';
    modalInputText.readOnly = options.readOnly || false;
    
    modalInputPassword.value = options.password || "";
    modalInputPassword.placeholder = options.passwordPlaceholder || "Password";
    modalInputPassword.style.display = options.password !== undefined ? 'block' : 'none';

    modalButtonPrimary.textContent = options.primaryButton || "OK";
    modalButtonSecondary.textContent = options.secondaryButton || "Cancel";
    
    modalCallback = callback;
    modal.style.display = 'flex';
}

function onModalPrimary() {
    modal.style.display = 'none';
    if (modalCallback) {
        modalCallback({
            primary: true,
            inputText: modalInputText.value,
            password: modalInputPassword.value
        });
    }
}

function onModalSecondary() {
    modal.style.display = 'none';
    if (modalCallback) {
        modalCallback({ primary: false });
    }
}

// =======================================
// 6. CRYPTO (LOCK/UNLOCK) HELPERS
// =======================================

function encryptText(text, password) {
    return CryptoJS.AES.encrypt(text, password).toString();
}

function decryptText(encryptedText, password) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, password);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
        throw new Error("Decryption failed");
    }
    return originalText;
}

// Save/Get/Delete locked messages from local storage
function saveLockedMessage(msgId, encryptedText) {
    let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
    lockedMessages[msgId] = { encryptedText };
    localStorage.setItem('myLockedMessages', JSON.stringify(lockedMessages));
}

function getLockedMessage(msgId) {
    let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
    return lockedMessages[msgId];
}

function deleteLockedMessage(msgId) {
    let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
    delete lockedMessages[msgId];
    localStorage.setItem('myLockedMessages', JSON.stringify(lockedMessages));
}


// =======================================
// 7. WebRTC (CALLING) LOGIC
// =======================================

let currentCallId = null;
let currentCallType = null;
let isCallInitiator = false;

// --- Making a Call ---
async function startCall(type) {
    console.log(`Starting ${type} call to ${currentFriendId}`);
    isCallInitiator = true;
    currentCallType = type;
    
    const callRef = db.ref(`calls/${currentFriendId}`).push();
    currentCallId = callRef.key;
    
    // 1. Get local media (audio/video)
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: type === 'video',
            audio: true
        });
        showCallingScreen(type, `Calling ${currentFriendName}...`);
        attachMediaStream(localVideo, localStream);
    } catch (e) {
        console.error("Error getting user media:", e);
        alert("Could not start call. Check camera/mic permissions.");
        return;
    }
    
    // 2. Create RTCPeerConnection
    const pc = createPeerConnection(currentFriendId, currentCallId);
    rtpcConnections[currentCallId] = pc;
    
    // 3. Add local tracks to PC
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    // 4. Create Offer and set as local description
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // 5. Send Offer to friend via Firebase
        const callData = {
            from: myClientId,
            to: currentFriendId,
            type: type,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        };
        await callRef.set(callData);
        
        // 6. Listen for Answer from friend
        callRef.on('value', async (snapshot) => {
            const data = snapshot.val();
            // Check for answer
            if (data && data.answer && !pc.currentRemoteDescription) {
                console.log("Got answer");
                const answer = new RTCSessionDescription(data.answer);
                await pc.setRemoteDescription(answer);
                startCallTimer();
            }
            // Check if friend declined
            if (data && data.declined) {
                console.log("Call declined by friend.");
                hangUp();
                callRef.remove();
            }
            // Check if friend hung up
            if (data && data.hungup) {
                console.log("Friend hung up.");
                hangUp();
                callRef.remove();
            }
        });
        
        // 7. Listen for ICE candidates from friend
        db.ref(`iceCandidates/${currentFriendId}/${currentCallId}`).on('child_added', (snapshot) => {
            if (snapshot.exists()) {
                pc.addIceCandidate(new RTCIceCandidate(snapshot.val()));
                snapshot.ref.remove(); // Remove candidate after adding
            }
        });
        
    } catch (e) {
        console.error("Error creating call:", e);
        hangUp();
    }
}

// --- Receiving a Call ---
function showIncomingCallAlert(type, friendName, friendId, callId) {
    currentCallId = callId;
    currentCallType = type;
    incomingCallTitle.textContent = `Incoming ${type} call...`;
    incomingCallFrom.textContent = `from ${friendName}`;
    incomingCallAlert.style.display = 'block';
    
    acceptCallBtn.onclick = () => acceptCall(friendId, callId, type);
}

async function acceptCall(friendId, callId, type) {
    console.log(`Accepting ${type} call from ${friendId}`);
    isCallInitiator = false;
    incomingCallAlert.style.display = 'none';
    
    const callRef = db.ref(`calls/${myClientId}/${callId}`);
    
    // 1. Get local media
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: type === 'video',
            audio: true
        });
        showCallingScreen(type, `On call with ${friendsList[friendId]?.name || friendId}`);
        attachMediaStream(localVideo, localStream);
    } catch (e) {
        console.error("Error getting user media:", e);
        alert("Could not start call. Check camera/mic permissions.");
        return;
    }
    
    // 2. Create PC
    const pc = createPeerConnection(friendId, callId);
    rtpcConnections[callId] = pc;
    
    // 3. Add local tracks
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    // 4. Set Remote Description (the offer)
    const callData = (await callRef.once('value')).val();
    if (!callData || !callData.offer) {
        console.error("Call data or offer missing.");
        hangUp();
        return;
    }
    const offer = new RTCSessionDescription(callData.offer);
    await pc.setRemoteDescription(offer);
    
    // 5. Create Answer and set as local description
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // 6. Send Answer to caller via Firebase
    await callRef.update({
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    });
    startCallTimer();
    
    // 7. Listen for ICE candidates from caller
    db.ref(`iceCandidates/${friendId}/${callId}`).on('child_added', (snapshot) => {
        if (snapshot.exists()) {
            pc.addIceCandidate(new RTCIceCandidate(snapshot.val()));
            snapshot.ref.remove();
        }
    });
    
    // 8. Listen for hangup from caller
    callRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.hungup) {
            console.log("Caller hung up.");
            hangUp();
            callRef.remove();
        }
    });
}

function declineCall() {
    console.log("Declining call");
    incomingCallAlert.style.display = 'none';
    
    if (currentCallId) {
        const callRef = db.ref(`calls/${myClientId}/${currentCallId}`);
        callRef.update({ declined: true });
        // Let the caller clean up
    }
    currentCallId = null;
}

// --- Common Call Functions ---
function createPeerConnection(friendId, callId) {
    const pc = new RTCPeerConnection(pcConfig);
    
    // Send ICE candidates to friend via Firebase
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            db.ref(`iceCandidates/${friendId}/${callId}`).push(event.candidate.toJSON());
        }
    };
    
    // When remote stream is added
    pc.ontrack = (event) => {
        console.log("Remote track received");
        if (!remoteStream) {
            remoteStream = new MediaStream();
        }
        remoteStream.addTrack(event.track);
        attachMediaStream(remoteVideo, remoteStream);
        callingStatus.textContent = `On call with ${friendsList[friendId]?.name || friendId}`;
    };
    
    pc.onconnectionstatechange = () => {
        console.log("PC Connection State:", pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            hangUp();
        }
    };
    
    return pc;
}

function showCallingScreen(type, status) {
    remoteVideo.style.display = (type === 'video') ? 'block' : 'none';
    localVideo.style.display = (type === 'video') ? 'block' : 'none';
    
    callingStatus.textContent = status;
    callTimer.textContent = '00:00';
    
    callingScreen.style.display = 'flex';
}

function hangUp() {
    console.log("Hanging up call");
    
    // 1. Close PeerConnection
    if (currentCallId && rtpcConnections[currentCallId]) {
        rtpcConnections[currentCallId].close();
        delete rtpcConnections[currentCallId];
    }
    
    // 2. Stop local media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // 3. Clean up Firebase (send hangup signal)
    if (currentCallId) {
        const friendId = isCallInitiator ? currentFriendId : (Object.values(friendsList).find(f => getChatId(f.id) === currentChatId)?.id || null);
        
        if (isCallInitiator) {
            // I started the call, I clean up my friend's entry
            if(currentFriendId) db.ref(`calls/${currentFriendId}/${currentCallId}`).update({ hungup: true });
        } else {
            // I received the call, I clean up my own entry
            db.ref(`calls/${myClientId}/${currentCallId}`).update({ hungup: true });
        }
    }
    
    // 4. Hide calling screen
    callingScreen.style.display = 'none';
    currentCallId = null;
    currentCallType = null;
    isCallInitiator = false;
    
    // 5. Stop timer
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
}

// Helper to attach stream
function attachMediaStream(element, stream) {
    if (element) {
        element.srcObject = stream;
    }
}

// Call Timer
function startCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    callTimer.textContent = '00:00';
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
}
