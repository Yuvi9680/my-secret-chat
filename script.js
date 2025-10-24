// =================================================================================
// JAVASCRIPT LOGIC START
// =================================================================================

// Wait for the DOM to be ready
document.addEventListener('DOMContentLoaded', () => {

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

    // Initialize Firebase
    try {
        const app = firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth(); // Yeh zaroori hai
        const db = firebase.database();
        
        // --- Global Variables ---
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

        // --- DOM Elements ---
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

        // Function to get or create a unique client ID
        // *** BUG FIX: UID ko parameter ki tarah pass kiya ***
        function getClientId(uid) {
            let id = localStorage.getItem('mySecretClientId');
            if (!id) {
                // Use the UID passed from the login
                id = uid; 
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
                    const friendName = friendsList[callData.from]?.name || `AI Bot (${callData.from.substring(0,6)}...)`;
                    showIncomingCallAlert(callData.type, friendName, callData.from, snapshot.key);
                }
                // Listen for hangup signals
                if (callData && callData.hungup) {
                    hangUp(false); // Hang up without sending another signal
                    snapshot.ref.remove();
                }
            });
        }
        
        // Main function to start the app after login
        // *** BUG FIX: UID ko yahaan receive kiya ***
        function startApp(uid) {
            myClientId = getClientId(uid); // UID ko pass kiya
            loadFriends();
            initPresence();
            initCallListener();
            listenForNewChats();
            navigateTo('chat-list-screen');
        }

        // =======================================
        // 2. PASSWORD & NAVIGATION
        // =======================================

        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (passwordInput.value === APP_PASSWORD) {
                passwordError.style.visibility = 'hidden';
                
                // Sign in anonymously to Firebase
                auth.signInAnonymously()
                    .then((userCredential) => {
                        // *** BUG FIX: Login se mila UID seedha startApp ko bheja ***
                        startApp(userCredential.user.uid);
                    })
                    .catch((error) => {
                        console.error("Firebase Auth Error:", error);
                        passwordError.textContent = "Could not connect to services.";
                        passwordError.style.visibility = 'visible';
                    });
            } else {
                passwordError.style.visibility = 'visible';
                passwordError.textContent = "Incorrect password. Please try again.";
            }
        });

        function navigateTo(screenId) {
            if (screenId === 'password-screen') {
                passwordScreen.style.transform = 'translateX(0%)';
                chatListScreen.style.transform = 'translateX(100%)';
                chatRoomScreen.style.transform = 'translateX(100%)';
            }
            if (screenId === 'chat-list-screen') {
                passwordScreen.style.transform = 'translateX(-100%)';
                chatListScreen.style.transform = 'translateX(0%)';
                chatRoomScreen.style.transform = 'translateX(100%)';
            }
            if (screenId === 'chat-room-screen') {
                chatListScreen.style.transform = 'translateX(-100%)';
                chatRoomScreen.style.transform = 'translateX(0%)';
            }
        }

        backToListBtn.addEventListener('click', () => {
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
        });
        
        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
        });

        // =======================================
        // 3. CHAT LIST LOGIC (FRIENDS)
        // =======================================
        
        myIdButton.addEventListener('click', () => {
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
                    try {
                        navigator.clipboard.writeText(myClientId).then(() => {
                            alert("ID copied to clipboard!");
                        }).catch(err => {
                            // Fallback for older browsers
                            modalInputText.select();
                            document.execCommand('copy');
                            alert("ID copied to clipboard!");
                        });
                    } catch (e) {
                        modalInputText.select();
                        document.execCommand('copy');
                        alert("ID copied to clipboard!");
                    }
                }
            });
        });

        addFriendButton.addEventListener('click', () => {
            showModal({
                title: "Add AI Bot",
                text: "Enter your friend's Secret ID to start chatting.",
                inputText: "",
                placeholder: "Friend's Secret ID",
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
                        // If friend exists, just open the chat
                        handleChatOpen(friendId, friendsList[friendId].name, friendsList[friendId].chatLock);
                        return;
                    }
                    
                    // Add new friend with a default name
                    const newFriendName = `AI Bot (${friendId.substring(0, 6)}...)`;
                    friendsList[friendId] = {
                        name: newFriendName,
                        chatLock: null // No lock by default
                    };
                    saveFriends();
                    renderChatList();
                    
                    // Open chat immediately
                    openChatRoom(friendId, newFriendName);
                }
            });
        });
        
        // Function to generate a sorted chat ID
        function getChatId(friendId) {
            const ids = [myClientId, friendId].sort();
            return ids.join('_');
        }
        
        // Render the list of chats
        function renderChatList() {
            chatList.innerHTML = '';
            if (Object.keys(friendsList).length === 0) {
                chatList.innerHTML = `<p style="text-align: center; color: var(--system-text); padding: 20px;">Your added AI Bots will appear here. Tap '+' to add one.</p>`;
                return;
            }
            
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
                    showChatListContextMenu(e, friendId);
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
        function showChatListContextMenu(e, friendId) {
            contextFriendId = friendId; // Store which friend
            
            // Show menu
            chatListContextMenu.style.top = `${e.clientY}px`;
            chatListContextMenu.style.left = `${e.clientX}px`;
            chatListContextMenu.style.display = 'block';
        }
        
        // Listeners for the chat list context menu (defined once)
        document.getElementById('context-rename').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
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
            chatListContextMenu.style.display = 'none';
        };

        document.getElementById('context-lock').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
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
            chatListContextMenu.style.display = 'none';
        };

        document.getElementById('context-remove-lock').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
            if (!friendsList[friendId].chatLock) {
                alert("This chat is not locked.");
                chatListContextMenu.style.display = 'none';
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
            chatListContextMenu.style.display = 'none';
        };
        
        document.getElementById('context-delete-chat').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
            if (confirm(`Are you sure you want to delete all messages and history with "${friendsList[friendId].name}"? This cannot be undone.`)) {
                // Delete chat messages from Firebase
                const chatId = getChatId(friendId);
                db.ref(`messages/${chatId}`).remove();
                
                // Delete friend from local storage
                delete friendsList[friendId];
                saveFriends();
                renderChatList();
            }
            chatListContextMenu.style.display = 'none';
        };


        // =======================================
        // 4. CHAT ROOM LOGIC (MESSAGES)
        // =======================================

        function openChatRoom(friendId, friendName) {
            currentChatId = getChatId(friendId);
            currentFriendId = friendId;
            currentFriendName = friendName;

            chatRoomName.textContent = friendName;
            messageList.innerHTML = ''; // Clear old messages
            
            // Check for seen messages on load
            cleanupSeenMessages();

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
                displayMessage(msg, true);
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
                        if (meta && msg.seenBy && msg.seenBy[currentFriendId] && !meta.textContent.includes('Seen')) {
                            meta.textContent += ' ✓ Seen';
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
                        // Only update if not deleted for me
                        if (!msg.deletedFor || !msg.deletedFor[myClientId]) {
                            const previewEl = document.getElementById(`preview_${friendId}`);
                            if (previewEl) {
                                if (msg.type === 'locked' && msg.senderId === myClientId) {
                                    previewEl.textContent = '🔒 Locked Message';
                                } else {
                                    previewEl.textContent = msg.text;
                                }
                            }
                        }
                    });
                }
            });
            
            // Get unread count
            messagesRef.on('value', (snapshot) => {
                let unreadCount = 0;
                snapshot.forEach((child) => {
                    const msg = child.val();
                    // Count only messages *not* sent by me and *not* seen by me
                    if (msg.senderId !== myClientId && 
                        (!msg.seenBy || !msg.seenBy[myClientId]) &&
                        (!msg.deletedFor || !msg.deletedFor[myClientId])) 
                    {
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
                        // Load the first message to get senderId (which is friendId)
                        db.ref(`messages/${chatId}`).orderByChild('timestamp').limitToFirst(1).once('value', (msgSnap) => {
                            if (!msgSnap.exists()) return;
                            msgSnap.forEach((childSnap) => {
                                const senderId = childSnap.val().senderId;
                                if(senderId === friendId) {
                                    const newFriendName = `AI Bot (${senderId.substring(0, 6)}...)`;
                                    friendsList[senderId] = {
                                        name: newFriendName,
                                        chatLock: null
                                    };
                                    saveFriends();
                                    renderChatList();
                                }
                            });
                        });
                    }
                }
            });
        }


        // Display a single message in the chat window
        function displayMessage(msg, isNew) {
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
                    messageText = '🔒 ' + lockedMsg.encryptedText.substring(0, 15) + '...'; // Show encrypted text
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
            
            // Add to top (because of column-reverse)
            messageList.insertBefore(container, messageList.firstChild); 

            // Scroll to bottom
            chatWindow.scrollTop = 0; // 0 is bottom because of column-reverse
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
                e.stopPropagation(); // Stop event from bubbling
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
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(false);
        });
        
        lockButton.addEventListener('click', () => {
            sendMessage(true);
        });

        function sendMessage(isLocked) {
            const text = messageInput.value.trim();
            if (text === '') return;

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
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    seenBy: null,
                    deletedFor: null
                };
            } else {
                // Regular message
                messageData = {
                    senderId: myClientId,
                    text: text,
                    type: 'normal',
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    seenBy: null,
                    deletedFor: null
                };
            }

            newMessageRef.set(messageData)
                .then(() => {
                    // Message sent
                    messageInput.value = '';
                    messageInput.style.height = 'auto'; // Reset height
                })
                .catch((error) => {
                    console.error('Error sending message: ', error);
                    alert('Message could not be sent.');
                });
        }
        
        // --- Message Deletion ---
        contextDeleteMe.addEventListener('click', () => {
            if (!contextMsgId) return;
            // Delete just for me
            const deletedForRef = db.ref(`messages/${currentChatId}/${contextMsgId}/deletedFor/${myClientId}`);
            deletedForRef.set(true);
            contextMenu.style.display = 'none';
        });
        
        contextDeleteEveryone.addEventListener('click', () => {
            if (!contextMsgId) return;
            // Delete from database (for everyone)
            db.ref(`messages/${currentChatId}/${contextMsgId}`).remove();
            contextMenu.style.display = 'none';
        });
        
        // Hide context menu on click outside
        document.addEventListener('click', (e) => {
            contextMenu.style.display = 'none';
            chatListContextMenu.style.display = 'none';
        });


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
        
        modalButtonPrimary.addEventListener('click', () => {
            modal.style.display = 'none';
            if (modalCallback) {
                modalCallback({
                    primary: true,
                    inputText: modalInputText.value,
                    password: modalInputPassword.value
                });
            }
        });
        
        modalButtonSecondary.addEventListener('click', () => {
            modal.style.display = 'none';
            if (modalCallback) {
                modalCallback({ primary: false });
            }
        });


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
        
        // Save/Get locked messages from local storage
        function saveLockedMessage(msgId, encryptedText, password) {
            // We just save the encrypted text. We don't save the password.
            let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
            lockedMessages[msgId] = { encryptedText };
            localStorage.setItem('myLockedMessages', JSON.stringify(lockedMessages));
        }
        
        function getLockedMessage(msgId) {
            let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
            return lockedMessages[msgId];
        }
        
