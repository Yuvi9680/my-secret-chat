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
        const auth = firebase.auth(); 
        const db = firebase.database();
        
        // --- Global Variables ---
        let myClientId;
        let currentChatId = null;
        let currentFriendId = null;
        let currentFriendName = null;
        let friendsList = {}; // Stores friend data { friendId: { name: "...", chatLock: "..." } }
        let messageListeners = {}; // To detach old listeners { chatId: firebaseRef }
        let unreadListeners = {}; // To detach unread listeners { friendId: firebaseRef }
        let presenceRef;
        let myPresenceRef;
        let rtpcConnections = {}; // Store RTCPeerConnection objects { callId: pc }
        let localStream;
        let remoteStream;
        let callTimerInterval;
        let currentCallId = null;
        let currentCallType = null;
        let currentCallFriendId = null;
        let isProcessingCleanup = false; // Flag to prevent multiple cleanup runs

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
        const chatWindow = document.getElementById('chat-window'); 
        
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
        let contextMsgId = null; 
        
        // Context Menu (Chat List) DOM Elements
        const chatListContextMenu = document.getElementById('chat-list-context-menu');
        let contextFriendId = null; 


        // =======================================
        // 1. APP INITIALIZATION
        // =======================================

        function getClientId(uid) {
            let id = localStorage.getItem('mySecretClientId');
            if (!id) {
                id = uid; 
                localStorage.setItem('mySecretClientId', id);
            }
            myClientId = id; 
            return id;
        }
        
        function loadFriends() {
            const savedFriends = localStorage.getItem('mySecretFriends');
            if (savedFriends) {
                try {
                    friendsList = JSON.parse(savedFriends);
                    renderChatList();
                } catch (e) {
                    console.error("Error parsing friends list:", e);
                    friendsList = {}; 
                }
            }
        }
        
        function saveFriends() {
            localStorage.setItem('mySecretFriends', JSON.stringify(friendsList));
        }

        function initPresence() {
            if (!myClientId) return; 
            presenceRef = db.ref('presence');
            myPresenceRef = presenceRef.child(myClientId);

            db.ref('.info/connected').on('value', (snapshot) => {
                if (snapshot.val() === true) {
                    myPresenceRef.set(true);
                    myPresenceRef.onDisconnect().remove();
                }
            });
        }
        
        function initCallListener() {
            if (!myClientId) return; 
            const callRef = db.ref(`calls/${myClientId}`);
            callRef.off(); 
            callRef.on('child_added', (snapshot) => {
                const callData = snapshot.val();
                if (callData && callData.offer && !callData.declined && !callData.hungup && !callData.answer) {
                    const friendName = friendsList[callData.from]?.name || `AI Bot (${callData.from.substring(0,6)}...)`;
                    showIncomingCallAlert(callData.type, friendName, callData.from, snapshot.key);
                }
                if (callData && (callData.hungup || callData.declined)) {
                   snapshot.ref.remove();
                }
            });
        }
        
        function startApp(uid) {
            myClientId = getClientId(uid); 
            console.log("App started for user:", myClientId);
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
            passwordError.style.visibility = 'hidden'; 
            
            if (passwordInput.value === APP_PASSWORD) {
                if (auth.currentUser) {
                    startApp(auth.currentUser.uid);
                } else {
                    auth.signInAnonymously()
                        .then((userCredential) => {
                            if (userCredential && userCredential.user) {
                                startApp(userCredential.user.uid);
                            } else {
                                throw new Error("Anonymous sign-in failed: No user returned.");
                            }
                        })
                        .catch((error) => {
                            console.error("Firebase Auth Error:", error);
                            passwordError.textContent = "Could not connect to services. Check connection or Firebase setup.";
                            passwordError.style.visibility = 'visible';
                        });
                }
            } else {
                passwordError.textContent = "Incorrect password. Please try again.";
                passwordError.style.visibility = 'visible';
            }
        });

        function navigateTo(screenId) {
             console.log("Navigating to:", screenId);
            if (passwordScreen && chatListScreen && chatRoomScreen) {
                if (screenId === 'password-screen') {
                    passwordScreen.style.transform = 'translateX(0%)';
                    chatListScreen.style.transform = 'translateX(100%)';
                    chatRoomScreen.style.transform = 'translateX(100%)';
                }
                if (screenId === 'chat-list-screen') {
                    passwordScreen.style.transform = 'translateX(-100%)';
                    chatListScreen.style.transform = 'translateX(0%)';
                    chatRoomScreen.style.transform = 'translateX(100%)';
                    currentChatId = null;
                    currentFriendId = null;
                    currentFriendName = null;
                }
                if (screenId === 'chat-room-screen') {
                    chatListScreen.style.transform = 'translateX(-100%)';
                    chatRoomScreen.style.transform = 'translateX(0%)';
                }
            } else {
                console.error("Navigation error: One or more screen elements not found.");
            }
        }


        backToListBtn.addEventListener('click', () => {
            if (currentChatId && messageListeners[currentChatId]) {
                 console.log("Detaching listener for chat:", currentChatId);
                messageListeners[currentChatId].off();
                delete messageListeners[currentChatId];
            }
            if (currentFriendId && presenceRef) {
                 console.log("Detaching presence listener for friend:", currentFriendId);
                presenceRef.child(currentFriendId).off();
            }
            // Detach unread listener when leaving chat? No, keep it for the list view.
            navigateTo('chat-list-screen');
        });
        
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            const scrollHeight = messageInput.scrollHeight;
            const maxHeight = 100; 
            messageInput.style.height = Math.min(scrollHeight, maxHeight) + 'px';
        });

        // =======================================
        // 3. CHAT LIST LOGIC (FRIENDS)
        // =======================================
        
        myIdButton.addEventListener('click', () => {
             if (!myClientId) {
                 alert("Cannot get ID before login is complete.");
                 return;
             }
            showModal({
                title: "My Secret ID",
                text: "Share this ID with your friend. This is your permanent, secret identity.",
                inputText: myClientId,
                readOnly: true,
                primaryButton: "Copy",
                secondaryButton: "Close"
            }, (result) => {
                if (result.primary) {
                    try {
                        navigator.clipboard.writeText(myClientId).then(() => {
                            alert("ID copied to clipboard!");
                        }).catch(err => {
                            modalInputText.select();
                            document.execCommand('copy');
                            alert("ID copied to clipboard (fallback)!");
                        });
                    } catch (e) {
                         modalInputText.select();
                         document.execCommand('copy');
                         alert("ID copied to clipboard (fallback)!");
                    }
                }
            });
        });

        addFriendButton.addEventListener('click', () => {
             if (!myClientId) {
                 alert("Cannot add friend before login is complete.");
                 return;
             }
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
                    if (!friendId) {
                         alert("Friend ID cannot be empty.");
                         return;
                    }
                    if (friendId === myClientId) {
                        alert("You cannot add yourself.");
                        return;
                    }
                    if (friendsList[friendId]) {
                        handleChatOpen(friendId, friendsList[friendId].name, friendsList[friendId].chatLock);
                        return;
                    }
                    
                    const newFriendName = `AI Bot (${friendId.substring(0, 6)}...)`;
                    friendsList[friendId] = {
                        name: newFriendName,
                        chatLock: null 
                    };
                    saveFriends();
                    renderChatList(); 
                    openChatRoom(friendId, newFriendName); 
                }
            });
        });
        
        function getChatId(friendId) {
             if (!myClientId || !friendId) return null; 
            const ids = [myClientId, friendId].sort();
            return ids.join('_');
        }
        
        function renderChatList() {
             if (!chatList) return; 
            chatList.innerHTML = '';
            const friendIds = Object.keys(friendsList);

            if (friendIds.length === 0) {
                chatList.innerHTML = `<p style="text-align: center; color: var(--system-text); padding: 20px;">Your added AI Bots will appear here. Tap '+' to add one.</p>`;
                return;
            }
            
            friendIds.forEach(friendId => {
                const friend = friendsList[friendId];
                if (!friend || !friend.name) {
                     console.warn("Skipping invalid friend data for ID:", friendId);
                     return; 
                }
                const chatListItem = document.createElement('div');
                chatListItem.className = 'chat-list-item';
                chatListItem.dataset.friendId = friendId;
                const avatarLetter = friend.name.charAt(0).toUpperCase();
                const friendNameText = friend.name;
                
                chatListItem.innerHTML = `
                    <div class="chat-list-avatar"></div>
                    <div class="chat-list-details">
                        <div class="chat-list-name"></div>
                        <div class="chat-list-preview" id="preview_${friendId}">Loading...</div> 
                    </div>
                    <div class="chat-list-meta">
                        <span class="unread-badge" id="unread_${friendId}" style="display: none;">0</span>
                    </div>
                `;
                chatListItem.querySelector('.chat-list-avatar').textContent = avatarLetter;
                chatListItem.querySelector('.chat-list-name').textContent = friendNameText;
                
                chatListItem.addEventListener('click', () => {
                    handleChatOpen(friendId, friend.name, friend.chatLock);
                });
                
                chatListItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    showChatListContextMenu(e, friendId);
                });
                
                chatList.appendChild(chatListItem);
                
                // Start listening AFTER adding to DOM
                listenForUnread(friendId);
            });
        }
        
        function handleChatOpen(friendId, friendName, chatLock) {
            if (chatLock) {
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
                openChatRoom(friendId, friendName);
            }
        }
        
        function showChatListContextMenu(e, friendId) {
            contextFriendId = friendId; 
            chatListContextMenu.style.top = `${e.clientY}px`;
            chatListContextMenu.style.left = `${e.clientX}px`;
            chatListContextMenu.style.display = 'block';
        }
        
        // Listeners for the chat list context menu 
        document.getElementById('context-rename').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
            const oldName = friendsList[friendId]?.name || `AI Bot (${friendId.substring(0,6)}...)`;
            showModal({
                title: "Rename AI Bot",
                text: `Enter a new name for "${oldName}".`,
                inputText: oldName, 
                primaryButton: "Save",
                secondaryButton: "Cancel"
            }, (result) => {
                if (result.primary && result.inputText) {
                     if (!friendsList[friendId]) friendsList[friendId] = {}; 
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
            const currentLock = friendsList[friendId]?.chatLock;

             // Logic slightly adjusted: One modal for set/change/remove
            showModal({
                title: currentLock ? "Change/Remove Chat Lock" : "Set Chat Lock",
                text: currentLock ? "Enter new password, or leave blank to remove lock." : "Set a password for this chat.",
                password: "", // Show password field
                passwordPlaceholder: "New password (or blank to remove)",
                primaryButton: "Save",
                secondaryButton: "Cancel"
            }, (result) => {
                 if (result.primary) {
                     const newPassword = result.password; // Can be blank

                     const proceed = () => {
                         if (!friendsList[friendId]) friendsList[friendId] = {};
                         friendsList[friendId].chatLock = newPassword || null; // Store null if blank
                         saveFriends();
                         alert(newPassword ? "Chat lock updated!" : "Chat lock removed!");
                     };

                     // If changing or removing, confirm old password first
                     if (currentLock) {
                         showModal({
                             title: "Confirm Current Lock",
                             text: `Enter the current password for "${friendsList[friendId].name}" to make changes.`,
                             password: "",
                             passwordPlaceholder: "Current password",
                             primaryButton: "Confirm",
                             secondaryButton: "Cancel"
                         }, (confirmResult) => {
                             if (confirmResult.primary && confirmResult.password === currentLock) {
                                 proceed(); // Old password correct, proceed
                             } else if (confirmResult.primary) {
                                 alert("Incorrect current password.");
                             }
                         });
                     } else {
                         proceed(); // Setting lock for the first time
                     }
                 }
            });
            chatListContextMenu.style.display = 'none'; // Hide menu
        };
        
        // Hide the separate remove button as logic is combined
        document.getElementById('context-remove-lock').style.display = 'none'; 
        
        document.getElementById('context-delete-chat').onclick = () => {
            if (!contextFriendId) return;
            const friendId = contextFriendId;
            const friendName = friendsList[friendId]?.name || `AI Bot (${friendId.substring(0,6)}...)`;
            if (confirm(`DELETE CHAT?\n\nAre you sure you want to permanently delete all messages and history with "${friendName}"? This cannot be undone.`)) {
                // Delete chat messages from Firebase
                const chatId = getChatId(friendId);
                if (chatId) {
                     db.ref(`messages/${chatId}`).remove()
                       .then(() => console.log("Chat messages deleted from DB for:", chatId))
                       .catch(e => console.error("Error deleting chat from DB:", e));
                }
                
                // Delete friend from local storage
                delete friendsList[friendId];
                saveFriends();
                renderChatList(); // Update UI
                 
                 // Detach listeners associated with this friend
                 if (messageListeners[chatId]) {
                     messageListeners[chatId].off();
                     delete messageListeners[chatId];
                 }
                  if (unreadListeners[friendId]) {
                      unreadListeners[friendId].off();
                      delete unreadListeners[friendId];
                  }
            }
            chatListContextMenu.style.display = 'none'; // Hide menu
        };


        // =======================================
        // 4. CHAT ROOM LOGIC (MESSAGES)
        // =======================================

        function openChatRoom(friendId, friendName) {
            currentChatId = getChatId(friendId);
            currentFriendId = friendId;
            currentFriendName = friendName;

             if (!currentChatId) {
                 console.error("Cannot open chat room: Invalid IDs");
                 alert("Error opening chat.");
                 navigateTo('chat-list-screen');
                 return;
             }

            chatRoomName.textContent = friendName;
            messageList.innerHTML = ''; 
            
            // Cleanup seen messages when entering the chat
            cleanupSeenMessages(); 

            // Detach old friend presence listener
             if (currentFriendId && presenceRef) {
                 presenceRef.child(currentFriendId).off();
             }
            
            // Listen for friend's online status
            if (presenceRef) {
                presenceRef.child(friendId).on('value', (snapshot) => {
                    if (currentFriendId === friendId) { 
                        if (snapshot.val() === true) {
                            chatRoomStatus.textContent = '● AI Online';
                            chatRoomStatus.className = 'online';
                        } else {
                            chatRoomStatus.textContent = '● AI Offline';
                            chatRoomStatus.className = '';
                        }
                    }
                });
            } else {
                 chatRoomStatus.textContent = '● Status Unknown';
                 chatRoomStatus.className = '';
            }

            // Load messages AFTER cleanup potentially runs
            loadMessages();
            
            navigateTo('chat-room-screen');
            setTimeout(() => chatWindow.scrollTop = chatWindow.scrollHeight, 100); 
        }

        // Load and listen for new messages
        function loadMessages() {
            if (!currentChatId) return;
            const messagesRef = db.ref(`messages/${currentChatId}`);
            
            if (messageListeners[currentChatId]) {
                 console.log("Detaching previous listener for chat:", currentChatId);
                messageListeners[currentChatId].off();
            }

            console.log("Attaching listener for chat:", currentChatId);
            messageListeners[currentChatId] = messagesRef.orderByChild('timestamp');
            
            // Use child_added for initial load and new messages
            messageListeners[currentChatId].on('child_added', (snapshot) => {
                const msg = snapshot.val();
                if (!msg) return; 
                msg.id = snapshot.key;
                displayMessage(msg, true); // True indicates potentially new message (scroll)
            }, (error) => {
                console.error("Error listening for messages:", error);
                 if (error.code === 'PERMISSION_DENIED') {
                     alert("Error: Cannot access chat messages. Check Firebase rules.");
                     navigateTo('chat-list-screen'); 
                 }
            });
            
            // Listen for message changes (seen, delete 'for me')
            messageListeners[currentChatId].on('child_changed', (snapshot) => {
                const msg = snapshot.val();
                 if (!msg) return; 
                msg.id = snapshot.key;
                const msgElement = document.getElementById(msg.id);
                if (msgElement) {
                    if (msg.deletedFor && msg.deletedFor[myClientId]) {
                        msgElement.remove();
                        updateChatListPreview(currentFriendId);
                    } else {
                        const meta = msgElement.querySelector('.message-meta');
                        if (meta && msg.seenBy && msg.seenBy[currentFriendId] && !meta.textContent.includes('Seen')) {
                            meta.textContent += ' ✓ Seen';
                        }
                    }
                }
            });
            
            // Listen for message deletion (deleted 'for everyone')
            messageListeners[currentChatId].on('child_removed', (snapshot) => {
                const msgElement = document.getElementById(snapshot.key);
                if (msgElement) {
                    msgElement.remove();
                     updateChatListPreview(currentFriendId);
                }
            });
        }
        
        // Listen for unread messages count and preview for chat list
        function listenForUnread(friendId) {
             // Detach previous listener first
             if (unreadListeners[friendId]) {
                  unreadListeners[friendId].off(); 
             }
             
            const chatId = getChatId(friendId);
             if (!chatId) return;
            const messagesRef = db.ref(`messages/${chatId}`);
            
             // Store the reference
             unreadListeners[friendId] = messagesRef; 
            
             unreadListeners[friendId].on('value', (snapshot) => {
                let unreadCount = 0;
                let lastMessageText = '...';
                let lastMessageType = 'normal';
                let lastMessageSender = null;
                
                snapshot.forEach((child) => {
                    const msg = child.val();
                     if (!msg) return; 

                    // Check for unread
                    if (msg.senderId !== myClientId && 
                        (!msg.seenBy || !msg.seenBy[myClientId]) &&
                        (!msg.deletedFor || !msg.deletedFor[myClientId])) 
                    {
                        unreadCount++;
                    }
                    
                    // Update last message preview (only if not deleted for me)
                    if (!msg.deletedFor || !msg.deletedFor[myClientId]) {
                        lastMessageText = msg.text;
                        lastMessageType = msg.type;
                        lastMessageSender = msg.senderId;
                    }
                });
                
                // Update Badge
                const badgeEl = document.getElementById(`unread_${friendId}`);
                if (badgeEl) {
                    if (unreadCount > 0) {
                        badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
                        badgeEl.style.display = 'block';
                    } else {
                        badgeEl.style.display = 'none';
                    }
                }

                 // Update Preview
                 const previewEl = document.getElementById(`preview_${friendId}`);
                 if (previewEl) {
                     if (lastMessageType === 'locked' && lastMessageSender === myClientId) {
                         previewEl.textContent = '🔒 Locked Message';
                     } else {
                          // Ensure text is not undefined or null
                         previewEl.textContent = lastMessageText || '...'; 
                     }
                 }
            });
        }
        
        // Helper to update preview specifically (e.g., after deletion)
        function updateChatListPreview(friendId) {
            if (!friendId) return; // Add check for friendId
             const chatId = getChatId(friendId);
             if (!chatId) return;
             const messagesRef = db.ref(`messages/${chatId}`);
             messagesRef.orderByChild('timestamp').limitToLast(1).once('value', (snapshot) => {
                 let lastMessageText = '...';
                 let lastMessageType = 'normal';
                 let lastMessageSender = null;
                 if (snapshot.exists()) {
                     snapshot.forEach((child) => {
                         const msg = child.val();
                          // Check if msg exists and has data before accessing properties
                         if (msg && (!msg.deletedFor || !msg.deletedFor[myClientId])) {
                             lastMessageText = msg.text;
                             lastMessageType = msg.type;
                             lastMessageSender = msg.senderId;
                         }
                     });
                 }
                  const previewEl = document.getElementById(`preview_${friendId}`);
                 if (previewEl) {
                     if (lastMessageType === 'locked' && lastMessageSender === myClientId) {
                         previewEl.textContent = '🔒 Locked Message';
                     } else {
                         previewEl.textContent = lastMessageText || '...';
                     }
                 }
             });
        }

                      // Listen for new chats initiated by others
        function listenForNewChats() {
            if (!myClientId) return;
            db.ref('messages').on('child_added', (snapshot) => {
                const chatId = snapshot.key;
                // Basic validation for chatId format
                if (!chatId || !chatId.includes('_') || !chatId.includes(myClientId)) return; 
                
                const friendId = chatId.replace(myClientId, '').replace('_', '');
                if (!friendsList[friendId] && friendId) {
                    db.ref(`messages/${chatId}`).orderByChild('timestamp').limitToFirst(1).once('value', (msgSnap) => {
                        if (!msgSnap.exists()) return;
                        msgSnap.forEach((childSnap) => {
                             const msgData = childSnap.val();
                             // Check if message data and senderId exist
                             if (msgData && msgData.senderId === friendId) { 
                                console.log("Detected new chat initiated by:", friendId);
                                const newFriendName = `AI Bot (${senderId.substring(0, 6)}...)`;
                                friendsList[senderId] = { name: newFriendName, chatLock: null };
                                saveFriends();
                                renderChatList(); // Update UI
                            }
                        });
                    });
                }
            });
        }

        // Display a single message in the chat window
        function displayMessage(msg, isNew) {
             if (!msg || !msg.id || !msg.senderId || !msg.timestamp || !myClientId) {
                 console.warn("Skipping invalid message or client not ready:", msg);
                 return;
             }

            if (msg.deletedFor && msg.deletedFor[myClientId]) {
                const existingElement = document.getElementById(msg.id);
                if (existingElement) existingElement.remove();
                return;
            }
            
            if (document.getElementById(msg.id)) {
                 // Update seen status if needed
                 const msgElement = document.getElementById(msg.id);
                 const meta = msgElement.querySelector('.message-meta');
                 const isUser = msg.senderId === myClientId;
                 if (isUser && msg.seenBy && msg.seenBy[currentFriendId] && meta && !meta.textContent.includes('Seen')) {
                     meta.textContent += ' ✓ Seen';
                 }
                return; // Don't re-render
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
                const lockedMsg = getLockedMessage(msg.id);
                if (lockedMsg) {
                    messageText = '🔒 Tap to unlock...'; 
                    bubble.dataset.encrypted = lockedMsg.encryptedText; 
                    isLockedForMe = true;
                } else {
                    messageText = '🔒 Locked Message (content lost)';
                }
            } else {
                messageText = msg.text || ""; 
            }
            
            bubble.textContent = messageText;

            const meta = document.createElement('div');
            meta.className = 'message-meta';
            try {
                 const timestamp = Number(msg.timestamp);
                 if (isNaN(timestamp)) throw new Error("Invalid timestamp");
                metaText = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                 metaText = "--:--"; 
            }
            
            // Append Seen status CORRECTLY
            if (isUser && msg.seenBy && msg.seenBy[currentFriendId]) {
                metaText += ' ✓ Seen';
            }
            
            meta.textContent = metaText;
            
            container.appendChild(bubble);
            container.appendChild(meta);
            
            // **MESSAGE ORDER FIX:** Append to the END of messageList
            messageList.appendChild(container); 

            // **SCROLL FIX:** Scroll to the bottom (scrollHeight)
            chatWindow.scrollTop = chatWindow.scrollHeight;
            
            // --- Event Listeners ---
            
            // 1. Click (Tap) listener (for unlocking) - FIX
            if (isLockedForMe) {
                bubble.style.cursor = 'pointer';
                // Remove previous listener if any (important for re-renders)
                // bubble.removeEventListener('click', handleUnlockClick); 
                bubble.addEventListener('click', handleUnlockClick); // Use named function
            }
            
            // 2. Context Menu (Long Press) listener (for deleting) - FIX
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Prevent default browser menu
                e.stopPropagation(); // Stop event from bubbling up
                contextMsgId = msg.id; // Store ID for delete actions
                
                // Show delete options
                contextDeleteMe.style.display = 'block';
                contextDeleteEveryone.style.display = 'block';
                
                // Only sender can delete for everyone
                if (!isUser) {
                    contextDeleteEveryone.style.display = 'none';
                }
                
                // Position and show menu
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.display = 'block';
                 
                 // Hide other context menu
                 chatListContextMenu.style.display = 'none'; 
            });

            // Mark message as seen by me
            if (!isUser && (!msg.seenBy || !msg.seenBy[myClientId])) {
                markMessageAsSeen(msg.id);
            }
        }
        
         // Named function for unlocking to allow removal if needed
         function handleUnlockClick(e) {
             const bubble = e.currentTarget; // Get the bubble that was clicked
             const encryptedText = bubble.dataset.encrypted;
             if (!encryptedText) {
                 bubble.textContent = '🔒 Locked Message (content lost)';
                 return;
             }
             // Don't re-prompt if already unlocked
             if (bubble.dataset.unlocked === "true") return; 

             showModal({
                 title: "Unlock Message",
                 text: "Enter password to decrypt this message.",
                 password: "", // Show password field
                 primaryButton: "Unlock",
                 secondaryButton: "Cancel"
             }, (result) => {
                 if (result.primary && result.password) {
                     try {
                         const decrypted = decryptText(encryptedText, result.password);
                         bubble.textContent = decrypted;
                         bubble.style.cursor = 'default';
                         bubble.dataset.unlocked = "true"; // Mark as unlocked
                     } catch (e) {
                          console.error("Decryption error:", e);
                         alert("Incorrect password.");
                     }
                 }
             });
         }
        
        // Mark a message as seen and update unread count immediately
        function markMessageAsSeen(msgId) {
             if (!currentChatId || !myClientId || !currentFriendId) return;
            const seenRef = db.ref(`messages/${currentChatId}/${msgId}/seenBy/${myClientId}`);
            seenRef.set(true)
                 .then(() => {
                      console.log("Marked as seen:", msgId);
                      // **NOTIFICATION BADGE FIX:** Update count immediately
                      updateUnreadCount(currentFriendId); 
                 })
                 .catch(e => console.error("Error marking message as seen:", e));
        }

         // Function to explicitly update unread count
         function updateUnreadCount(friendId) {
             if (!friendId) return;
             const chatId = getChatId(friendId);
             if (!chatId) return;
             const messagesRef = db.ref(`messages/${chatId}`);
             // Use once() for a single update, not a persistent listener here
             messagesRef.once('value', (snapshot) => { 
                 let unreadCount = 0;
                 snapshot.forEach((child) => {
                     const msg = child.val();
                     if (msg && msg.senderId !== myClientId &&
                         (!msg.seenBy || !msg.seenBy[myClientId]) &&
                         (!msg.deletedFor || !msg.deletedFor[myClientId])) {
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
        
        // **SEEN MESSAGE DELETION FIX (Database Deletion)**
        function cleanupSeenMessages() {
             if (!currentChatId || !myClientId || isProcessingCleanup) return;
             console.log("Running cleanup for seen messages in chat:", currentChatId);
             isProcessingCleanup = true; 

            const messagesRef = db.ref(`messages/${currentChatId}`);
            // Find messages seen by the current user
            messagesRef.orderByChild(`seenBy/${myClientId}`).equalTo(true).once('value', (snapshot) => {
                 const promises = [];
                 if (snapshot.exists()) {
                     snapshot.forEach((child) => {
                         // Delete this message from the database entirely
                         console.log("Deleting seen message from DB:", child.key);
                         promises.push(child.ref.remove()); 
                     });
                 }
                 Promise.all(promises)
                     .then(() => {
                         console.log("DB Cleanup complete for:", currentChatId);
                         isProcessingCleanup = false; 
                          // Manually clear the UI after successful DB deletion
                          messageList.innerHTML = ''; 
                          // Reload remaining messages (optional, or rely on future updates)
                          // loadMessages(); // Be careful of infinite loops if cleanup runs too often
                     })
                     .catch((e) => {
                         console.error("Error during DB cleanup:", e);
                         isProcessingCleanup = false; 
                     });
            }, (error) => {
                 console.error("Error fetching messages for cleanup:", error);
                 isProcessingCleanup = false; 
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
             if (!currentChatId || !myClientId) {
                 alert("Cannot send message. Connection not ready.");
                 return;
             }
            const text = messageInput.value.trim();
            if (text === '') return;

            if (isLocked) {
                // **LOCK MODAL FIX:** Show only password input
                showModal({
                    title: "Lock Message",
                    text: "Create a password for this message.",
                    password: "", // Show password field
                    passwordPlaceholder: "Password", // Correct placeholder
                    primaryButton: "Lock & Send",
                    secondaryButton: "Cancel"
                }, (result) => {
                    if (result.primary && result.password) {
                        sendFirebaseMessage(text, true, result.password);
                    } else if (result.primary && !result.password) {
                        alert("Password cannot be empty to lock.");
                    }
                });
            } else {
                sendFirebaseMessage(text, false, null);
            }
        }

        function sendFirebaseMessage(text, isLocked, password) {
            const messagesRef = db.ref(`messages/${currentChatId}`);
            const newMessageRef = messagesRef.push();
            const msgId = newMessageRef.key;

            let messageData = {
                senderId: myClientId,
                text: text, 
                type: isLocked ? 'locked' : 'normal',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                seenBy: null, 
                deletedFor: null 
            };

            if (isLocked) {
                try {
                    const encryptedText = encryptText(text, password);
                    saveLockedMessage(msgId, encryptedText); 
                } catch (e) {
                     console.error("Encryption failed:", e);
                     alert("Could not lock message. Sending unlocked.");
                     messageData.type = 'normal'; 
                }
            }

            newMessageRef.set(messageData)
                .then(() => {
                    messageInput.value = '';
                    messageInput.style.height = 'auto'; 
                    // Scroll to bottom after sending
                    chatWindow.scrollTop = chatWindow.scrollHeight; 
                })
                .catch((error) => {
                    console.error('Error sending message: ', error);
                    alert('Message could not be sent.');
                });
        }
        
        // --- Message Deletion ---
        contextDeleteMe.addEventListener('click', () => {
            if (!contextMsgId || !currentChatId || !myClientId) return;
            const deletedForRef = db.ref(`messages/${currentChatId}/${contextMsgId}/deletedFor/${myClientId}`);
            deletedForRef.set(true).then(() => {
                 const msgElement = document.getElementById(contextMsgId);
                 if (msgElement) msgElement.remove();
                 updateChatListPreview(currentFriendId); 
            });
            contextMenu.style.display = 'none';
        });
        
        contextDeleteEveryone.addEventListener('click', () => {
            if (!contextMsgId || !currentChatId) return;
            db.ref(`messages/${currentChatId}/${contextMsgId}`).remove().then(() => {
                 updateChatListPreview(currentFriendId); 
            });
            contextMenu.style.display = 'none';
        });
        
        // Hide context menu on click outside - FIX
        document.addEventListener('click', (e) => {
            // Check if the click target is NOT the context menu or a child of it
            if (contextMenu && !contextMenu.contains(e.target)) {
                 contextMenu.style.display = 'none';
            }
             if (chatListContextMenu && !chatListContextMenu.contains(e.target)) {
                 chatListContextMenu.style.display = 'none';
             }
        });


        // =======================================
        // 5. MODAL (POP-UP) HELPER - FIX FOR LOCK
        // =======================================
        
        let modalCallback = null;
        
        function showModal(options, callback) {
            modalTitle.textContent = options.title || "Confirmation";
            modalText.textContent = options.text || "";
            
            // Text Input
            if (options.inputText !== undefined) {
                 modalInputText.value = options.inputText;
                 modalInputText.placeholder = options.placeholder || "";
                 modalInputText.style.display = 'block';
                 modalInputText.readOnly = options.readOnly || false;
            } else {
                 modalInputText.style.display = 'none';
            }
            
            // Password Input - Show only if explicitly requested
            if (options.password !== undefined) { 
                 modalInputPassword.value = ""; 
                 modalInputPassword.placeholder = options.passwordPlaceholder || "Password";
                 modalInputPassword.style.display = 'block';
            } else {
                 modalInputPassword.style.display = 'none';
            }

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
                    inputText: modalInputText.style.display !== 'none' ? modalInputText.value : undefined,
                    password: modalInputPassword.style.display !== 'none' ? modalInputPassword.value : undefined
                });
            }
            modalInputText.value = "";
            modalInputPassword.value = "";
        });
        
        modalButtonSecondary.addEventListener('click', () => {
            modal.style.display = 'none';
            if (modalCallback) {
                modalCallback({ primary: false });
            }
             modalInputText.value = "";
             modalInputPassword.value = "";
        });


        // =======================================
        // 6. CRYPTO (LOCK/UNLOCK) HELPERS
        // =======================================
        
        function encryptText(text, password) {
             if (!text || !password) throw new Error("Text and password required for encryption");
            return CryptoJS.AES.encrypt(text, password).toString();
        }
        
        function decryptText(encryptedText, password) {
             if (!encryptedText || !password) throw new Error("Encrypted text and password required for decryption");
            const bytes = CryptoJS.AES.decrypt(encryptedText, password);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            if (!originalText) { 
                throw new Error("Decryption failed - likely wrong password");
            }
            return originalText;
        }
        
        function saveLockedMessage(msgId, encryptedText) {
            let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
            lockedMessages[msgId] = { encryptedText };
             const keys = Object.keys(lockedMessages);
             if (keys.length > 50) {
                 delete lockedMessages[keys[0]]; 
             }
            localStorage.setItem('myLockedMessages', JSON.stringify(lockedMessages));
        }
        
        function getLockedMessage(msgId) {
            let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
            return lockedMessages[msgId];
        }
        
        
        // =======================================
        // 7. WebRTC (CALLING) LOGIC - (No changes needed for current bugs)
        // =======================================
        
        const pcConfig = { /* ... Stays the same ... */ 
             'iceServers': [
                { 'urls': 'stun:stun.l.google.com:19302' },
                { 'urls': 'stun:stun1.l.google.com:19302' },
            ]
        };
        
        // --- All WebRTC functions (startCall, acceptCall, declineCall, etc.) stay the same ---
        // --- We will fix audio/video bugs in the next step ---
         async function startCall(type) {
             if (!currentFriendId || !myClientId) {
                 alert("Cannot start call. Connection not ready.");
                 return;
             }
             if (currentCallId) {
                 alert("You are already in a call or calling.");
                 return;
             }
             console.log(`Starting ${type} call to ${currentFriendId}`);
             currentCallType = type;
             currentCallFriendId = currentFriendId; 
            
             const callPushRef = db.ref(`calls/${currentFriendId}`).push();
             currentCallId = callPushRef.key;
             console.log("Generated Call ID:", currentCallId);

            // 1. Get local media 
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
                 if(currentCallId) {
                     db.ref(`calls/${currentFriendId}/${currentCallId}`).remove();
                     currentCallId = null;
                 }
                return;
            }
            
            // 2. Create RTCPeerConnection
            const pc = createPeerConnection(currentFriendId, currentCallId, type);
             if (!pc) { 
                 hangUp(false);
                 return;
             }
            rtpcConnections[currentCallId] = pc;
            
            // 3. Add local tracks to PC
            localStream.getTracks().forEach(track => {
                 try {
                     pc.addTrack(track, localStream);
                 } catch (e) {
                      console.error("Error adding track:", e);
                 }
            });
            
            // 4. Create Offer
            try {
                 const offer = await pc.createOffer();
                 await pc.setLocalDescription(offer);
                 
                 // 5. Send Offer to friend via Firebase
                 const callData = {
                     from: myClientId,
                     to: currentFriendId,
                     type: type,
                     offer: { type: offer.type, sdp: offer.sdp }
                 };
                 await callPushRef.set(callData); 

                 // 6. Listen for Answer/Decline/Hangup from friend on THEIR call node
                 const friendCallRef = db.ref(`calls/${myClientId}/${currentCallId}`); 
                 friendCallRef.on('value', async (snapshot) => {
                      // Check if PC still exists for this call ID
                     const currentPC = rtpcConnections[currentCallId];
                     if (!currentPC) return; // Ignore updates if call ended locally

                     const data = snapshot.val();
                     if (!data) return; 

                     // Check for answer
                     if (data.answer && !currentPC.currentRemoteDescription) {
                         console.log("Got answer");
                         const answer = new RTCSessionDescription(data.answer);
                          try {
                              await currentPC.setRemoteDescription(answer);
                              startCallTimer();
                          } catch (e) {
                              console.error("Error setting remote description (answer):", e);
                              hangUp(true); // Hangup if setting answer fails
                          }
                     }
                     // Check if friend declined
                     if (data.declined) {
                         console.log("Call declined by friend");
                         alert("Call declined.");
                         hangUp(false); 
                         snapshot.ref.remove(); 
                     }
                     // Check if friend hung up
                     if (data.hungup) {
                         console.log("Call hung up by friend");
                         hangUp(false); 
                         snapshot.ref.remove(); 
                     }
                 });

                 // 7. Listen for ICE candidates from friend
                 const friendIceCandidateRef = db.ref(`iceCandidates/${myClientId}/${currentCallId}`);
                 friendIceCandidateRef.on('child_added', (snapshot) => {
                     const currentPC = rtpcConnections[currentCallId];
                     if (snapshot.exists() && currentPC && currentPC.signalingState !== 'closed') {
                         console.log("Received remote ICE candidate");
                         currentPC.addIceCandidate(new RTCIceCandidate(snapshot.val()))
                           .catch(e => console.error("Error adding remote ICE candidate:", e));
                         snapshot.ref.remove(); 
                     }
                 });

            } catch (e) {
                console.error("Error creating/sending offer:", e);
                alert("Could not initiate call.");
                hangUp(false); 
            }
        }
         function showIncomingCallAlert(type, friendName, friendId, callId) {
            if (currentCallId) {
                console.log("Already in a call, declining incoming call:", callId);
                db.ref(`calls/${myClientId}/${callId}`).update({ declined: true });
                setTimeout(() => db.ref(`calls/${myClientId}/${callId}`).remove(), 5000); 
                return;
            }
            
            console.log(`Incoming ${type} call ${callId} from ${friendId}`);
            currentCallId = callId;
            currentCallType = type;
            currentCallFriendId = friendId; 
            
            incomingCallTitle.textContent = `Incoming ${type} call...`;
            incomingCallFrom.textContent = `from ${friendName}`;
            incomingCallAlert.style.display = 'block';
            
            acceptCallBtn.onclick = acceptCall; 
            declineCallBtn.onclick = declineCall; 
        }
         async function acceptCall() {
            if (!currentCallId || !currentCallFriendId || !currentCallType) return;
            console.log(`Accepting ${currentCallType} call ${currentCallId} from ${currentCallFriendId}`);
            incomingCallAlert.style.display = 'none';
            
            const callRef = db.ref(`calls/${myClientId}/${currentCallId}`);
            
            // 1. Get local media
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: currentCallType === 'video',
                    audio: true
                });
                const friendName = friendsList[currentCallFriendId]?.name || `AI Bot (${currentCallFriendId.substring(0,6)}...)`;
                showCallingScreen(currentCallType, `Connecting with ${friendName}...`); 
                attachMediaStream(document.getElementById('local-video'), localStream);
            } catch (e) {
                console.error("Error getting user media:", e);
                alert("Could not start call. Check camera/mic permissions.");
                declineCall(); 
                return;
            }
            
            // 2. Create PC
            const pc = createPeerConnection(currentCallFriendId, currentCallId, currentCallType);
             if (!pc) { 
                 hangUp(false);
                 return;
             }
            rtpcConnections[currentCallId] = pc;
            
            // 3. Add local tracks
            localStream.getTracks().forEach(track => {
                 try {
                    pc.addTrack(track, localStream);
                 } catch (e) {
                     console.error("Error adding track:", e);
                 }
            });
            
            // 4. Set Remote Description (the offer)
            try {
                const callData = (await callRef.once('value')).val();
                 if (!callData || !callData.offer) throw new Error("Offer not found in call data");
                const offer = new RTCSessionDescription(callData.offer);
                await pc.setRemoteDescription(offer);
                
                // 5. Create Answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                // 6. Send Answer to caller via Firebase (Update *their* call node)
                const callerCallRef = db.ref(`calls/${currentCallFriendId}/${currentCallId}`);
                await callerCallRef.update({
                    answer: { type: answer.type, sdp: answer.sdp }
                });
                startCallTimer();
                
                // 7. Listen for ICE candidates from caller (on MY node for candidates sent TO me)
                const callerIceCandidateRef = db.ref(`iceCandidates/${myClientId}/${currentCallId}`);
                 callerIceCandidateRef.on('child_added', (snapshot) => {
                     const currentPC = rtpcConnections[currentCallId]; // Check against current call
                     if (snapshot.exists() && currentPC && currentPC.signalingState !== 'closed') {
                          console.log("Received remote ICE candidate (caller on accept)");
                         currentPC.addIceCandidate(new RTCIceCandidate(snapshot.val()))
                            .catch(e => console.error("Error adding remote ICE candidate:", e));
                         snapshot.ref.remove();
                     }
                 });

                  // 8. Listen for hangup from caller (on MY node)
                 callRef.on('value', (snapshot) => {
                     const data = snapshot.val();
                     if (data && data.hungup) {
                         console.log("Call hung up by caller (receiver side)");
                         hangUp(false); 
                         snapshot.ref.remove(); 
                     }
                 });

            } catch(e) {
                 console.error("Error accepting call / setting description / sending answer:", e);
                 alert("Could not connect the call.");
                 hangUp(false); 
            }
        }
         function declineCall() {
            console.log("Declining call", currentCallId);
            incomingCallAlert.style.display = 'none';
            if (currentCallId && currentCallFriendId) {
                const callerCallRef = db.ref(`calls/${currentCallFriendId}/${currentCallId}`);
                callerCallRef.update({ declined: true });
                 // Clean up my node immediately
                 db.ref(`calls/${myClientId}/${currentCallId}`).remove();
                 db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove();
            }
            currentCallId = null;
            currentCallFriendId = null;
            currentCallType = null;
        }
         function createPeerConnection(friendId, callId, type) {
            try {
                 const pc = new RTCPeerConnection(pcConfig);
                 console.log("RTCPeerConnection created for call:", callId);
                
                 pc.onicecandidate = (event) => {
                     if (event.candidate && friendId && callId) { // Add checks
                          console.log("Generated local ICE candidate for", friendId);
                         db.ref(`iceCandidates/${friendId}/${callId}`).push(event.candidate.toJSON());
                     }
                 };
                
                 pc.ontrack = (event) => {
                     console.log("Remote track received:", event.track.kind);
                     const remoteVideoElement = document.getElementById('remote-video');
                     if (!remoteStream) {
                         remoteStream = new MediaStream();
                     }
                     
                     // Check if track is already added
                     if (!remoteStream.getTracks().includes(event.track)) {
                         remoteStream.addTrack(event.track);
                         console.log("Track added to remote stream");
                     } else {
                         console.log("Track already exists in remote stream");
                     }
                    
                     // Attach the stream to the video element
                     attachMediaStream(remoteVideoElement, remoteStream); 
                    
                     // Update UI based on type
                     if (type === 'voice' && remoteVideoElement) {
                         remoteVideoElement.style.display = 'none';
                     } else if (remoteVideoElement) {
                         remoteVideoElement.style.display = 'block';
                     }
                    
                     const friendName = friendsList[friendId]?.name || `AI Bot (${friendId.substring(0,6)}...)`;
                     if(callingStatus) callingStatus.textContent = `On call with ${friendName}`;
                 };
                
                pc.onconnectionstatechange = (event) => {
                    console.log("PC Connection State:", pc.connectionState);
                    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                         console.warn("PC connection state is problematic, hanging up.");
                        hangUp(true); 
                    } else if (pc.connectionState === 'connected') {
                         console.log("Call connected via PeerConnection!");
                    }
                };

                 pc.onsignalingstatechange = () => {
                     console.log("Signaling State:", pc.signalingState);
                 };

                 pc.oniceconnectionstatechange = () => {
                     console.log("ICE Connection State:", pc.iceConnectionState);
                      if (pc.iceConnectionState === 'failed') {
                          console.error("ICE connection failed. Attempting ICE restart if configured, otherwise hanging up.");
                          // Implement ICE restart logic here if desired
                          hangUp(true); 
                      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                           console.warn("ICE connection disconnected/closed.");
                           // Hang up might be too aggressive here, maybe wait?
                           // hangUp(true); 
                      }
                 };
                
                return pc;

            } catch (e) {
                 console.error("Failed to create PeerConnection:", e);
                 alert("Could not create call connection. Browser might not be supported.");
                 return null;
            }
        }
         function showCallingScreen(type, status) {
            const remoteVideo = document.getElementById('remote-video');
            const localVideo = document.getElementById('local-video');
            
            if (type === 'voice') {
                if(remoteVideo) remoteVideo.style.display = 'none';
                if(localVideo) localVideo.style.display = 'none';
            } else {
                 if(remoteVideo) remoteVideo.style.display = 'block';
                 if(localVideo) localVideo.style.display = 'block';
            }
            
            if(callingStatus) callingStatus.textContent = status;
            if(callTimer) callTimer.textContent = '00:00';
            if(hangupButton) hangupButton.onclick = () => hangUp(true); 
            
            if(callingScreen) callingScreen.style.display = 'flex';
        }
         function hangUp(sendSignal = true) {
            console.log("HangUp called. CurrentCallId:", currentCallId, "Send Signal:", sendSignal);
            
             // Prevent multiple hangup calls
             if (!currentCallId && !localStream && !remoteStream) {
                 console.log("Hangup already in progress or completed.");
                 return;
             }

            // 1. Close PeerConnection
            if (currentCallId && rtpcConnections[currentCallId]) {
                 try {
                     rtpcConnections[currentCallId].close();
                     console.log("PC closed for call:", currentCallId);
                 } catch (e) {
                      console.error("Error closing PC:", e);
                 }
                delete rtpcConnections[currentCallId];
            }
            
            // 2. Stop local media streams
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
                 console.log("Local stream stopped");
            }
            if (remoteStream) {
                // Ensure remote video element srcObject is cleared
                 const remoteVideoElement = document.getElementById('remote-video');
                 if(remoteVideoElement) remoteVideoElement.srcObject = null; 
                remoteStream.getTracks().forEach(track => track.stop());
                remoteStream = null;
                 console.log("Remote stream stopped");
            }
            
            // 3. Send hangup signal to friend 
            if (sendSignal && currentCallId && currentCallFriendId) {
                console.log("Sending hangup signal to:", currentCallFriendId);
                const friendCallRef = db.ref(`calls/${currentCallFriendId}/${currentCallId}`);
                friendCallRef.update({ hungup: true })
                  .then(() => setTimeout(() => friendCallRef.remove(), 5000)) 
                  .catch(e => console.error("Error sending hangup signal:", e));
            }
            
            // 4. Clean up Firebase (delete my call and candidates)
            if (currentCallId && myClientId) {
                console.log("Cleaning up Firebase for call:", currentCallId);
                db.ref(`calls/${myClientId}/${currentCallId}`).remove();
                db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove();
                 if (currentCallFriendId) {
                     db.ref(`iceCandidates/${currentCallFriendId}/${currentCallId}`).remove();
                 }
            }

            // 5. Hide calling screen
            if(callingScreen) callingScreen.style.display = 'none';
            if(incomingCallAlert) incomingCallAlert.style.display = 'none'; 
             console.log("UI hidden");

            // 6. Stop timer
            if (callTimerInterval) {
                clearInterval(callTimerInterval);
                callTimerInterval = null;
                 console.log("Timer stopped");
            }
            
             // 7. Reset state VERY IMPORTANT
            currentCallId = null;
            currentCallType = null;
            currentCallFriendId = null; 
             console.log("Call state reset");

        }
         function attachMediaStream(element, stream) {
             if (element && stream) {
                 try {
                     if (element.srcObject !== stream) {
                         element.srcObject = stream;
                         console.log("Attached stream to element:", element.id);
                     }
                 } catch (e) {
                      console.error("Error attaching stream:", e);
                 }
            } else {
                 // Don't warn if stream is intentionally null (e.g., after hangup)
                 if (stream) {
                      console.warn("Cannot attach stream: Element missing", element);
                 }
            }
        }
         function startCallTimer() {
            if (callTimerInterval) clearInterval(callTimerInterval); 
            let seconds = 0;
            if(callTimer) callTimer.textContent = '00:00';
            callTimerInterval = setInterval(() => {
                seconds++;
                const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                const secs = (seconds % 60).toString().padStart(2, '0');
                 if(callTimer) callTimer.textContent = `${mins}:${secs}`;
            }, 1000);
        }

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        alert("CRITICAL ERROR: Could not connect to services. App will not work.");
        document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>App Initialization Failed</h1><p>Could not initialize Firebase. Please check your Firebase configuration and network connection.</p><p>Error: ${error.message}</p></div>`;
    }
}); // End of DOMContentLoaded
