// =================================================================================
// JAVASCRIPT LOGIC START
// =================================================================================

// Wait for the DOM to be ready
document.addEventListener('DOMContentLoaded', () => {

    // ⚠️ YUVI, APNA FIREBASE CONFIG YAHAN PASTE KARO ⚠️
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
        let friendsList = {};
        let messageListeners = {};
        let unreadListeners = {};
        let presenceRef;
        let myPresenceRef;
        let rtpcConnections = {};
        let localStream;
        let remoteStream;
        let callTimerInterval;
        let currentCallId = null;
        let currentCallType = null;
        let currentCallFriendId = null;
        let isProcessingCleanup = false;
        let currentScreen = 'password-screen';

        // --- DOM Elements ---
        // (Elements remain the same as previous version)
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
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalText = document.getElementById('modal-text');
        const modalInputText = document.getElementById('modal-input-text');
        const modalInputPassword = document.getElementById('modal-input-password');
        const modalButtonPrimary = document.getElementById('modal-button-primary');
        const modalButtonSecondary = document.getElementById('modal-button-secondary');
        const contextMenu = document.getElementById('context-menu');
        const contextDeleteMe = document.getElementById('context-delete-me');
        const contextDeleteEveryone = document.getElementById('context-delete-everyone');
        const chatListContextMenu = document.getElementById('chat-list-context-menu');
        let contextMsgId = null;
        let contextFriendId = null;

        // --- NEW CONTEXT MENU ITEMS FOR LOCKED MESSAGES ---
        // We will add these dynamically to contextMenu when needed
        const contextRelockMsg = document.createElement('button');
        contextRelockMsg.id = 'context-relock';
        contextRelockMsg.textContent = 'Re-lock Message';

        const contextRemoveLock = document.createElement('button');
        contextRemoveLock.id = 'context-remove-lock-msg';
        contextRemoveLock.textContent = 'Remove Lock Permanently';

        const contextAddLock = document.createElement('button');
        contextAddLock.id = 'context-add-lock-msg';
        contextAddLock.textContent = 'Lock This Message';


        // =======================================
        // 1. APP INITIALIZATION & LOGIN
        // =======================================
        // (This section remains the same)
        function getClientId(uid) { /* ... */ let id = localStorage.getItem('mySecretClientId'); if (!id) { id = uid; localStorage.setItem('mySecretClientId', id); } myClientId = id; return id; }
        function loadFriends() { /* ... */ const saved = localStorage.getItem('mySecretFriends'); if (saved) { try { friendsList = JSON.parse(saved); } catch (e) { friendsList = {}; } } else { friendsList = {}; } renderChatList(); }
        function saveFriends() { /* ... */ localStorage.setItem('mySecretFriends', JSON.stringify(friendsList)); }
        function initPresence() { /* ... */ if (!myClientId) return; presenceRef = db.ref('presence'); myPresenceRef = presenceRef.child(myClientId); db.ref('.info/connected').on('value', (s) => { if (s.val() === true) { myPresenceRef.set(true); myPresenceRef.onDisconnect().remove(); } }); }
        function initCallListener() { /* ... */ if (!myClientId) return; const ref = db.ref(`calls/${myClientId}`); ref.off(); ref.on('child_added', (s) => { const d = s.val(); if (d && d.offer && !d.declined && !d.hungup && !d.answer) { const n = friendsList[d.from]?.name || `AI Bot (...)`; showIncomingCallAlert(d.type, n, d.from, s.key); } if (d && (d.hungup || d.declined)) { s.ref.remove(); } }); }
        function startApp(uid) { /* ... */ myClientId = getClientId(uid); console.log("App started:", myClientId); loadFriends(); initPresence(); initCallListener(); listenForNewChats(); navigateTo('chat-list-screen'); setupBackButtonListener(); }
        passwordForm.addEventListener('submit', (e) => { /* ... */ e.preventDefault(); passwordError.style.visibility = 'hidden'; if (passwordInput.value === APP_PASSWORD) { if (auth.currentUser) { startApp(auth.currentUser.uid); } else { auth.signInAnonymously().then((cred) => { if (cred && cred.user) { startApp(cred.user.uid); } else { throw new Error("No user."); } }).catch((err) => { console.error("Auth Err:", err); passwordError.textContent = "Connect failed."; passwordError.style.visibility = 'visible'; }); } } else { passwordError.textContent = "Incorrect password."; passwordError.style.visibility = 'visible'; } });


        // =======================================
        // 2. NAVIGATION & BACK BUTTON
        // =======================================
        // (This section remains the same)
        function navigateTo(screenId) { /* ... */ console.log("Nav to:", screenId); if(passwordScreen&&chatListScreen&&chatRoomScreen){ if(screenId!==currentScreen){history.pushState({screen:screenId},'',`#${screenId}`);} currentScreen=screenId; passwordScreen.style.transform=(screenId==='password-screen')?'translateX(0%)':'translateX(-100%)'; chatListScreen.style.transform=(screenId==='chat-list-screen')?'translateX(0%)':(screenId==='password-screen'?'translateX(100%)':'translateX(-100%)'); chatRoomScreen.style.transform=(screenId==='chat-room-screen')?'translateX(0%)':'translateX(100%)'; if(screenId!=='chat-room-screen'){ if(currentChatId&&messageListeners[currentChatId]){messageListeners[currentChatId].off(); delete messageListeners[currentChatId];} if(currentFriendId&&presenceRef){presenceRef.child(currentFriendId).off();} currentChatId=null; currentFriendId=null; currentFriendName=null;} }else{console.error("Nav error");} }
        backToListBtn.addEventListener('click', () => { navigateTo('chat-list-screen'); });
        function setupBackButtonListener() { /* ... */ window.addEventListener('popstate', (e) => { if (e.state && e.state.screen) { const target = e.state.screen; console.log("Popstate:", target); currentScreen = target; passwordScreen.style.transform = (target==='password-screen')?'translateX(0%)':'translateX(-100%)'; chatListScreen.style.transform = (target==='chat-list-screen')?'translateX(0%)':(target==='password-screen'?'translateX(100%)':'translateX(-100%)'); chatRoomScreen.style.transform = (target==='chat-room-screen')?'translateX(0%)':'translateX(100%)'; if (target !== 'chat-room-screen') { if(currentChatId&&messageListeners[currentChatId]){messageListeners[currentChatId].off(); delete messageListeners[currentChatId];} if(currentFriendId&&presenceRef){presenceRef.child(currentFriendId).off();} currentChatId=null; currentFriendId=null; currentFriendName=null;} } else { if (currentScreen !== 'chat-list-screen' && myClientId) { /* Maybe navigate to list? */ } } }); history.replaceState({ screen: currentScreen }, '', `#${currentScreen}`); }
        messageInput.addEventListener('input', () => { /* ... auto resize ... */ messageInput.style.height = 'auto'; const sh = messageInput.scrollHeight; const mh = 100; messageInput.style.height = Math.min(sh, mh) + 'px'; });
        messageInput.addEventListener('focus', () => { /* ... scroll into view ... */ setTimeout(() => { messageForm.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 300); });


        // =======================================
        // 3. CHAT LIST LOGIC (FRIENDS)
        // =======================================
        // (This section remains the same)
        myIdButton.addEventListener('click', () => { /* ... show ID modal ... */ if(!myClientId) return; showModal({ title: "My ID", text: "Share this secret ID.", inputText: myClientId, readOnly: true, primaryButton: "Copy", secondaryButton: "Close" }, (r)=>{ if(r.primary){ try { navigator.clipboard.writeText(myClientId).then(()=>{alert("Copied!");}).catch(()=>{modalInputText.select(); document.execCommand('copy'); alert("Copied!");}); } catch(e){ modalInputText.select(); document.execCommand('copy'); alert("Copied!"); } } }); });
        addFriendButton.addEventListener('click', () => { /* ... add friend modal ... */ if(!myClientId) return; showModal({ title: "Add AI Bot", text: "Enter friend's ID.", inputText: "", placeholder: "Friend's ID", primaryButton: "Add", secondaryButton: "Cancel" }, (r)=>{ if(r.primary&&r.inputText){ const fid=r.inputText.trim(); if(!fid){alert("Empty ID."); return;} if(fid===myClientId){alert("Cannot add self."); return;} if(friendsList[fid]){handleChatOpen(fid, friendsList[fid].name, friendsList[fid].chatLock); return;} const name=`AI Bot (${fid.substring(0,6)}...)`; friendsList[fid]={name:name, chatLock:null}; saveFriends(); renderChatList(); openChatRoom(fid, name);} }); });
        function getChatId(friendId) { /* ... */ if (!myClientId || !friendId) return null; const ids = [myClientId, friendId].sort(); return ids.join('_'); }
        function renderChatList() { /* ... render list items ... */ if(!chatList) return; chatList.innerHTML=''; const fids=Object.keys(friendsList); if(fids.length===0){chatList.innerHTML=`<p style="text-align: center; color: var(--system-text); padding: 20px;">Tap '+' to add.</p>`; return;} fids.forEach(fid=>{ const f=friendsList[fid]; if(!f||!f.name) return; const item=document.createElement('div'); item.className='chat-list-item'; item.dataset.friendId=fid; const av=f.name.charAt(0).toUpperCase(); const name=f.name; item.innerHTML=`<div class="chat-list-avatar"></div> <div class="chat-list-details"><div class="chat-list-name"></div><div class="chat-list-preview" id="preview_${fid}">...</div></div><div class="chat-list-meta"><span class="unread-badge" id="unread_${fid}" style="display: none;">0</span></div>`; item.querySelector('.chat-list-avatar').textContent=av; item.querySelector('.chat-list-name').textContent=name; item.addEventListener('click',()=>{handleChatOpen(fid,f.name,f.chatLock);}); item.addEventListener('contextmenu',(e)=>{e.preventDefault(); e.stopPropagation(); showChatListContextMenu(e,fid);}); chatList.appendChild(item); listenForUnread(fid);}); }
        function handleChatOpen(friendId, friendName, chatLock) { /* ... check lock, open room ... */ if(chatLock){showModal({title:`Unlock: ${friendName}`, text:"Enter password.", password:"", primaryButton:"Unlock", secondaryButton:"Cancel"}, (r)=>{ if(r.primary&&r.password===chatLock){openChatRoom(friendId, friendName);} else if(r.primary){alert("Incorrect.");}});} else{openChatRoom(friendId, friendName);} }
        function showChatListContextMenu(e, friendId) { /* ... position and show menu ... */ contextFriendId=friendId; const mw=chatListContextMenu.offsetWidth; const mh=chatListContextMenu.offsetHeight; const sw=window.innerWidth; const sh=window.innerHeight; let l=e.clientX; let t=e.clientY; if(l+mw>sw) l=sw-mw-10; if(t+mh>sh) t=sh-mh-10; chatListContextMenu.style.top=`${t}px`; chatListContextMenu.style.left=`${l}px`; chatListContextMenu.style.display='block'; contextMenu.style.display='none'; }
        // Chat List Context Menu Actions (remain same)
        document.getElementById('context-rename').onclick = () => { /* ... rename logic ... */ if(!contextFriendId) return; const fid=contextFriendId; const old=friendsList[fid]?.name||`AI (...)`; showModal({title:"Rename", text:`New name for "${old}".`, inputText:old, primaryButton:"Save", secondaryButton:"Cancel"}, (r)=>{ if(r.primary&&r.inputText){ if(!friendsList[fid]) friendsList[fid]={}; friendsList[fid].name=r.inputText; saveFriends(); renderChatList();} }); chatListContextMenu.style.display='none'; };
        document.getElementById('context-lock').onclick = () => { /* ... lock/unlock logic ... */ if(!contextFriendId) return; const fid=contextFriendId; const lock=friendsList[fid]?.chatLock; showModal({title:lock?"Change/Remove Lock":"Set Lock", text:lock?"New password, or blank to remove.":"Set password.", password:"", passwordPlaceholder:"New password (or blank)", primaryButton:"Save", secondaryButton:"Cancel"}, (r)=>{ if(r.primary){ const newPass=r.password; const proceed=()=>{if(!friendsList[fid]) friendsList[fid]={}; friendsList[fid].chatLock=newPass||null; saveFriends(); alert(newPass?"Lock updated!":"Lock removed!");}; if(lock){showModal({title:"Confirm Current", text:`Enter current password for "${friendsList[fid].name}".`, password:"", passwordPlaceholder:"Current password", primaryButton:"Confirm", secondaryButton:"Cancel"}, (cr)=>{ if(cr.primary&&cr.password===lock){proceed();} else if(cr.primary){alert("Incorrect.");}}); } else{proceed();} } }); chatListContextMenu.style.display='none'; };
        document.getElementById('context-remove-lock').style.display = 'none';
        document.getElementById('context-delete-chat').onclick = () => { /* ... delete logic ... */ if(!contextFriendId) return; const fid=contextFriendId; const name=friendsList[fid]?.name||`AI (...)`; if(confirm(`DELETE CHAT with "${name}"?\n\nThis deletes messages permanently.`)){ const cid=getChatId(fid); if(cid){db.ref(`messages/${cid}`).remove();} delete friendsList[fid]; saveFriends(); renderChatList(); if(messageListeners[cid]){messageListeners[cid].off(); delete messageListeners[cid];} if(unreadListeners[fid]){unreadListeners[fid].off(); delete unreadListeners[fid];}} chatListContextMenu.style.display='none'; };


        // =======================================
        // 4. CHAT ROOM LOGIC (MESSAGES)
        // =======================================
        // (openChatRoom, loadMessages, listenForUnread, updatePreview, listenForNewChats - remain same)
        function openChatRoom(friendId, friendName) { /* ... */ currentChatId=getChatId(friendId); currentFriendId=friendId; currentFriendName=friendName; if(!currentChatId){alert("Error opening chat."); navigateTo('chat-list-screen'); return;} chatRoomName.textContent=friendName; messageList.innerHTML=''; cleanupSeenMessages(); if(presenceRef){presenceRef.child(friendId).on('value', (s)=>{ if(currentFriendId===friendId){if(s.val()===true){chatRoomStatus.textContent='● AI Online'; chatRoomStatus.className='online';} else{chatRoomStatus.textContent='● AI Offline'; chatRoomStatus.className='offline';}}});} else{chatRoomStatus.textContent='● Status Unknown'; chatRoomStatus.className='offline';} loadMessages(); navigateTo('chat-room-screen'); setTimeout(()=>{chatWindow.scrollTop=chatWindow.scrollHeight;}, 150); }
        function loadMessages() { /* ... */ if (!currentChatId) return; const ref = db.ref(`messages/${currentChatId}`); if (messageListeners[currentChatId]) { messageListeners[currentChatId].off(); } messageListeners[currentChatId] = ref.orderByChild('timestamp'); messageListeners[currentChatId].on('child_added', (s)=>{const m=s.val(); if(!m) return; m.id=s.key; displayMessage(m, true);}, (err)=>{console.error("Msg listener err:", err); if(err.code==='PERMISSION_DENIED'){alert("Access denied."); navigateTo('chat-list-screen');}}); messageListeners[currentChatId].on('child_changed', (s)=>{const m=s.val(); if(!m) return; m.id=s.key; const el=document.getElementById(m.id); if(el){if(m.deletedFor&&m.deletedFor[myClientId]){el.remove(); updateChatListPreview(currentFriendId);}else{const meta=el.querySelector('.message-meta'); if(meta&&m.seenBy&&m.seenBy[currentFriendId]&&!meta.textContent.includes('Seen')){meta.textContent+=' ✓ Seen';}}}}); messageListeners[currentChatId].on('child_removed', (s)=>{const el=document.getElementById(s.key); if(el){el.remove(); updateChatListPreview(currentFriendId);}}); ref.once('value', ()=>{ setTimeout(()=>chatWindow.scrollTop=chatWindow.scrollHeight, 50); }); }
        function listenForUnread(friendId) { /* ... */ if(unreadListeners[friendId]){unreadListeners[friendId].off();} const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); unreadListeners[friendId]=ref; unreadListeners[friendId].on('value', (s)=>{ let count=0; let lastTxt='...'; let lastType='normal'; let lastSender=null; s.forEach((c)=>{const m=c.val(); if(!m) return; if(m.senderId!==myClientId&&(!m.seenBy||!m.seenBy[myClientId])&&(!m.deletedFor||!m.deletedFor[myClientId])){count++;} if(!m.deletedFor||!m.deletedFor[myClientId]){lastTxt=m.text; lastType=m.type; lastSender=m.senderId;}}); const badge=document.getElementById(`unread_${friendId}`); if(badge){if(count>0){badge.textContent=count>9?'9+':count; badge.style.display='block';} else{badge.style.display='none';}} const preview=document.getElementById(`preview_${friendId}`); if(preview){if(lastType==='locked'&&lastSender===myClientId){preview.textContent='🔒 Locked';} else{preview.textContent=lastTxt||'...';}}}); }
        function updateChatListPreview(friendId) { /* ... */ if(!friendId) return; const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); ref.orderByChild('timestamp').limitToLast(1).once('value', (s)=>{ let lastTxt='...'; let lastType='normal'; let lastSender=null; if(s.exists()){s.forEach((c)=>{const m=c.val(); if(m&&(!m.deletedFor||!m.deletedFor[myClientId])){lastTxt=m.text; lastType=m.type; lastSender=m.senderId;}});} const preview=document.getElementById(`preview_${friendId}`); if(preview){if(lastType==='locked'&&lastSender===myClientId){preview.textContent='🔒 Locked';} else{preview.textContent=lastTxt||'...';}}}); }
        function listenForNewChats() { /* ... */ if(!myClientId) return; db.ref('messages').on('child_added', (s)=>{const cid=s.key; if(!cid||!cid.includes('_')||!cid.includes(myClientId)) return; const fid=cid.replace(myClientId,'').replace('_',''); if(!friendsList[fid]&&fid){db.ref(`messages/${cid}`).orderByChild('timestamp').limitToFirst(1).once('value', (ms)=>{if(!ms.exists()) return; ms.forEach((cs)=>{const md=cs.val(); if(md&&md.senderId===fid){console.log("New chat from:", fid); const name=`AI Bot (${fid.substring(0,6)}...)`; friendsList[fid]={name:name, chatLock:null}; saveFriends(); renderChatList();}}); });}}); }

        // Display message - **CONTEXT MENU & ORDER FIXES**
        function displayMessage(msg, isNew) {
            if (!msg || !msg.id || !msg.senderId || !msg.timestamp || !myClientId) return;
            if (msg.deletedFor && msg.deletedFor[myClientId]) { const el = document.getElementById(msg.id); if (el) el.remove(); return; }
            if (document.getElementById(msg.id)) { /* Update seen */ return; }

            const isUser = msg.senderId === myClientId;
            const container = document.createElement('div');
            container.id = msg.id;
            container.className = isUser ? 'message-container user-prompt' : 'message-container bot-response';

            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.dataset.msgId = msg.id; // Store msg.id here

            let messageText = '';
            let isLockedForMe = false;
            let isUnlocked = false; // Track if currently displayed as unlocked

            if (isUser && msg.type === 'locked') {
                const lockedMsg = getLockedMessage(msg.id);
                if (lockedMsg) {
                    messageText = '🔒 Tap to unlock...';
                    bubble.dataset.encrypted = lockedMsg.encryptedText;
                    isLockedForMe = true;
                } else { messageText = '🔒 Content lost'; }
            } else { messageText = msg.text || ""; }
            bubble.textContent = messageText;

            const meta = document.createElement('div'); /* ... create meta ... */
            meta.className = 'message-meta';
            try { const ts = Number(msg.timestamp); metaText = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { metaText = "--:--"; }
            if (isUser && msg.seenBy && msg.seenBy[currentFriendId]) { metaText += ' ✓ Seen'; }
            meta.textContent = metaText;

            container.appendChild(bubble);
            container.appendChild(meta);

            // ORDER FIX: Append at end
            messageList.appendChild(container);
            // SCROLL FIX: Scroll down
            chatWindow.scrollTop = chatWindow.scrollHeight;

            // --- Event Listeners ---
            if (isLockedForMe) {
                bubble.style.cursor = 'pointer';
                bubble.addEventListener('click', handleUnlockClick); // Use named function
            }

            // CONTEXT MENU FIX
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Stop browser default
                e.stopPropagation(); // Stop propagating to document click
                contextMsgId = bubble.dataset.msgId; // Get msgId from bubble dataset
                
                // Determine which options to show
                const isCurrentlyLocked = isLockedForMe && !bubble.dataset.unlocked;
                const isCurrentlyUnlocked = bubble.dataset.unlocked === "true";
                const wasOriginallyLocked = isLockedForMe; // Based on initial check

                // Clear previous dynamic options
                contextMenu.querySelectorAll('.dynamic-lock-option').forEach(btn => btn.remove());

                // Add dynamic lock/unlock options
                if (isCurrentlyUnlocked) {
                    contextMenu.insertBefore(contextRelockMsg, contextDeleteMe);
                    contextRelockMsg.classList.add('dynamic-lock-option');
                }
                if (wasOriginallyLocked) { // Show remove lock only if it was originally locked
                    contextMenu.insertBefore(contextRemoveLock, contextDeleteMe);
                    contextRemoveLock.classList.add('dynamic-lock-option');
                }
                if (!wasOriginallyLocked && isUser && msg.type !== 'locked') { // Show add lock only if user's and not originally locked
                    contextMenu.insertBefore(contextAddLock, contextDeleteMe);
                    contextAddLock.classList.add('dynamic-lock-option');
                }

                // Show standard delete options
                contextDeleteMe.style.display = 'block';
                contextDeleteEveryone.style.display = isUser ? 'block' : 'none';

                // Position and show menu
                const menuWidth = contextMenu.offsetWidth; const menuHeight = contextMenu.offsetHeight;
                const sw = window.innerWidth; const sh = window.innerHeight;
                let l = e.clientX; let t = e.clientY;
                if (l + menuWidth > sw) l = sw - menuWidth - 10;
                if (t + menuHeight > sh) t = sh - menuHeight - 10;
                contextMenu.style.top = `${t}px`; contextMenu.style.left = `${l}px`;
                contextMenu.style.display = 'block';
                chatListContextMenu.style.display = 'none';
            });

            // Mark message as seen
            if (!isUser && (!msg.seenBy || !msg.seenBy[myClientId])) {
                markMessageAsSeen(msg.id);
            }
        }

        // Unlock handler
        function handleUnlockClick(e) { /* ... same logic ... */
            const bubble = e.currentTarget; const enc = bubble.dataset.encrypted; if (!enc) { bubble.textContent = '🔒 Lost'; return; } if (bubble.dataset.unlocked === "true") return;
            showModal({ title: "Unlock", text: "Enter password.", password: "", primaryButton: "Unlock", secondaryButton: "Cancel"
            }, (r) => { if (r.primary && r.password) { try { const dec = decryptText(enc, r.password); bubble.textContent = dec; bubble.style.cursor = 'default'; bubble.dataset.unlocked = "true"; } catch (e) { alert("Incorrect."); } } });
        }

        // Mark seen - NOTIFICATION BADGE FIX
        function markMessageAsSeen(msgId) { /* ... same logic ... */
            if (!currentChatId || !myClientId || !currentFriendId) return; const ref = db.ref(`messages/${currentChatId}/${msgId}/seenBy/${myClientId}`); ref.set(true).then(()=>{console.log("Seen:", msgId); updateUnreadCount(currentFriendId);}).catch(e=>console.error("Mark seen err:", e));
        }
        function updateUnreadCount(friendId) { /* ... same logic ... */
            if(!friendId) return; const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); ref.once('value', (s)=>{let count=0; s.forEach((c)=>{const m=c.val(); if(m&&m.senderId!==myClientId&&(!m.seenBy||!m.seenBy[myClientId])&&(!m.deletedFor||!m.deletedFor[myClientId])){count++;}}); const el=document.getElementById(`unread_${friendId}`); if(el){if(count>0){el.textContent=count>9?'9+':count; el.style.display='block';} else{el.style.display='none';}}});
        }

        // **SEEN DELETE LOGIC FIX (DATABASE DELETION ON RE-ENTRY)**
        function cleanupSeenMessages() {
             if (!currentChatId || !myClientId || isProcessingCleanup) return;
             console.log("Cleanup: Checking DB for seen messages in:", currentChatId);
             isProcessingCleanup = true;
             const ref = db.ref(`messages/${currentChatId}`);
             // Find messages seen by me, but NOT marked as deleted for me yet.
             ref.orderByChild(`seenBy/${myClientId}`).equalTo(true).once('value', (snapshot) => {
                 const promises = [];
                 if (snapshot.exists()) {
                     snapshot.forEach((child) => {
                         const msgData = child.val();
                         // Double check it's not already marked for local deletion
                         if (!msgData.deletedFor || !msgData.deletedFor[myClientId]) {
                             console.log("Cleanup: Deleting seen msg from DB:", child.key);
                             promises.push(child.ref.remove()); // Delete from DB
                         }
                     });
                 }
                  // Even if no messages found, reset flag
                 if (promises.length === 0) {
                      isProcessingCleanup = false;
                      console.log("Cleanup: No seen messages found to delete from DB.");
                      return;
                 }
                 Promise.all(promises)
                     .then(() => { console.log("DB Cleanup done:", currentChatId); isProcessingCleanup = false; })
                     .catch((e) => { console.error("DB Cleanup error:", e); isProcessingCleanup = false; });
             }, (error) => { console.error("DB Cleanup fetch error:", error); isProcessingCleanup = false; });
                        }
                           // Message Sending (Lock modal fix)
        messageForm.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(false); });
        lockButton.addEventListener('click', () => { sendMessage(true); });
        function sendMessage(isLocked) { /* ... same ... */ if(!currentChatId||!myClientId){alert("Not ready."); return;} const txt=messageInput.value.trim(); if(txt==='') return; if(isLocked){showModal({title:"Lock Message", text:"Create password.", password:"", passwordPlaceholder:"Password", primaryButton:"Lock & Send", secondaryButton:"Cancel"},(r)=>{ if(r.primary&&r.password){sendFirebaseMessage(txt,true,r.password);} else if(r.primary){alert("Password needed.");}}); } else{sendFirebaseMessage(txt,false,null);} }
        function sendFirebaseMessage(text, isLocked, password) { /* ... same ... */ const ref=db.ref(`messages/${currentChatId}`); const newRef=ref.push(); const mid=newRef.key; let data={senderId:myClientId, text:text, type:isLocked?'locked':'normal', timestamp:firebase.database.ServerValue.TIMESTAMP, seenBy:null, deletedFor:null}; if(isLocked){try{const enc=encryptText(text,password); saveLockedMessage(mid,enc);}catch(e){alert("Lock failed."); data.type='normal';}} newRef.set(data).then(()=>{messageInput.value=''; messageInput.style.height='auto'; chatWindow.scrollTop=chatWindow.scrollHeight;}).catch((err)=>{alert('Send failed.');}); }

        // --- Message Deletion ---
        contextDeleteMe.addEventListener('click', () => { /* ... same logic ... */ if(!contextMsgId||!currentChatId||!myClientId) return; db.ref(`messages/${currentChatId}/${contextMsgId}/deletedFor/${myClientId}`).set(true).then(()=>{const el=document.getElementById(contextMsgId); if(el) el.remove(); updateChatListPreview(currentFriendId);}); contextMenu.style.display='none'; });
        contextDeleteEveryone.addEventListener('click', () => { /* ... same logic ... */ if(!contextMsgId||!currentChatId) return; db.ref(`messages/${currentChatId}/${contextMsgId}`).remove().then(()=>{updateChatListPreview(currentFriendId);}); contextMenu.style.display='none'; });

        // --- NEW Lock/Unlock actions from context menu ---
        contextRelockMsg.onclick = () => {
             if (!contextMsgId) return;
             const bubble = document.getElementById(contextMsgId)?.querySelector('.message-bubble');
             if (!bubble || !bubble.dataset.unlocked) return; // Can only relock unlocked messages

             const lockedData = getLockedMessage(contextMsgId);
             if (lockedData) {
                 bubble.textContent = '🔒 Tap to unlock...';
                 bubble.style.cursor = 'pointer';
                 delete bubble.dataset.unlocked; // Remove unlocked flag
                 // No need to re-save to local storage, it's already there
                 alert("Message re-locked locally.");
             } else {
                 alert("Cannot re-lock. Original encrypted data not found.");
             }
             contextMenu.style.display = 'none';
        };

        contextRemoveLock.onclick = () => {
             if (!contextMsgId) return;
             const bubble = document.getElementById(contextMsgId)?.querySelector('.message-bubble');
             const lockedData = getLockedMessage(contextMsgId);

             if (!bubble || !lockedData) {
                 alert("This message is not locked or data is missing.");
                 contextMenu.style.display = 'none';
                 return;
             }

             showModal({
                 title: "Remove Lock",
                 text: "Enter the password to permanently unlock this message locally.",
                 password: "",
                 primaryButton: "Remove Lock",
                 secondaryButton: "Cancel"
             }, (result) => {
                 if (result.primary && result.password) {
                     try {
                         const decrypted = decryptText(lockedData.encryptedText, result.password);
                         // Remove from local storage
                         let lockedMessages = JSON.parse(localStorage.getItem('myLockedMessages')) || {};
                         delete lockedMessages[contextMsgId];
                         localStorage.setItem('myLockedMessages', JSON.stringify(lockedMessages));

                         // Update bubble
                         bubble.textContent = decrypted;
                         bubble.style.cursor = 'default';
                         delete bubble.dataset.encrypted;
                         bubble.dataset.unlocked = "true"; // Mark as permanently unlocked
                         alert("Lock removed permanently.");

                     } catch (e) {
                         alert("Incorrect password.");
                     }
                 }
             });
             contextMenu.style.display = 'none';
        };

        contextAddLock.onclick = () => {
            if (!contextMsgId) return;
            const bubble = document.getElementById(contextMsgId)?.querySelector('.message-bubble');
             if (!bubble || bubble.dataset.encrypted) {
                 alert("Cannot lock this message."); // Already locked or invalid
                 contextMenu.style.display = 'none';
                 return;
             }
             const currentText = bubble.textContent;

             showModal({
                 title: "Add Lock",
                 text: "Create a password to lock this message locally.",
                 password: "",
                 primaryButton: "Lock",
                 secondaryButton: "Cancel"
             }, (result) => {
                 if (result.primary && result.password) {
                     try {
                         const encryptedText = encryptText(currentText, result.password);
                         saveLockedMessage(contextMsgId, encryptedText);

                         // Update bubble
                         bubble.textContent = '🔒 Tap to unlock...';
                         bubble.dataset.encrypted = encryptedText;
                         bubble.style.cursor = 'pointer';
                         delete bubble.dataset.unlocked; // Remove unlocked flag if any
                         alert("Message locked locally.");

                     } catch (e) {
                         console.error("Error adding lock:", e);
                         alert("Could not lock message.");
                     }
                 }
             });
             contextMenu.style.display = 'none';
        };

        // Hide context menus on outside click
        document.addEventListener('click', (e) => {
            if (contextMenu && !contextMenu.contains(e.target) && !e.target.closest('.message-bubble')) {
                contextMenu.style.display = 'none';
            }
            if (chatListContextMenu && !chatListContextMenu.contains(e.target) && !e.target.closest('.chat-list-item')) {
                chatListContextMenu.style.display = 'none';
            }
        });

        // Modal Helper (remains same)
        let modalCallback = null;
        function showModal(options, callback) { /* ... */ modalTitle.textContent=options.title||""; modalText.textContent=options.text||""; if(options.inputText!==undefined){modalInputText.value=options.inputText; modalInputText.placeholder=options.placeholder||""; modalInputText.style.display='block'; modalInputText.readOnly=options.readOnly||false;} else{modalInputText.style.display='none';} if(options.password!==undefined){modalInputPassword.value=""; modalInputPassword.placeholder=options.passwordPlaceholder||"Password"; modalInputPassword.style.display='block';} else{modalInputPassword.style.display='none';} modalButtonPrimary.textContent=options.primaryButton||"OK"; modalButtonSecondary.textContent=options.secondaryButton||"Cancel"; modalCallback=callback; modal.style.display='flex'; }
        modalButtonPrimary.addEventListener('click', () => { /* ... */ modal.style.display='none'; if(modalCallback){modalCallback({primary:true, inputText:modalInputText.style.display!=='none'?modalInputText.value:undefined, password:modalInputPassword.style.display!=='none'?modalInputPassword.value:undefined});} modalInputText.value=""; modalInputPassword.value=""; });
        modalButtonSecondary.addEventListener('click', () => { /* ... */ modal.style.display='none'; if(modalCallback){modalCallback({primary:false});} modalInputText.value=""; modalInputPassword.value=""; });

        // Crypto Helpers (remain same)
        function encryptText(text, password) { /* ... */ return CryptoJS.AES.encrypt(text, password).toString(); }
        function decryptText(encryptedText, password) { /* ... */ const b = CryptoJS.AES.decrypt(encryptedText, password); const t = b.toString(CryptoJS.enc.Utf8); if (!t) throw Error(); return t; }
        function saveLockedMessage(msgId, encryptedText) { /* ... */ let l = JSON.parse(localStorage.getItem('myLockedMessages')) || {}; l[msgId] = { encryptedText }; const k = Object.keys(l); if (k.length > 50) delete l[k[0]]; localStorage.setItem('myLockedMessages', JSON.stringify(l)); }
        function getLockedMessage(msgId) { /* ... */ let l = JSON.parse(localStorage.getItem('myLockedMessages')) || {}; return l[msgId]; }
    // =======================================
        // 7. WebRTC (CALLING) LOGIC - REMAINS SAME FOR NOW
        // =======================================
        const pcConfig = { /* ... */ 'iceServers': [ { 'urls': 'stun:stun.l.google.com:19302' }, { 'urls': 'stun:stun1.l.google.com:19302' } ] };
        // --- All WebRTC functions stay the same ---
        // We will debug calling audio/video in the next step
        voiceCallBtn.addEventListener('click', () => { console.log("Voice call click"); startCall('voice'); });
        videoCallBtn.addEventListener('click', () => { console.log("Video call click"); startCall('video'); });
         async function startCall(type) { /* ... same ... */ if (!currentFriendId || !myClientId || currentCallId) return; console.log(`Starting ${type} call to ${currentFriendId}`); currentCallType=type; currentCallFriendId=currentFriendId; const pushRef=db.ref(`calls/${currentFriendId}`).push(); currentCallId=pushRef.key; try { localStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }); showCallingScreen(type, `Calling ${currentFriendName}...`); attachMediaStream(document.getElementById('local-video'), localStream); } catch (e) { console.error("Media err:", e); alert("Perm check?"); if(currentCallId){db.ref(`calls/${currentFriendId}/${currentCallId}`).remove(); currentCallId=null;} return; } const pc=createPeerConnection(currentFriendId, currentCallId, type); if(!pc){hangUp(false); return;} rtpcConnections[currentCallId]=pc; localStream.getTracks().forEach(t=>{try{pc.addTrack(t, localStream);}catch(e){}}); try { const offer=await pc.createOffer(); await pc.setLocalDescription(offer); const data={from:myClientId, to:currentFriendId, type:type, offer:{type:offer.type, sdp:offer.sdp}}; await pushRef.set(data); const friendRef=db.ref(`calls/${myClientId}/${currentCallId}`); friendRef.on('value', async (s)=>{const pcc=rtpcConnections[currentCallId]; if(!pcc) return; const d=s.val(); if(!d) return; if(d.answer&&!pcc.currentRemoteDescription){console.log("Got answer"); const a=new RTCSessionDescription(d.answer); try{await pcc.setRemoteDescription(a); startCallTimer();}catch(e){hangUp(true);}} if(d.declined){alert("Declined."); hangUp(false); s.ref.remove();} if(d.hungup){hangUp(false); s.ref.remove();}}); const iceRef=db.ref(`iceCandidates/${myClientId}/${currentCallId}`); iceRef.on('child_added', (s)=>{const pcc=rtpcConnections[currentCallId]; if(s.exists()&&pcc&&pcc.signalingState!=='closed'){pcc.addIceCandidate(new RTCIceCandidate(s.val())).catch(e=>{}); s.ref.remove();}}); } catch (e) { alert("Call init failed."); hangUp(false); } }
         function showIncomingCallAlert(type, name, friendId, callId) { /* ... same ... */ if (currentCallId){db.ref(`calls/${myClientId}/${callId}`).update({declined: true}); setTimeout(()=>db.ref(`calls/${myClientId}/${callId}`).remove(), 5000); return;} currentCallId=callId; currentCallType=type; currentCallFriendId=friendId; incomingCallTitle.textContent=`Incoming ${type} call...`; incomingCallFrom.textContent=`from ${name}`; incomingCallAlert.style.display='block'; acceptCallBtn.onclick=acceptCall; declineCallBtn.onclick=declineCall; }
         async function acceptCall() { /* ... same ... */ if(!currentCallId||!currentCallFriendId||!currentCallType) return; console.log(`Accepting ${currentCallType} call ${currentCallId}`); incomingCallAlert.style.display='none'; const ref=db.ref(`calls/${myClientId}/${currentCallId}`); try{localStream=await navigator.mediaDevices.getUserMedia({video:currentCallType==='video', audio:true}); const name=friendsList[currentCallFriendId]?.name||`AI(...)`; showCallingScreen(currentCallType, `Connecting with ${name}...`); attachMediaStream(document.getElementById('local-video'), localStream);}catch(e){alert("Perm check?"); declineCall(); return;} const pc=createPeerConnection(currentCallFriendId, currentCallId, currentCallType); if(!pc){hangUp(false); return;} rtpcConnections[currentCallId]=pc; localStream.getTracks().forEach(t=>{try{pc.addTrack(t,localStream);}catch(e){}}); try{const data=(await ref.once('value')).val(); if(!data||!data.offer) throw Error("No offer"); const offer=new RTCSessionDescription(data.offer); await pc.setRemoteDescription(offer); const answer=await pc.createAnswer(); await pc.setLocalDescription(answer); const callerRef=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); await callerRef.update({answer:{type:answer.type, sdp:answer.sdp}}); startCallTimer(); const callerIceRef=db.ref(`iceCandidates/${myClientId}/${currentCallId}`); callerIceRef.on('child_added', (s)=>{const pcc=rtpcConnections[currentCallId]; if(s.exists()&&pcc&&pcc.signalingState!=='closed'){pcc.addIceCandidate(new RTCIceCandidate(s.val())).catch(e=>{}); s.ref.remove();}}); ref.on('value', (s)=>{const d=s.val(); if(d&&d.hungup){hangUp(false); s.ref.remove();}}); } catch(e){alert("Connect failed."); hangUp(false);} }
         function declineCall() { /* ... same ... */ console.log("Declining:", currentCallId); incomingCallAlert.style.display='none'; if(currentCallId&&currentCallFriendId){const ref=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); ref.update({declined:true}); db.ref(`calls/${myClientId}/${currentCallId}`).remove(); db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove();} currentCallId=null; currentCallFriendId=null; currentCallType=null; }
         function createPeerConnection(friendId, callId, type) { /* ... same ... */ try{const pc=new RTCPeerConnection(pcConfig); pc.onicecandidate=(e)=>{if(e.candidate&&friendId&&callId){db.ref(`iceCandidates/${friendId}/${callId}`).push(e.candidate.toJSON());}}; pc.ontrack=(e)=>{console.log("Track:",e.track.kind); const rv=document.getElementById('remote-video'); if(!remoteStream){remoteStream=new MediaStream();} if(!remoteStream.getTracks().includes(e.track)){remoteStream.addTrack(e.track);} attachMediaStream(rv, remoteStream); if(type==='voice'&&rv){rv.style.display='none';} else if(rv){rv.style.display='block';} const name=friendsList[friendId]?.name||`AI(...)`; if(callingStatus) callingStatus.textContent=`On call with ${name}`;}; pc.onconnectionstatechange=()=>{if(pc.connectionState==='disconnected'||pc.connectionState==='failed'||pc.connectionState==='closed'){hangUp(true);}}; pc.onsignalingstatechange=()=>{}; pc.oniceconnectionstatechange=()=>{if(pc.iceConnectionState==='failed'){hangUp(true);}}; return pc;} catch(e){alert("Call failed (Browser?)."); return null;} }
         function showCallingScreen(type, status) { /* ... same ... */ const rv=document.getElementById('remote-video'); const lv=document.getElementById('local-video'); if(type==='voice'){if(rv) rv.style.display='none'; if(lv) lv.style.display='none';} else{if(rv) rv.style.display='block'; if(lv) lv.style.display='block';} if(callingStatus) callingStatus.textContent=status; if(callTimer) callTimer.textContent='00:00'; if(hangupButton) hangupButton.onclick=()=>hangUp(true); if(callingScreen) callingScreen.style.display='flex'; }
         function hangUp(sendSignal=true) { /* ... same ... */ if(!currentCallId&&!localStream&&!remoteStream) return; if(currentCallId&&rtpcConnections[currentCallId]){try{rtpcConnections[currentCallId].close();}catch(e){} delete rtpcConnections[currentCallId];} if(localStream){localStream.getTracks().forEach(t=>t.stop()); localStream=null;} if(remoteStream){const rv=document.getElementById('remote-video'); if(rv) rv.srcObject=null; remoteStream.getTracks().forEach(t=>t.stop()); remoteStream=null;} if(sendSignal&&currentCallId&&currentCallFriendId){const ref=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); ref.update({hungup:true}).then(()=>setTimeout(()=>ref.remove(),5000));} if(currentCallId&&myClientId){db.ref(`calls/${myClientId}/${currentCallId}`).remove(); db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove(); if(currentCallFriendId){db.ref(`iceCandidates/${currentCallFriendId}/${currentCallId}`).remove();}} if(callingScreen) callingScreen.style.display='none'; if(incomingCallAlert) incomingCallAlert.style.display='none'; if(callTimerInterval){clearInterval(callTimerInterval); callTimerInterval=null;} currentCallId=null; currentCallType=null; currentCallFriendId=null; console.log("Call state reset"); }
         function attachMediaStream(element, stream) { /* ... same ... */ if(element&&stream){try{if(element.srcObject!==stream){element.srcObject=stream;}}catch(e){}} else{if(stream){console.warn("Attach stream: No element");}} }
         function startCallTimer() { /* ... same ... */ if(callTimerInterval) clearInterval(callTimerInterval); let s=0; if(callTimer) callTimer.textContent='00:00'; callTimerInterval=setInterval(()=>{s++; const m=Math.floor(s/60).toString().padStart(2,'0'); const ss=(s%60).toString().padStart(2,'0'); if(callTimer) callTimer.textContent=`${m}:${ss}`;}, 1000); }


    } catch (error) {
        console.error("Firebase Init Error:", error);
        alert("CRITICAL ERROR: App failed.");
        document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>App Failed</h1><p>Init Error: ${error.message}</p></div>`;
    }
}); // End of DOMContentLoaded