// =======================================
        // 7. WebRTC (CALLING) LOGIC
        // =======================================
        
        // Firebase STUN servers (Google's public servers)
        const pcConfig = {
            'iceServers': [
                { 'urls': 'stun:stun.l.google.com:19302' },
                { 'urls': 'stun:stun1.l.google.com:19302' },
            ]
        };
        
        let currentCallId = null;
        let currentCallType = null;
        let currentCallFriendId = null;
        
        // --- Making a Call ---
        voiceCallBtn.addEventListener('click', () => startCall('voice'));
        videoCallBtn.addEventListener('click', () => startCall('video'));

        async function startCall(type) {
            if (!currentFriendId) return;
            console.log(`Starting ${type} call to ${currentFriendId}`);
            currentCallType = type;
            currentCallFriendId = currentFriendId;
            
            const callRef = db.ref(`calls/${currentFriendId}`).push();
            currentCallId = callRef.key;
            
            // 1. Get local media (audio/video)
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: type === 'video',
                    audio: true
                });
                showCallingScreen(type, `Calling ${currentFriendName}...`);
                attachMediaStream(document.getElementById('local-video'), localStream);
            } catch (e) {
                console.error("Error getting user media:", e);
                alert("Could not start call. Check camera/mic permissions.");
                return;
            }
            
            // 2. Create RTCPeerConnection
            const pc = createPeerConnection(currentFriendId, currentCallId, type);
            rtpcConnections[currentCallId] = pc;
            
            // 3. Add local tracks to PC
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
            
            // 4. Create Offer and set as local description
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
                    alert("Call declined.");
                    hangUp(false);
                    snapshot.ref.remove();
                }
                // Check if friend hung up
                if (data && data.hungup) {
                    hangUp(false);
                    snapshot.ref.remove();
                }
            });
            
            // 7. Listen for ICE candidates from friend
            db.ref(`iceCandidates/${currentFriendId}/${currentCallId}`).on('child_added', (snapshot) => {
                if (snapshot.exists()) {
                    pc.addIceCandidate(new RTCIceCandidate(snapshot.val()));
                    snapshot.ref.remove(); // Remove candidate after adding
                }
            });
        }

        // --- Receiving a Call ---
        function showIncomingCallAlert(type, friendName, friendId, callId) {
            // Don't show if already in a call
            if (currentCallId) {
                // Busy, auto-decline
                db.ref(`calls/${myClientId}/${callId}`).update({ declined: true });
                db.ref(`calls/${myClientId}/${callId}`).remove();
                return;
            }
            
            currentCallId = callId;
            currentCallType = type;
            currentCallFriendId = friendId;
            
            incomingCallTitle.textContent = `Incoming ${type} call...`;
            incomingCallFrom.textContent = `from ${friendName}`;
            incomingCallAlert.style.display = 'block';
            
            acceptCallBtn.onclick = () => acceptCall();
            declineCallBtn.onclick = () => declineCall();
        }
        
        async function acceptCall() {
            if (!currentCallId || !currentCallFriendId || !currentCallType) return;
            console.log(`Accepting ${currentCallType} call from ${currentCallFriendId}`);
            incomingCallAlert.style.display = 'none';
            
            const callRef = db.ref(`calls/${myClientId}/${currentCallId}`);
            
            // 1. Get local media
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: currentCallType === 'video',
                    audio: true
                });
                const friendName = friendsList[currentCallFriendId]?.name || currentCallFriendId;
                showCallingScreen(currentCallType, `On call with ${friendName}...`);
                attachMediaStream(document.getElementById('local-video'), localStream);
            } catch (e) {
                console.error("Error getting user media:", e);
                alert("Could not start call. Check camera/mic permissions.");
                return;
            }
            
            // 2. Create PC
            const pc = createPeerConnection(currentCallFriendId, currentCallId, currentCallType);
            rtpcConnections[currentCallId] = pc;
            
            // 3. Add local tracks
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
            
            // 4. Set Remote Description (the offer)
            const callData = (await callRef.once('value')).val();
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
            db.ref(`iceCandidates/${currentCallFriendId}/${currentCallId}`).on('child_added', (snapshot) => {
                if (snapshot.exists()) {
                    pc.addIceCandidate(new RTCIceCandidate(snapshot.val()));
                    snapshot.ref.remove();
                }
            });
            
            // 8. Listen for hangup
            callRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.hungup) {
                    hangUp(false);
                    snapshot.ref.remove();
                }
            });
        }

        function declineCall() {
            console.log("Declining call");
            incomingCallAlert.style.display = 'none';
            // Notify caller that call was declined
            db.ref(`calls/${myClientId}/${currentCallId}`).update({ declined: true });
            db.ref(`calls/${myClientId}/${currentCallId}`).remove();
            currentCallId = null;
            currentCallFriendId = null;
            currentCallType = null;
        }
        
        // --- Common Call Functions ---
        function createPeerConnection(friendId, callId, type) {
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
                const remoteVideo = document.getElementById('remote-video');
                attachMediaStream(remoteVideo, remoteStream);
                if (type === 'voice') remoteVideo.style.display = 'none';
                
                const friendName = friendsList[friendId]?.name || friendId;
                callingStatus.textContent = `On call with ${friendName}`;
            };
            
            pc.onconnectionstatechange = (event) => {
                console.log("PC Connection State:", pc.connectionState);
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    hangUp(true); // Send hangup signal
                }
            };
            
            return pc;
        }
        
        function showCallingScreen(type, status) {
            const remoteVideo = document.getElementById('remote-video');
            const localVideo = document.getElementById('local-video');
            
            if (type === 'voice') {
                remoteVideo.style.display = 'none';
                localVideo.style.display = 'none';
            } else {
                remoteVideo.style.display = 'block';
                localVideo.style.display = 'block';
            }
            
            callingStatus.textContent = status;
            callTimer.textContent = '00:00';
            hangupButton.onclick = () => hangUp(true); // Send hangup signal
            
            callingScreen.style.display = 'flex';
        }
        
        function hangUp(sendSignal = true) {
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
            
            // 3. Send hangup signal to friend
            if (sendSignal && currentCallId && currentCallFriendId) {
                db.ref(`calls/${currentCallFriendId}/${currentCallId}`).update({ hungup: true });
            }
            
            // 4. Clean up Firebase (delete call and candidates)
            if (currentCallId) {
                // Delete my call entry
                db.ref(`calls/${myClientId}/${currentCallId}`).remove();
                
                // Clean up candidates
                db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove();
                if(currentCallFriendId) {
                    db.ref(`iceCandidates/${currentCallFriendId}/${currentCallId}`).remove();
                }
            }

            // 5. Hide calling screen
            callingScreen.style.display = 'none';
            incomingCallAlert.style.display = 'none';
            currentCallId = null;
            currentCallType = null;
            currentCallFriendId = null;
            
            // 6. Stop timer
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

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        alert("CRITICAL ERROR: Could not connect to services. App will not work.");
        document.body.innerHTML = "Error loading app. Please check console.";
    }
}); // End of DOMContentLoaded
        
                            
