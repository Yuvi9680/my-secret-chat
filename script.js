// =================================================================================
// JAVASCRIPT LOGIC START
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded.");

    // --- DOM Elements ---
    // (Ensure all elements are captured correctly)
    const passwordScreen = document.getElementById('password-screen'); /*...*/
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
    const chatListContextMenu = document.getElementById('chat-list-context-menu');
    const toggleMuteBtn = document.getElementById('toggle-mute-btn');
    const toggleSpeakerBtn = document.getElementById('toggle-speaker-btn');
    const toggleVideoBtn = document.getElementById('toggle-video-btn');
    const swapVideoBtn = document.getElementById('swap-video-btn');


    // Check essential elements
    if (!passwordScreen || !chatListScreen || !chatRoomScreen || !callingScreen || !modal || !contextMenu || !chatListContextMenu) {
        console.error("Critical UI elements missing!");
        document.body.innerHTML = `<h1>App Init Failed</h1><p>UI Error.</p>`;
        return;
    }
    console.log("UI elements checked.");


    // ⚠️ Firebase Config ⚠️
    const firebaseConfig = { /* ... your config ... */
      apiKey: "AIzaSyDVSPhPWVwciDfRF-aQbc6zTHBcub1jYmU",
      authDomain: "my-secret-chat-9779b.firebaseapp.com",
      databaseURL: "https://my-secret-chat-9779b-default-rtdb.firebaseio.com",
      projectId: "my-secret-chat-9779b",
      storageBucket: "my-secret-chat-9779b.firebasestorage.app",
      messagingSenderId: "801250293319",
      appId: "1:801250293319:web:811f00e9e6bde564046362",
      measurementId: "G-EL9ZHXP45E"
    };

    const APP_PASSWORD = "Yuvraj9680";

    try {
        const app = firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.database();
        console.log("Firebase initialized.");

        // --- Global Variables ---
        let myClientId; let currentChatId = null; let currentFriendId = null;
        let currentFriendName = null; let friendsList = {}; let messageListeners = {};
        let unreadListeners = {}; let presenceRef; let myPresenceRef;
        let rtpcConnections = {}; let localStream; let remoteStream;
        let callTimerInterval; let currentCallId = null; let currentCallType = null;
        let currentCallFriendId = null; let isProcessingCleanup = false;
        let currentScreen = 'password-screen';
        let longPressTimer = null; const LONG_PRESS_DURATION = 500;
        let touchStartX, touchStartY, isMoving, touchTargetElement;
        let contextMsgId = null; let contextFriendId = null;

        // Dynamic context menu items
        const contextRelockMsg = document.createElement('button'); contextRelockMsg.id = 'context-relock'; contextRelockMsg.textContent = 'Re-lock Message';
        const contextRemoveLock = document.createElement('button'); contextRemoveLock.id = 'context-remove-lock-msg'; contextRemoveLock.textContent = 'Remove Lock';
        const contextAddLock = document.createElement('button'); contextAddLock.id = 'context-add-lock-msg'; contextAddLock.textContent = 'Lock This Message';
        const contextDeleteMe = document.createElement('button'); contextDeleteMe.id = 'context-delete-me'; contextDeleteMe.textContent = 'Delete for Me';
        const contextDeleteEveryone = document.createElement('button'); contextDeleteEveryone.id = 'context-delete-everyone'; contextDeleteEveryone.textContent = 'Delete for Everyone'; contextDeleteEveryone.className = 'delete-danger';


        // =======================================
        // 1. APP INITIALIZATION & LOGIN
        // =======================================
        // (No changes needed)
        function getClientId(uid) { myClientId=localStorage.getItem('mySecretClientId')||uid; localStorage.setItem('mySecretClientId', myClientId); return myClientId; }
        function loadFriends() { const s=localStorage.getItem('mySecretFriends'); try{friendsList=s?JSON.parse(s):{};}catch(e){friendsList={};} renderChatList(); }
        function saveFriends() { localStorage.setItem('mySecretFriends', JSON.stringify(friendsList)); }
        function initPresence() { if(!myClientId) return; presenceRef=db.ref('presence'); myPresenceRef=presenceRef.child(myClientId); db.ref('.info/connected').on('value', (s)=>{if(s.val()===true){myPresenceRef.set(true); myPresenceRef.onDisconnect().remove();}}); }
        function initCallListener() { if(!myClientId) return; const ref=db.ref(`calls/${myClientId}`); ref.off(); ref.on('child_added', (s)=>{const d=s.val(); if(d&&d.offer&&!d.declined&&!d.hungup&&!d.answer){const n=friendsList[d.from]?.name||`AI(...)`; showIncomingCallAlert(d.type,n,d.from,s.key);} if(d&&(d.hungup||d.declined)){s.ref.remove();}}); }
        function startApp(uid) { myClientId=getClientId(uid); console.log("Started:", myClientId); loadFriends(); initPresence(); initCallListener(); listenForNewChats(); navigateTo('chat-list-screen'); setupBackButtonListener(); }
        passwordForm.addEventListener('submit', (e)=>{ e.preventDefault(); passwordError.style.visibility='hidden'; if(passwordInput.value===APP_PASSWORD){console.log("Pwd ok."); if(auth.currentUser){startApp(auth.currentUser.uid);}else{auth.signInAnonymously().then((cred)=>{if(cred&&cred.user){startApp(cred.user.uid);}else{throw new Error("No user.");}}).catch((err)=>{passwordError.textContent="Connect failed."; passwordError.style.visibility='visible';});}}else{passwordError.textContent="Incorrect."; passwordError.style.visibility='visible';}});

        // =======================================
        // 2. NAVIGATION & BACK BUTTON - **FINAL CHECK**
        // =======================================
        function navigateTo(screenId, isBack = false) {
             console.log("Nav to:", screenId, "IsBack:", isBack, "Current:", currentScreen);
             if (passwordScreen && chatListScreen && chatRoomScreen) {
                 if (!isBack && screenId !== currentScreen) {
                    // Only push if it's a new screen in the hierarchy
                    if ((currentScreen === 'password-screen' && screenId === 'chat-list-screen') ||
                        (currentScreen === 'chat-list-screen' && screenId === 'chat-room-screen')) {
                        history.pushState({ screen: screenId }, '', `#${screenId}`);
                        console.log("Pushed state:", screenId);
                    } else {
                         // Replace state if jumping between screens not in order, or going back to password
                         history.replaceState({ screen: screenId }, '', `#${screenId}`);
                         console.log("Replaced state:", screenId);
                    }
                 }
                 currentScreen = screenId; // Update current screen *after* potential state change
                 passwordScreen.style.transform=(screenId==='password-screen')?'translateX(0%)':'translateX(-100%)';
                 chatListScreen.style.transform=(screenId==='chat-list-screen')?'translateX(0%)':(screenId==='password-screen'?'translateX(100%)':'translateX(-100%)');
                 chatRoomScreen.style.transform=(screenId==='chat-room-screen')?'translateX(0%)':'translateX(100%)';

                 if(screenId !== 'chat-room-screen'){ if(currentChatId && messageListeners[currentChatId]){ messageListeners[currentChatId].off(); delete messageListeners[currentChatId]; } if(currentFriendId && presenceRef){ presenceRef.child(currentFriendId).off(); } currentChatId=null; currentFriendId=null; currentFriendName=null; }
             }
        }
        backToListBtn.addEventListener('click', () => { history.back(); });
        function setupBackButtonListener() {
             window.addEventListener('popstate', (e) => {
                  const targetScreen = e.state?.screen;
                  console.log("Popstate:", targetScreen, "Current:", currentScreen);
                 // If history state exists and it's different from current, navigate back
                 if (targetScreen && targetScreen !== currentScreen) {
                     navigateTo(targetScreen, true);
                 }
                 // If history state is null/undefined (e.g., user went back beyond app start)
                 // and user is logged in (not on password screen), go to chat list.
                 // This prevents exiting the app unintentionally unless on the password screen.
                 else if (!targetScreen && currentScreen !== 'password-screen' && myClientId) {
                     console.log("Popstate to null state, going to chat list");
                     navigateTo('chat-list-screen', true); // Treat as back navigation
                 }
                 // Otherwise, allow default browser behavior (exit/previous page)
             });
             // Ensure initial state is correct
             history.replaceState({ screen: currentScreen }, '', `#${currentScreen}`);
        }
        messageInput.addEventListener('input', () => { messageInput.style.height='auto'; const sh=messageInput.scrollHeight; const mh=100; messageInput.style.height=Math.min(sh,mh)+'px'; });
        messageInput.addEventListener('focus', () => { setTimeout(()=>{ if(messageForm) messageForm.scrollIntoView({behavior:'smooth', block:'end'}); }, 300); });

        // =======================================
        // 3. CHAT LIST LOGIC (FRIENDS) - CHECKED
        // =======================================
        // (No changes needed in this section)
         myIdButton.addEventListener('click', () => { /* ... show ID ... */ if(!myClientId) return; showModal({ title: "My ID", text: "Share.", inputText: myClientId, readOnly: true, primaryButton: "Copy", secondaryButton: "Close" }, (r)=>{ if(r.primary){ try { navigator.clipboard.writeText(myClientId).then(()=>{alert("Copied!");}).catch(()=>{modalInputText.select(); document.execCommand('copy'); alert("Copied!");}); } catch (e){ modalInputText.select(); document.execCommand('copy'); alert("Copied!"); } } }); });
         addFriendButton.addEventListener('click', () => { /* ... add friend ... */ if(!myClientId) return; showModal({ title: "Add Bot", text: "Enter ID.", inputText: "", placeholder: "Friend's ID", primaryButton: "Add", secondaryButton: "Cancel" }, (r)=>{ if(r.primary&&r.inputText){ const fid=r.inputText.trim(); if(!fid){return;} if(fid===myClientId){return;} if(friendsList[fid]){handleChatOpen(fid, friendsList[fid].name, friendsList[fid].chatLock); return;} const name=`AI Bot (...)`; friendsList[fid]={name:name, chatLock:null}; saveFriends(); renderChatList(); openChatRoom(fid, name);} }); });
         function getChatId(friendId) { if (!myClientId || !friendId) return null; const ids = [myClientId, friendId].sort(); return ids.join('_'); }
         function renderChatList() { if(!chatList) return; chatList.innerHTML=''; const fids=Object.keys(friendsList); if(fids.length===0){chatList.innerHTML=`<p style="text-align: center; color: var(--system-text); padding: 20px;">Tap '+' to add.</p>`; return;} fids.forEach(fid=>{ const f=friendsList[fid]; if(!f||!f.name) return; const item=document.createElement('div'); item.className='chat-list-item'; item.dataset.friendId=fid; const av=f.name.charAt(0).toUpperCase(); const name=f.name; item.innerHTML=`<div class="chat-list-avatar"></div> <div class="chat-list-details"><div class="chat-list-name"></div><div class="chat-list-preview" id="preview_${fid}">...</div></div><div class="chat-list-meta"><span class="unread-badge" id="unread_${fid}" style="display: none;">0</span></div>`; item.querySelector('.chat-list-avatar').textContent=av; item.querySelector('.chat-list-name').textContent=name; item.addEventListener('click',()=>{handleChatOpen(fid,f.name,f.chatLock);}); item.addEventListener('touchstart',(e)=>handleTouchStart(e,fid,showChatListContextMenu)); item.addEventListener('touchend',handleTouchEnd); item.addEventListener('touchmove',handleTouchMove); item.addEventListener('contextmenu',(e)=>{e.preventDefault(); e.stopPropagation(); showChatListContextMenu(e,fid);}); chatList.appendChild(item); listenForUnread(fid);}); }
         function handleChatOpen(friendId, friendName, chatLock) { if(chatLock){showModal({title:`Unlock: ${friendName}`, text:"Password?", password:"", primaryButton:"Unlock", secondaryButton:"Cancel"}, (r)=>{ if(r.primary&&r.password===chatLock){openChatRoom(friendId, friendName);} else if(r.primary){alert("Incorrect.");}});} else{openChatRoom(friendId, friendName);} }
         function showChatListContextMenu(e, friendId) { contextFriendId=fid; const x=e.clientX??e.touches?.[0]?.clientX??window.innerWidth/2; const y=e.clientY??e.touches?.[0]?.clientY??window.innerHeight/2; positionContextMenu(chatListContextMenu,x,y); chatListContextMenu.style.display='block'; contextMenu.style.display='none'; }
         document.getElementById('context-rename').onclick = () => { if(!contextFriendId) return; const fid=contextFriendId; const old=friendsList[fid]?.name||`AI (...)`; showModal({title:"Rename", text:`New name for "${old}".`, inputText:old, primaryButton:"Save", secondaryButton:"Cancel"}, (r)=>{ if(r.primary&&r.inputText){ if(!friendsList[fid]) friendsList[fid]={}; friendsList[fid].name=r.inputText; saveFriends(); renderChatList();} }); chatListContextMenu.style.display='none'; };
         document.getElementById('context-lock').onclick = () => { if(!contextFriendId) return; const fid=contextFriendId; const lock=friendsList[fid]?.chatLock; showModal({title:lock?"Change/Remove Lock":"Set Lock", text:lock?"New pwd, or blank to remove.":"Set pwd.", password:"", passwordPlaceholder:"New pwd (or blank)", primaryButton:"Save", secondaryButton:"Cancel"}, (r)=>{ if(r.primary){ const newPass=r.password; const proceed=()=>{if(!friendsList[fid]) friendsList[fid]={}; friendsList[fid].chatLock=newPass||null; saveFriends(); alert(newPass?"Lock set!":"Lock removed!");}; if(lock){showModal({title:"Confirm Current", text:`Enter current pwd for "${friendsList[fid].name}".`, password:"", passwordPlaceholder:"Current pwd", primaryButton:"Confirm", secondaryButton:"Cancel"}, (cr)=>{ if(cr.primary&&cr.password===lock){proceed();} else if(cr.primary){alert("Incorrect.");}}); } else{proceed();} } }); chatListContextMenu.style.display='none'; };
         document.getElementById('context-delete-chat').onclick = () => { if(!contextFriendId) return; const fid=contextFriendId; const name=friendsList[fid]?.name||`AI (...)`; if(confirm(`DELETE CHAT with "${name}"?\n\nDeletes messages permanently.`)){ const cid=getChatId(fid); if(cid){db.ref(`messages/${cid}`).remove();} delete friendsList[fid]; saveFriends(); renderChatList(); if(messageListeners[cid]){messageListeners[cid].off(); delete messageListeners[cid];} if(unreadListeners[fid]){unreadListeners[fid].off(); delete unreadListeners[fid];}} chatListContextMenu.style.display='none'; };

        // =======================================
        // 4. CHAT ROOM LOGIC (MESSAGES) - **SEEN DELETE LOGIC v2**
        // =======================================
        function openChatRoom(friendId, friendName) { /* ... same open logic ... */ currentChatId=getChatId(friendId); currentFriendId=friendId; currentFriendName=friendName; if(!currentChatId){alert("Error."); navigateTo('chat-list-screen'); return;} chatRoomName.textContent=friendName; messageList.innerHTML=''; cleanupSeenMessages(); if(presenceRef){const pref=presenceRef.child(friendId); pref.off(); pref.on('value',(s)=>{if(currentFriendId===friendId){if(s.val()===true){chatRoomStatus.textContent='● AI Online'; chatRoomStatus.className='online';}else{chatRoomStatus.textContent='● AI Offline'; chatRoomStatus.className='offline';}}});} else{chatRoomStatus.textContent='● Status Unknown'; chatRoomStatus.className='offline';} loadMessages(); navigateTo('chat-room-screen'); setTimeout(()=>{chatWindow.scrollTop=chatWindow.scrollHeight; markAllMessagesInChatAsSeen();}, 150); }
        function loadMessages() { /* ... same load logic ... */ if(!currentChatId) return; const ref=db.ref(`messages/${currentChatId}`); if(messageListeners[currentChatId]){messageListeners[currentChatId].off();} messageListeners[currentChatId]=ref.orderByChild('timestamp'); messageListeners[currentChatId].once('value',(s)=>{messageList.innerHTML=''; s.forEach((cs)=>{const m=cs.val(); if(!m) return; m.id=cs.key; displayMessage(m, false);}); chatWindow.scrollTop=chatWindow.scrollHeight; attachRealtimeListeners(ref);},(err)=>{}); }
        function attachRealtimeListeners(ref) { /* ... same attach logic ... */ ref.off('child_added'); ref.off('child_changed'); ref.off('child_removed'); ref.orderByChild('timestamp').on('child_added',(s)=>{if(document.getElementById(s.key)) return; const m=s.val(); if(!m) return; m.id=s.key; displayMessage(m, true);},(err)=>{}); ref.orderByChild('timestamp').on('child_changed',(s)=>{const m=s.val(); if(!m) return; m.id=s.key; const el=document.getElementById(m.id); if(el){if(m.deletedFor&&m.deletedFor[myClientId]){el.remove(); updateChatListPreview(currentFriendId);}else{const meta=el.querySelector('.message-meta'); if(meta&&m.seenBy&&m.seenBy[currentFriendId]&&!meta.textContent.includes('Seen')){meta.textContent+=' ✓ Seen';}}}}); ref.orderByChild('timestamp').on('child_removed',(s)=>{const el=document.getElementById(s.key); if(el){el.remove(); updateChatListPreview(currentFriendId);}}); }
        function listenForUnread(friendId) { /* ... same ... */ if(unreadListeners[friendId]){unreadListeners[friendId].off();} const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); unreadListeners[friendId]=ref; unreadListeners[friendId].on('value', (s)=>{ let c=0; let lastTxt='...'; let lastType='normal'; let lastSender=null; s.forEach((ch)=>{const m=ch.val(); if(!m) return; if(m.senderId!==myClientId&&(!m.seenBy||!m.seenBy[myClientId])&&(!m.deletedFor||!m.deletedFor[myClientId])){c++;} if(!m.deletedFor||!m.deletedFor[myClientId]){lastTxt=m.text; lastType=m.type; lastSender=m.senderId;}}); const badge=document.getElementById(`unread_${friendId}`); if(badge){if(c>0){badge.textContent=c>9?'9+':c; badge.style.display='block';} else{badge.style.display='none';}} const preview=document.getElementById(`preview_${friendId}`); if(preview){if(lastType==='locked'&&lastSender===myClientId){preview.textContent='🔒 Locked';} else{preview.textContent=lastTxt||'...';}}}); }
        function updateChatListPreview(friendId) { /* ... same ... */ if(!friendId) return; const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); ref.orderByChild('timestamp').limitToLast(1).once('value', (s)=>{ let lastTxt='...'; let lastType='normal'; let lastSender=null; if(s.exists()){s.forEach((c)=>{const m=c.val(); if(m&&(!m.deletedFor||!m.deletedFor[myClientId])){lastTxt=m.text; lastType=m.type; lastSender=m.senderId;}});} const preview=document.getElementById(`preview_${friendId}`); if(preview){if(lastType==='locked'&&lastSender===myClientId){preview.textContent='🔒 Locked';} else{preview.textContent=lastTxt||'...';}}}); }
        function listenForNewChats() { /* ... same ... */ if(!myClientId) return; db.ref('messages').on('child_added', (s)=>{const cid=s.key; if(!cid||!cid.includes('_')||!cid.includes(myClientId)) return; const fid=cid.replace(myClientId,'').replace('_',''); if(!friendsList[fid]&&fid){db.ref(`messages/${cid}`).orderByChild('timestamp').limitToFirst(1).once('value', (ms)=>{if(!ms.exists()) return; ms.forEach((cs)=>{const md=cs.val(); if(md&&md.senderId===fid){console.log("New chat:", fid); const name=`AI (...)`; friendsList[fid]={name:name, chatLock:null}; saveFriends(); renderChatList();}}); });}}); }

        // Display message (remains same)
        function displayMessage(msg, isNew) { if(!msg||!msg.id||!msg.senderId||!msg.timestamp||!myClientId)return; if(msg.deletedFor&&msg.deletedFor[myClientId]){const el=document.getElementById(msg.id); if(el)el.remove(); return;} if(document.getElementById(msg.id)){return;} const isUser=msg.senderId===myClientId; const cont=document.createElement('div'); cont.id=msg.id; cont.className=isUser?'message-container user-prompt':'message-container bot-response'; const bub=document.createElement('div'); bub.className='message-bubble'; bub.dataset.msgId=msg.id; let txt=''; let locked=false; if(isUser&&msg.type==='locked'){const d=getLockedMessage(msg.id); if(d){txt='🔒 Tap to unlock...'; bub.dataset.encrypted=d.encryptedText; locked=true;}else{txt='🔒 Content lost'; bub.style.opacity='0.7';}} else{txt=msg.text||"";} bub.textContent=txt; const meta=document.createElement('div'); meta.className='message-meta'; try{const ts=Number(msg.timestamp); metaTxt=new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch(e){metaTxt="--:--";} if(isUser&&msg.seenBy&&msg.seenBy[currentFriendId]){metaTxt+=' ✓ Seen';} meta.textContent=metaTxt; cont.appendChild(bub); cont.appendChild(meta); messageList.appendChild(cont); const isAtBottom=chatWindow.scrollHeight-chatWindow.clientHeight<=chatWindow.scrollTop+10; if(isNew&&(isUser||isAtBottom)){chatWindow.scrollTop=chatWindow.scrollHeight;} else if(!isNew){chatWindow.scrollTop=chatWindow.scrollHeight;} if(locked){bub.style.cursor='pointer'; bub.addEventListener('click',handleUnlockClick);} bub.addEventListener('touchstart',(e)=>handleTouchStart(e,msg.id,showMessageContextMenu)); bub.addEventListener('touchend',handleTouchEnd); bub.addEventListener('touchmove',handleTouchMove); bub.addEventListener('contextmenu',(e)=>{e.preventDefault(); e.stopPropagation(); showMessageContextMenu(e,msg.id);}); if(currentChatId===getChatId(msg.senderId)&&!isUser&&(!msg.seenBy||!msg.seenBy[myClientId])){markMessageAsSeen(msg.id);} }
        function showMessageContextMenu(e, msgId) { /* ... same build/position logic ... */ contextMsgId = msgId; const bubble = document.getElementById(msgId)?.querySelector('.message-bubble'); if (!bubble) return; const msgDataRef = db.ref(`messages/${currentChatId}/${msgId}`); msgDataRef.once('value', (s)=>{ const d=s.val(); if(!d) return; const isU=d.senderId===myClientId; contextMenu.innerHTML=''; const isCL=isU&&getLockedMessage(msgId)&&!bubble.dataset.unlocked; const isCUL=bubble.dataset.unlocked==="true"; const wasOL=isU&&d.type==='locked'; if(isCUL)contextMenu.appendChild(contextRelockMsg.cloneNode(true)); if(wasOL)contextMenu.appendChild(contextRemoveLock.cloneNode(true)); if(!wasOL&&isU)contextMenu.appendChild(contextAddLock.cloneNode(true)); contextMenu.appendChild(contextDeleteMe.cloneNode(true)); if(isU)contextMenu.appendChild(contextDeleteEveryone.cloneNode(true)); const cm=document.getElementById('context-menu'); if(cm.querySelector('#context-relock'))cm.querySelector('#context-relock').onclick=handleRelockClick; if(cm.querySelector('#context-remove-lock-msg'))cm.querySelector('#context-remove-lock-msg').onclick=handleRemoveLockClick; if(cm.querySelector('#context-add-lock-msg'))cm.querySelector('#context-add-lock-msg').onclick=handleAddLockClick; if(cm.querySelector('#context-delete-me'))cm.querySelector('#context-delete-me').onclick=handleDeleteMeClick; if(cm.querySelector('#context-delete-everyone'))cm.querySelector('#context-delete-everyone').onclick=handleDeleteEveryoneClick; const x=e.clientX??e.touches?.[0]?.clientX??window.innerWidth/2; const y=e.clientY??e.touches?.[0]?.clientY??window.innerHeight/2; positionContextMenu(contextMenu,x,y); contextMenu.style.display='block'; chatListContextMenu.style.display='none';}); }
        function handleUnlockClick(e) { /* ... same unlock logic ... */ const b=e.currentTarget; const enc=b.dataset.encrypted; if(!enc){b.textContent='🔒 Lost';return;} if(b.dataset.unlocked==="true") return; showModal({title:"Unlock", text:"Password?", password:"", primaryButton:"Unlock", secondaryButton:"Cancel"},(r)=>{if(r.primary&&r.password){try{const dec=decryptText(enc,r.password); b.textContent=dec; b.style.cursor='default'; b.dataset.unlocked="true";}catch(e){alert("Incorrect.");}}}); }
        function markMessageAsSeen(msgId) { /* ... same ... */ if(!currentChatId||!myClientId||!currentFriendId)return; db.ref(`messages/${currentChatId}/${msgId}/seenBy/${myClientId}`).once('value', (s)=>{if(!s.exists()||s.val()!==true){const ref=db.ref(`messages/${currentChatId}/${msgId}/seenBy/${myClientId}`); ref.set(true).then(()=>{updateUnreadCount(currentFriendId);});}});}
        function markAllMessagesInChatAsSeen() { /* ... same ... */ if(!currentChatId||!myClientId||!currentFriendId)return; const ref=db.ref(`messages/${currentChatId}`); ref.once('value', (s)=>{const updates={}; s.forEach((c)=>{const m=c.val(); if(m&&m.senderId!==myClientId&&(!m.seenBy||!m.seenBy[myClientId])){updates[`${c.key}/seenBy/${myClientId}`]=true;}}); if(Object.keys(updates).length>0){ref.update(updates).then(()=>{updateUnreadCount(currentFriendId);});}});}
        function updateUnreadCount(friendId) { /* ... same ... */ if(!friendId) return; const cid=getChatId(friendId); if(!cid) return; const ref=db.ref(`messages/${cid}`); ref.once('value', (s)=>{let c=0; s.forEach((ch)=>{const m=ch.val(); if(m&&m.senderId!==myClientId&&(!m.seenBy||!m.seenBy[myClientId])&&(!m.deletedFor||!m.deletedFor[myClientId])){c++;}}); const el=document.getElementById(`unread_${friendId}`); if(el){if(c>0){el.textContent=c>9?'9+':c; el.style.display='block';} else{el.style.display='none';}}}); }

            // **SEEN DELETE LOGIC v2 (Sender deletes from DB, Receiver deletes locally)**
        function cleanupSeenMessages() {
            if (!currentChatId || !myClientId || isProcessingCleanup) return;
            console.log("Cleanup: Checking messages in:", currentChatId);
            isProcessingCleanup = true;
            const ref = db.ref(`messages/${currentChatId}`);
            ref.once('value', (snapshot) => {
                 const updatesForMe = {}; // Messages I saw, mark for local delete
                 const deletesFromDB = {}; // Messages I sent that friend saw, delete from DB

                 if (snapshot.exists()) {
                     snapshot.forEach((child) => {
                         const msgId = child.key;
                         const msgData = child.val();
                         if (!msgData) return;

                         // Logic for messages I RECEIVED and have SEEN
                         if (msgData.senderId !== myClientId && msgData.seenBy && msgData.seenBy[myClientId]) {
                             // Mark this message as deleted FOR ME if not already marked
                             if (!msgData.deletedFor || !msgData.deletedFor[myClientId]) {
                                 console.log("Cleanup: Marking received seen msg for local deletion:", msgId);
                                 updatesForMe[`${msgId}/deletedFor/${myClientId}`] = true;
                             }
                         }
                         // Logic for messages I SENT and FRIEND has SEEN
                         else if (msgData.senderId === myClientId && msgData.seenBy && msgData.seenBy[currentFriendId]) {
                             console.log("Cleanup: Deleting sent seen msg from DB:", msgId);
                             deletesFromDB[msgId] = null; // Mark for DB deletion
                         }
                     });
                 }

                 const promises = [];
                 // Apply local deletions (mark deletedFor me)
                 if (Object.keys(updatesForMe).length > 0) {
                      console.log("Applying local deletions:", Object.keys(updatesForMe));
                      promises.push(ref.update(updatesForMe));
                 }
                 // Apply DB deletions (remove messages I sent that were seen)
                 if (Object.keys(deletesFromDB).length > 0) {
                      console.log("Applying DB deletions:", Object.keys(deletesFromDB));
                      promises.push(ref.update(deletesFromDB)); // Use update with null to remove
                 }

                 if (promises.length === 0) {
                      console.log("Cleanup: No messages found to clean.");
                      isProcessingCleanup = false;
                      return;
                 }

                 Promise.all(promises)
                     .then(() => { console.log("Cleanup finished:", currentChatId); isProcessingCleanup = false; })
                     .catch((e) => { console.error("Cleanup error:", e); isProcessingCleanup = false; });

            }, (error) => { console.error("Cleanup fetch error:", error); isProcessingCleanup = false; });
        }


        // Message Sending (remains same)
        messageForm.addEventListener('submit', (e)=>{e.preventDefault(); sendMessage(false);});
        lockButton.addEventListener('click', ()=>{sendMessage(true);});
        function sendMessage(isLocked) { /* ... same ... */ if(!currentChatId||!myClientId)return; const txt=messageInput.value.trim(); if(txt==='')return; if(isLocked){showModal({title:"Lock", text:"Password?", password:"", passwordPlaceholder:"Password", primaryButton:"Lock & Send", secondaryButton:"Cancel"},(r)=>{if(r.primary&&r.password){sendFirebaseMessage(txt,true,r.password);}else if(r.primary){alert("Need pwd.");}});}else{sendFirebaseMessage(txt,false,null);}}
        function sendFirebaseMessage(text, isLocked, password) { /* ... same ... */ const ref=db.ref(`messages/${currentChatId}`); const newRef=ref.push(); const mid=newRef.key; let data={senderId:myClientId, text:text, type:isLocked?'locked':'normal', timestamp:firebase.database.ServerValue.TIMESTAMP, seenBy:null, deletedFor:null}; if(isLocked){try{const enc=encryptText(text,password); saveLockedMessage(mid,enc);}catch(e){alert("Lock failed."); data.type='normal';}} newRef.set(data).then(()=>{messageInput.value=''; messageInput.style.height='auto'; chatWindow.scrollTop=chatWindow.scrollHeight;}).catch((err)=>{alert('Send failed.');}); }

        // --- Message Deletion Actions --- (remain same)
        function handleDeleteMeClick() { if(!contextMsgId||!currentChatId||!myClientId) return; db.ref(`messages/${currentChatId}/${contextMsgId}/deletedFor/${myClientId}`).set(true).then(()=>{const el=document.getElementById(contextMsgId); if(el) el.remove(); updateChatListPreview(currentFriendId);}); contextMenu.style.display='none'; }
        function handleDeleteEveryoneClick() { if(!contextMsgId||!currentChatId) return; db.ref(`messages/${currentChatId}/${contextMsgId}`).remove().then(()=>{updateChatListPreview(currentFriendId);}); contextMenu.style.display='none'; }

        // --- Lock/Unlock actions --- (**LOCK LOST FIX**) - CHECKED
        function handleRelockClick() { if(!contextMsgId) return; const b=document.getElementById(contextMsgId)?.querySelector('.message-bubble'); if(!b||!b.dataset.unlocked) return; const d=getLockedMessage(contextMsgId); if(d){b.textContent='🔒 Tap to unlock...'; b.style.cursor='pointer'; delete b.dataset.unlocked; alert("Re-locked.");} else{alert("Cannot re-lock.");} contextMenu.style.display='none'; }
        function handleRemoveLockClick() {
             if (!contextMsgId) return; const bubble = document.getElementById(contextMsgId)?.querySelector('.message-bubble'); const lockedData = getLockedMessage(contextMsgId); if (!bubble || !lockedData) { alert("Not locked."); contextMenu.style.display = 'none'; return; }
             showModal({ title: "Remove Lock", text: "Enter password.", password: "", primaryButton: "Remove", secondaryButton: "Cancel" }, (result) => {
                 if (result.primary && result.password) {
                     try { const decrypted = decryptText(lockedData.encryptedText, result.password);
                         let lockedMsgs = JSON.parse(localStorage.getItem('myLockedMessages')) || {}; delete lockedMsgs[contextMsgId]; localStorage.setItem('myLockedMessages', JSON.stringify(lockedMsgs));
                         bubble.textContent = decrypted; bubble.style.cursor = 'default'; delete bubble.dataset.encrypted; bubble.dataset.unlocked = "true";
                         alert("Lock removed locally.");
                     } catch (e) { alert("Incorrect password."); } } }); contextMenu.style.display = 'none';
        }
        function handleAddLockClick() {
             if (!contextMsgId) return; const bubble = document.getElementById(contextMsgId)?.querySelector('.message-bubble'); if (!bubble || bubble.dataset.encrypted){ alert("Cannot lock."); contextMenu.style.display = 'none'; return; } const currentText = bubble.textContent;
             showModal({ title: "Add Lock", text: "Create password.", password: "", primaryButton: "Lock", secondaryButton: "Cancel" }, (result) => {
                 if (result.primary && result.password) {
                     try { const encryptedText = encryptText(currentText, result.password); saveLockedMessage(contextMsgId, encryptedText);
                         bubble.textContent = '🔒 Tap to unlock...'; bubble.dataset.encrypted = encryptedText; bubble.style.cursor = 'pointer'; delete bubble.dataset.unlocked;
                         alert("Locked locally.");
                     } catch (e) { alert("Could not lock."); } } }); contextMenu.style.display = 'none';
        }
        // Hide context menus on outside click (CHECKED)
        document.addEventListener('click', (e)=>{
             // Close message menu if click is outside bubble or menu
             if (contextMenu.style.display === 'block' && !contextMenu.contains(e.target) && !e.target.closest('.message-bubble')) {
                 contextMenu.style.display = 'none';
             }
             // Close chat list menu if click is outside item or menu
             if (chatListContextMenu.style.display === 'block' && !chatListContextMenu.contains(e.target) && !e.target.closest('.chat-list-item')) {
                 chatListContextMenu.style.display = 'none';
             }
        });
        // Modal Helper (remains same)
        let modalCallback = null; function showModal(options, callback) { modalTitle.textContent=options.title||""; modalText.textContent=options.text||""; if(options.inputText!==undefined){modalInputText.value=options.inputText; modalInputText.placeholder=options.placeholder||""; modalInputText.style.display='block'; modalInputText.readOnly=options.readOnly||false;}else{modalInputText.style.display='none';} if(options.password!==undefined){modalInputPassword.value=""; modalInputPassword.placeholder=options.passwordPlaceholder||"Password"; modalInputPassword.style.display='block';}else{modalInputPassword.style.display='none';} modalButtonPrimary.textContent=options.primaryButton||"OK"; modalButtonSecondary.textContent=options.secondaryButton||"Cancel"; modalCallback=callback; modal.style.display='flex'; } modalButtonPrimary.addEventListener('click',()=>{modal.style.display='none'; if(modalCallback){modalCallback({primary:true, inputText:modalInputText.style.display!=='none'?modalInputText.value:undefined, password:modalInputPassword.style.display!=='none'?modalInputPassword.value:undefined});} modalInputText.value=""; modalInputPassword.value=""; }); modalButtonSecondary.addEventListener('click',()=>{modal.style.display='none'; if(modalCallback){modalCallback({primary:false});} modalInputText.value=""; modalInputPassword.value=""; });
        // Crypto Helpers (remain same)
        function encryptText(text, password){return CryptoJS.AES.encrypt(text, password).toString();} function decryptText(enc, pwd){const b=CryptoJS.AES.decrypt(enc, pwd); const t=b.toString(CryptoJS.enc.Utf8); if(!t)throw Error("Decrypt failed"); return t;} function saveLockedMessage(id, enc){let l=JSON.parse(localStorage.getItem('myLockedMessages'))||{}; l[id]={encryptedText:enc}; const k=Object.keys(l); if(k.length>100){delete l[k[0]];} localStorage.setItem('myLockedMessages',JSON.stringify(l));} function getLockedMessage(id){let l=JSON.parse(localStorage.getItem('myLockedMessages'))||{}; return l[id];}


        // =======================================
        // 7. WebRTC (CALLING) LOGIC - **NEW CONTROLS, CHECKED**
        // =======================================
        const pcConfig = { 'iceServers': [ { 'urls': 'stun:stun.l.google.com:19302' }, { 'urls': 'stun:stun1.l.google.com:19302' } ] };
        voiceCallBtn.addEventListener('click', () => { startCall('voice'); });
        videoCallBtn.addEventListener('click', () => { startCall('video'); });
        toggleMuteBtn.addEventListener('click', toggleMute);
        toggleSpeakerBtn.addEventListener('click', toggleSpeaker);
        toggleVideoBtn.addEventListener('click', toggleVideo);
        swapVideoBtn.addEventListener('click', swapVideos);
        // --- All WebRTC functions remain the same ---
         function toggleMute() { if(!localStream)return; const a=localStream.getAudioTracks(); if(a.length>0){a[0].enabled=!a[0].enabled; toggleMuteBtn.textContent=a[0].enabled?'🎤':'🚫'; toggleMuteBtn.classList.toggle('muted',!a[0].enabled); console.log("Mute:",!a[0].enabled);} }
         async function toggleSpeaker() { const rv=document.getElementById('remote-video'); if(!remoteStream||!rv)return; try{if(typeof rv.setSinkId==='function'){const devices=await navigator.mediaDevices.enumerateDevices(); const speaker=devices.find(d=>d.kind==='audiooutput'&&d.label&&d.label.toLowerCase().includes('speaker')); let currentSinkId='default'; try{currentSinkId=rv.sinkId||'default';}catch(e){} let targetSinkId='default'; if(currentSinkId==='default'&&speaker){targetSinkId=speaker.deviceId; toggleSpeakerBtn.classList.add('active');} else{toggleSpeakerBtn.classList.remove('active');} await rv.setSinkId(targetSinkId);}else{alert("Not supported.");}}catch(err){alert("Cannot switch output.");} }
         function toggleVideo() { if(!localStream||currentCallType!=='video')return; const v=localStream.getVideoTracks(); if(v.length>0){v[0].enabled=!v[0].enabled; toggleVideoBtn.textContent=v[0].enabled?'📷':'🚫'; toggleVideoBtn.classList.toggle('off',!v[0].enabled); document.getElementById('local-video').style.display=v[0].enabled?'block':'none'; console.log("Video:",v[0].enabled);} }
         function swapVideos() { if(currentCallType!=='video')return; const lv=document.getElementById('local-video'); const rv=document.getElementById('remote-video'); if(lv&&rv){lv.classList.toggle('fullscreen'); rv.classList.toggle('pip');}}
         async function startCall(type) { if(!currentFriendId||!myClientId||currentCallId)return; console.log(`Start ${type} call to ${currentFriendId}`); currentCallType=type; currentCallFriendId=currentFriendId; const pushRef=db.ref(`calls/${currentFriendId}`).push(); currentCallId=pushRef.key; try { localStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }); showCallingScreen(type, `Calling ${currentFriendName}...`); attachMediaStream(document.getElementById('local-video'), localStream); } catch (e) { alert("Media err?"); if(currentCallId){db.ref(`calls/${currentFriendId}/${currentCallId}`).remove(); currentCallId=null;} return; } const pc=createPeerConnection(currentFriendId, currentCallId, type); if(!pc){hangUp(false); return;} rtpcConnections[currentCallId]=pc; localStream.getTracks().forEach(t=>{try{pc.addTrack(t, localStream);}catch(e){}}); try { const offer=await pc.createOffer(); await pc.setLocalDescription(offer); const data={from:myClientId, to:currentFriendId, type:type, offer:{type:offer.type, sdp:offer.sdp}}; await pushRef.set(data); const friendRef=db.ref(`calls/${myClientId}/${currentCallId}`); friendRef.on('value', async (s)=>{const pcc=rtpcConnections[currentCallId]; if(!pcc||pcc.signalingState==='closed') return; const d=s.val(); if(!d) return; if(d.answer&&!pcc.currentRemoteDescription){const a=new RTCSessionDescription(d.answer); try{await pcc.setRemoteDescription(a); startCallTimer();}catch(e){hangUp(true);}} if(d.declined){alert("Declined."); hangUp(false); s.ref.remove();} if(d.hungup){hangUp(false); s.ref.remove();}}); const iceRef=db.ref(`iceCandidates/${myClientId}/${currentCallId}`); iceRef.on('child_added', (s)=>{const pcc=rtpcConnections[currentCallId]; if(s.exists()&&pcc&&pcc.signalingState!=='closed'){pcc.addIceCandidate(new RTCIceCandidate(s.val())).catch(e=>{}); s.ref.remove();}}); } catch (e) { alert("Call init failed."); hangUp(false); } }
         function showIncomingCallAlert(type, name, friendId, callId){if(currentCallId){db.ref(`calls/${myClientId}/${callId}`).update({declined: true}); setTimeout(()=>db.ref(`calls/${myClientId}/${callId}`).remove(),5000); return;} currentCallId=callId; currentCallType=type; currentCallFriendId=friendId; incomingCallTitle.textContent=`Incoming ${type} call...`; incomingCallFrom.textContent=`from ${name}`; incomingCallAlert.style.display='block'; acceptCallBtn.onclick=acceptCall; declineCallBtn.onclick=declineCall;}
         async function acceptCall(){if(!currentCallId||!currentCallFriendId||!currentCallType)return; console.log(`Accept ${currentCallType} ${currentCallId}`); incomingCallAlert.style.display='none'; const ref=db.ref(`calls/${myClientId}/${currentCallId}`); try{localStream=await navigator.mediaDevices.getUserMedia({video:currentCallType==='video',audio:true}); const name=friendsList[currentCallFriendId]?.name||`AI(...)`; showCallingScreen(currentCallType, `Connecting with ${name}...`); attachMediaStream(document.getElementById('local-video'),localStream);}catch(e){alert("Media err?"); declineCall(); return;} const pc=createPeerConnection(currentCallFriendId, currentCallId, currentCallType); if(!pc){hangUp(false); return;} rtpcConnections[currentCallId]=pc; localStream.getTracks().forEach(t=>{try{pc.addTrack(t,localStream);}catch(e){}}); try{const data=(await ref.once('value')).val(); if(!data||!data.offer)throw Error("No offer"); const offer=new RTCSessionDescription(data.offer); await pc.setRemoteDescription(offer); const answer=await pc.createAnswer(); await pc.setLocalDescription(answer); const callerRef=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); await callerRef.update({answer:{type:answer.type, sdp:answer.sdp}}); startCallTimer(); const callerIceRef=db.ref(`iceCandidates/${myClientId}/${currentCallId}`); callerIceRef.on('child_added', (s)=>{const pcc=rtpcConnections[currentCallId]; if(s.exists()&&pcc&&pcc.signalingState!=='closed'){pcc.addIceCandidate(new RTCIceCandidate(s.val())).catch(e=>{}); s.ref.remove();}}); ref.on('value', (s)=>{const d=s.val(); if(d&&d.hungup){hangUp(false); s.ref.remove();}}); } catch(e){alert("Connect failed."); hangUp(false);} }
         function declineCall(){console.log("Declining:", currentCallId); incomingCallAlert.style.display='none'; if(currentCallId&&currentCallFriendId){const ref=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); ref.update({declined:true}); db.ref(`calls/${myClientId}/${currentCallId}`).remove(); db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove();} currentCallId=null; currentCallFriendId=null; currentCallType=null;}
         function createPeerConnection(friendId, callId, type){try{const pc=new RTCPeerConnection(pcConfig); pc.onicecandidate=(e)=>{if(e.candidate&&friendId&&callId){db.ref(`iceCandidates/${friendId}/${callId}`).push(e.candidate.toJSON());}}; pc.ontrack=(e)=>{const rv=document.getElementById('remote-video'); if(!remoteStream){remoteStream=new MediaStream();} if(!remoteStream.getTracks().includes(e.track)){remoteStream.addTrack(e.track);} attachMediaStream(rv, remoteStream); if(type==='voice'&&rv){rv.style.display='none';} else if(rv){rv.style.display='block';} const name=friendsList[friendId]?.name||`AI(...)`; if(callingStatus) callingStatus.textContent=`On call with ${name}`;}; pc.onconnectionstatechange=()=>{if(pc.connectionState==='disconnected'||pc.connectionState==='failed'||pc.connectionState==='closed'){hangUp(true);}}; pc.onsignalingstatechange=()=>{}; pc.oniceconnectionstatechange=()=>{if(pc.iceConnectionState==='failed'){hangUp(true);}}; return pc;} catch(e){alert("Call failed (Browser?)."); return null;}}
         function showCallingScreen(type, status){/* ... reset buttons ... */ const rv=document.getElementById('remote-video'); const lv=document.getElementById('local-video'); if(type==='voice'){if(rv) rv.style.display='none'; if(lv) lv.style.display='none'; if(toggleVideoBtn) toggleVideoBtn.style.display='none'; if(swapVideoBtn) swapVideoBtn.style.display = 'none';} else{if(rv) rv.style.display='block'; if(lv) lv.style.display='block'; if(toggleVideoBtn) toggleVideoBtn.style.display='flex'; if(swapVideoBtn) swapVideoBtn.style.display = 'flex';} if(callingStatus) callingStatus.textContent=status; if(callTimer) callTimer.textContent='00:00'; if(hangupButton) hangupButton.onclick=()=>hangUp(true); if(toggleMuteBtn){toggleMuteBtn.textContent='🎤'; toggleMuteBtn.classList.remove('muted');} if(toggleSpeakerBtn) toggleSpeakerBtn.classList.remove('active'); if(toggleVideoBtn){toggleVideoBtn.textContent='📷'; toggleVideoBtn.classList.remove('off');} if(lv) lv.classList.remove('fullscreen'); if(rv) rv.classList.remove('pip'); if(callingScreen) callingScreen.style.display='flex';}
         function hangUp(sendSignal=true){/* ... same cleanup + reset button states ... */ if(!currentCallId&&!localStream&&!remoteStream&&callingScreen.style.display==='none')return; console.log("HangUp:", currentCallId, "Signal:", sendSignal); if(currentCallId&&rtpcConnections[currentCallId]){try{rtpcConnections[currentCallId].close();}catch(e){} delete rtpcConnections[currentCallId];} if(localStream){localStream.getTracks().forEach(t=>t.stop()); localStream=null;} if(remoteStream){const rv=document.getElementById('remote-video'); if(rv) rv.srcObject=null; remoteStream.getTracks().forEach(t=>t.stop()); remoteStream=null;} if(sendSignal&&currentCallId&&currentCallFriendId){const ref=db.ref(`calls/${currentCallFriendId}/${currentCallId}`); ref.update({hungup:true}).then(()=>setTimeout(()=>ref.remove(),5000)).catch(()=>{});} if(currentCallId&&myClientId){db.ref(`calls/${myClientId}/${currentCallId}`).remove(); db.ref(`iceCandidates/${myClientId}/${currentCallId}`).remove(); if(currentCallFriendId){db.ref(`iceCandidates/${currentCallFriendId}/${currentCallId}`).remove();}} if(callingScreen) callingScreen.style.display='none'; if(incomingCallAlert) incomingCallAlert.style.display='none'; if(callTimerInterval){clearInterval(callTimerInterval); callTimerInterval=null;} if(toggleMuteBtn){toggleMuteBtn.textContent='🎤'; toggleMuteBtn.classList.remove('muted');} if(toggleSpeakerBtn) toggleSpeakerBtn.classList.remove('active'); if(toggleVideoBtn){toggleVideoBtn.textContent='📷'; toggleVideoBtn.classList.remove('off');} currentCallId=null; currentCallType=null; currentCallFriendId=null; console.log("Call state reset");}
         function attachMediaStream(element, stream){/* ... same ... */ if(element&&stream){try{if(element.srcObject!==stream){element.srcObject=stream;}}catch(e){}} else{if(stream){}}}
         function startCallTimer(){/* ... same ... */ if(callTimerInterval)clearInterval(callTimerInterval); let s=0; if(callTimer) callTimer.textContent='00:00'; callTimerInterval=setInterval(()=>{s++; const m=Math.floor(s/60).toString().padStart(2,'0'); const ss=(s%60).toString().padStart(2,'0'); if(callTimer) callTimer.textContent=`${m}:${ss}`;}, 1000);}


         // --- Touch Event Handlers for Long Press --- (**CHECKED**)
        function handleTouchStart(e, id, callback) { clearTimeout(longPressTimer); isMoving = false; touchTargetElement = e.target; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; longPressTimer = setTimeout(() => { if (!isMoving && touchTargetElement === e.target) { console.log("Long press:", id); callback(e.touches[0], id); } }, LONG_PRESS_DURATION); }
        function handleTouchEnd() { clearTimeout(longPressTimer); }
        function handleTouchMove(e) { if(longPressTimer){const tX=e.touches[0].clientX; const tY=e.touches[0].clientY; if(Math.abs(tX-touchStartX)>10||Math.abs(tY-touchStartY)>10){isMoving=true; clearTimeout(longPressTimer); longPressTimer=null;}}}
        function positionContextMenu(menuElement, x, y) { if(!menuElement) return; menuElement.style.display='block'; const mw=menuElement.offsetWidth||200; const mh=menuElement.offsetHeight||200; const sw=window.innerWidth; const sh=window.innerHeight; let l=x; let t=y; if(l+mw>sw) l=sw-mw-10; if(t+mh>sh) t=sh-mh-10; if(l<10)l=10; if(t<10)t=10; menuElement.style.left=`${l}px`; menuElement.style.top=`${t}px`; }


    } catch (error) { // Catch Firebase init error
        console.error("Firebase Init Error:", error);
        document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>App Failed</h1><p>Init Error: ${error.message}</p></div>`;
    }
}); // End of DOMContentLoaded
        
             
