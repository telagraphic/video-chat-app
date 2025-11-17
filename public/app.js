// Get room ID from URL or generate one
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || generateRoomId();

// Update URL with room ID if not present
if (!urlParams.get('room')) {
    window.history.replaceState({}, '', `?room=${roomId}`);
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 9);
}

// Socket.io connection
const socket = io();

// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// State management
let localStream = null;
let peers = new Map();
let isMuted = false;
let isVideoOff = false;

// DOM elements
const localVideo = document.getElementById('localVideo');
const videoGrid = document.getElementById('videoGrid');
const permissionPrompt = document.getElementById('permissionPrompt');
const enableMediaBtn = document.getElementById('enableMediaBtn');
const refreshBtn = document.getElementById('refreshBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const participantCount = document.getElementById('participantCount');

// Request camera and microphone access
async function requestMediaAccess() {
    try {
        // Check if we're in a secure context (required for getUserMedia)
        if (!window.isSecureContext) {
            throw new Error('getUserMedia requires a secure context (HTTPS). Please access this page via HTTPS or use localhost.');
        }
        
        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
        }
        
        console.log('Requesting camera and microphone access...');
        console.log('Secure context:', window.isSecureContext);
        console.log('Page URL:', window.location.href);
        console.log('navigator.mediaDevices available:', !!navigator.mediaDevices);
        console.log('getUserMedia available:', !!navigator.mediaDevices.getUserMedia);
        
        // Check permission state (if supported)
        let permissionDenied = false;
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const cameraPermission = await navigator.permissions.query({ name: 'camera' });
                const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
                console.log('Camera permission state:', cameraPermission.state);
                console.log('Microphone permission state:', microphonePermission.state);
                
                if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
                    permissionDenied = true;
                    console.warn('Permissions were previously denied. Browser will not show prompt again.');
                    // Don't throw here - let getUserMedia handle it so we get proper error message
                }
            } catch (permError) {
                console.log('Permission query not fully supported:', permError);
                // Continue anyway - some browsers don't support permission queries
            }
        }
        
        // Hide the permission prompt immediately to show browser's native prompt
        permissionPrompt.classList.add('hidden');
        
        console.log('Calling getUserMedia with constraints...');
        
        // Try with simpler constraints first to ensure it works
        const constraints = {
            video: true,
            audio: true
        };
        
        console.log('Constraints:', JSON.stringify(constraints, null, 2));
        
        // Request media access - this will show browser's native permission prompt
        console.log('Calling getUserMedia - browser should show permission prompt now...');
        console.log('Browser:', navigator.userAgent);
        console.log('If you don\'t see a browser permission prompt, check:');
        console.log('1. Browser address bar for a camera/mic icon');
        console.log('2. Browser settings for localhost permissions');
        console.log('3. Any browser extensions that might block permissions');
        console.log('4. System-level permissions (macOS: System Settings → Privacy & Security)');
        
        // Add a small delay to ensure the UI is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Call getUserMedia directly
        // The browser will handle showing the prompt and waiting for user response
        console.log('About to call getUserMedia...');
        
        const browserInfo = navigator.userAgent;
        const isArc = browserInfo.includes('Arc') || window.navigator.userAgentData?.brands?.some(b => b.brand.includes('Arc'));
        
        if (isArc) {
            console.log('Detected Arc browser. Arc may have specific privacy settings.');
            console.log('Try: Arc Settings → Privacy → Check camera/microphone permissions');
        }
        
        console.log('NOTE: If no prompt appears, check:');
        console.log('1. macOS System Settings → Privacy & Security → Camera/Microphone');
        console.log('2. Browser settings (Arc: Settings → Privacy)');
        console.log('3. Browser extensions that might block permissions');
        console.log('4. Try restarting the browser after granting macOS permissions');
        
        // Create a timeout to detect if getUserMedia hangs without showing a prompt
        let timeoutWarningShown = false;
        const getUserMediaTimeout = setTimeout(() => {
            timeoutWarningShown = true;
            console.warn('⚠️ getUserMedia is taking longer than expected (>3 seconds).');
            console.warn('This usually means the browser is not showing the permission prompt.');
            console.warn('');
            console.warn('For Arc browser specifically:');
            console.warn('1. Check Arc Settings → Privacy → Camera/Microphone permissions');
            console.warn('2. Try accessing chrome://settings/content/camera in Arc');
            console.warn('3. Ensure localhost is not blocked in Arc privacy settings');
            console.warn('4. Try restarting Arc browser');
            console.warn('5. Test in Chrome/Firefox to see if it\'s Arc-specific');
            console.warn('');
            console.warn('The prompt should appear within 1-2 seconds. If it doesn\'t, the browser is likely blocking it silently.');
        }, 3000); // Warn after 3 seconds
        
        try {
            // Call getUserMedia - this should show a prompt immediately
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            clearTimeout(getUserMediaTimeout);
            console.log('✅ getUserMedia promise resolved successfully!');
        } catch (getUserMediaError) {
            clearTimeout(getUserMediaTimeout);
            console.error('❌ getUserMedia error caught:', getUserMediaError);
            console.error('Error name:', getUserMediaError.name);
            console.error('Error message:', getUserMediaError.message);
            
            // Provide specific guidance based on error type
            if (getUserMediaError.name === 'NotAllowedError' || getUserMediaError.name === 'PermissionDeniedError') {
                console.error('');
                console.error('Permission was denied. For Arc browser:');
                console.error('1. Check Arc Settings → Privacy → Camera/Microphone');
                console.error('2. Visit chrome://settings/content/camera in Arc');
                console.error('3. Ensure localhost:3000 is allowed');
            }
            
            throw getUserMediaError; // Re-throw to be caught by outer try-catch
        }
        
        console.log('Media stream obtained:', localStream);
        console.log('Video tracks:', localStream.getVideoTracks());
        console.log('Audio tracks:', localStream.getAudioTracks());
        
        // Check if video tracks are active
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            console.log('Video track enabled:', videoTracks[0].enabled);
            console.log('Video track readyState:', videoTracks[0].readyState);
        }
        
        // Ensure video element has required attributes BEFORE setting stream
        localVideo.autoplay = true;
        localVideo.muted = true;
        localVideo.playsInline = true;
        localVideo.setAttribute('playsinline', 'true');
        localVideo.setAttribute('webkit-playsinline', 'true');
        
        // Set the stream to the video element
        localVideo.srcObject = localStream;
        
        // Verify stream is set
        if (localVideo.srcObject !== localStream) {
            console.error('Failed to set srcObject on video element');
            throw new Error('Failed to attach stream to video element');
        }
        
        console.log('Stream attached to video element. Video element state:', {
            srcObject: !!localVideo.srcObject,
            readyState: localVideo.readyState,
            paused: localVideo.paused,
            muted: localVideo.muted
        });
        
        // Add event listeners to verify video is working (only add once)
        const metadataHandler = () => {
            console.log('Video metadata loaded. Video dimensions:', localVideo.videoWidth, 'x', localVideo.videoHeight);
            console.log('Video readyState:', localVideo.readyState);
        };
        
        const playingHandler = () => {
            console.log('Video is now playing');
            console.log('Camera should be active now');
        };
        
        const errorHandler = (e) => {
            console.error('Video element error:', e);
            console.error('Video error details:', localVideo.error);
        };
        
        // Remove old listeners if they exist, then add new ones
        localVideo.removeEventListener('loadedmetadata', metadataHandler);
        localVideo.removeEventListener('playing', playingHandler);
        localVideo.removeEventListener('error', errorHandler);
        
        localVideo.addEventListener('loadedmetadata', metadataHandler);
        localVideo.addEventListener('playing', playingHandler);
        localVideo.addEventListener('error', errorHandler);
        
        // Explicitly play the video
        try {
            const playPromise = localVideo.play();
            if (playPromise !== undefined) {
                await playPromise;
                console.log('Video playback started successfully');
            }
        } catch (playError) {
            console.error('Error playing video:', playError);
            console.error('Play error details:', {
                name: playError.name,
                message: playError.message
            });
            
            // Try to play again after a short delay
            setTimeout(async () => {
                try {
                    await localVideo.play();
                    console.log('Video playback started after retry');
                } catch (retryError) {
                    console.error('Failed to play video after retry:', retryError);
                    // Show user-friendly error
                    alert('Video playback failed. Please check your browser settings and try refreshing the page.');
                }
            }, 200);
        }
        
        // Double-check video tracks are active
        setTimeout(() => {
            const tracks = localStream.getVideoTracks();
            tracks.forEach((track, index) => {
                console.log(`Video track ${index}:`, {
                    enabled: track.enabled,
                    readyState: track.readyState,
                    muted: track.muted,
                    label: track.label
                });
            });
            
            if (localVideo.videoWidth === 0 && localVideo.videoHeight === 0) {
                console.warn('Video element has zero dimensions - stream may not be working');
            }
        }, 500);
        
        // Join room after getting media access
        socket.emit('join-room', roomId);
        
        updateParticipantCount();
    } catch (error) {
        console.error('Error accessing media devices:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            constraint: error.constraint
        });
        
        // Show permission prompt again if user denied or error occurred
        permissionPrompt.classList.remove('hidden');
        
        let errorMessage = 'Failed to access camera and microphone.';
        let instructions = '';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera and microphone access was denied or blocked.';
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const browserInfo = navigator.userAgent;
            const isArc = browserInfo.includes('Arc') || window.navigator.userAgentData?.brands?.some(b => b.brand.includes('Arc'));
            const isChrome = browserInfo.includes('Chrome') && !browserInfo.includes('Edg') && !isArc;
            const isFirefox = browserInfo.includes('Firefox');
            const isSafari = browserInfo.includes('Safari') && !browserInfo.includes('Chrome');
            
            let browserSpecificInstructions = '';
            if (isArc) {
                browserSpecificInstructions = `
                    <li><strong>Arc Browser Settings (IMPORTANT):</strong>
                        <ul style="margin-top: 0.5rem;">
                            <li>Go to <strong>Arc Settings</strong> → <strong>Privacy</strong> → Check Camera/Microphone permissions</li>
                            <li>Visit <code>chrome://settings/content/camera</code> in Arc - ensure localhost is allowed</li>
                            <li>Visit <code>chrome://settings/content/microphone</code> in Arc - ensure localhost is allowed</li>
                            <li>Click the lock icon (🔒) in address bar → Site settings → Reset permissions</li>
                            <li><strong>Try restarting Arc browser</strong> after changing settings</li>
                            <li>Arc may have additional privacy settings that block localhost - check Arc's privacy preferences</li>
                        </ul>
                    </li>`;
            } else if (isChrome) {
                browserSpecificInstructions = `
                    <li><strong>Chrome Browser Settings:</strong>
                        <ul style="margin-top: 0.5rem;">
                            <li>Go to <code>chrome://settings/content/camera</code> - ensure localhost is allowed</li>
                            <li>Go to <code>chrome://settings/content/microphone</code> - ensure localhost is allowed</li>
                            <li>Or click the lock icon (🔒) in address bar → Site settings → Reset permissions</li>
                        </ul>
                    </li>`;
            } else if (isFirefox) {
                browserSpecificInstructions = `
                    <li><strong>Firefox Browser Settings:</strong>
                        <ul style="margin-top: 0.5rem;">
                            <li>Click the shield icon in address bar → Permissions → Reset Camera/Microphone</li>
                            <li>Or go to about:preferences#privacy → Permissions section</li>
                        </ul>
                    </li>`;
            } else if (isSafari) {
                browserSpecificInstructions = `
                    <li><strong>Safari Browser Settings:</strong>
                        <ul style="margin-top: 0.5rem;">
                            <li>Safari → Settings → Websites → Camera → Remove localhost</li>
                            <li>Safari → Settings → Websites → Microphone → Remove localhost</li>
                        </ul>
                    </li>`;
            }
            
            instructions = `
                <strong>To fix this:</strong>
                <ol style="text-align: left; margin: 1rem 0; padding-left: 1.5rem;">
                    ${browserSpecificInstructions}
                    ${isMac ? `
                    <li><strong>macOS System Permissions (IMPORTANT):</strong>
                        <ul style="margin-top: 0.5rem;">
                            <li>Go to <strong>System Settings</strong> → <strong>Privacy & Security</strong></li>
                            <li>Click <strong>Camera</strong> → Ensure your browser (${isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Browser'}) is checked/enabled</li>
                            <li>Click <strong>Microphone</strong> → Ensure your browser is checked/enabled</li>
                            <li>If your browser is not listed, try accessing the camera from another app first</li>
                        </ul>
                    </li>` : ''}
                    <li><strong>Check Browser Extensions:</strong> Disable privacy/security extensions temporarily (uBlock Origin, Privacy Badger, etc.)</li>
                    <li><strong>Try Incognito/Private Mode:</strong> Test if extensions are blocking it</li>
                </ol>
                <p style="margin-top: 1rem;"><strong>After fixing permissions, refresh this page and try again.</strong></p>
            `;
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera or microphone found.';
            instructions = 'Please connect a camera and microphone device and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera or microphone is being used by another application.';
            instructions = 'Please close other applications using your camera/microphone and try again.';
        } else {
            errorMessage = `Error: ${error.message}`;
            instructions = 'Please check your camera and microphone settings.';
        }
        
        // Update the prompt message
        const promptText = permissionPrompt.querySelector('p');
        if (promptText) {
            promptText.innerHTML = `<strong>${errorMessage}</strong>${instructions ? '<br><br>' + instructions : ''}`;
        }
        
        // Show refresh button if permission was denied
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            if (refreshBtn) {
                refreshBtn.style.display = 'block';
            }
        } else {
            if (refreshBtn) {
                refreshBtn.style.display = 'none';
            }
        }
    }
}

// Enable media button click - MUST be triggered by user gesture
enableMediaBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Enable button clicked!');
    console.log('Page protocol:', window.location.protocol);
    console.log('Page host:', window.location.host);
    
    // Verify button was clicked (user gesture)
    if (!enableMediaBtn) {
        console.error('Enable button not found!');
        return;
    }
    
    try {
        await requestMediaAccess();
    } catch (error) {
        console.error('Error in requestMediaAccess:', error);
    }
});

// Refresh button handler
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        window.location.reload();
    });
}

// Create peer connection
function createPeerConnection(peerId) {
    const peerConnection = new RTCPeerConnection(configuration);
    
    // Add local tracks to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addRemoteVideo(peerId, remoteStream);
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                target: peerId
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            removePeer(peerId);
        }
    };
    
    peers.set(peerId, peerConnection);
    return peerConnection;
}

// Create offer and send to peer
async function createOffer(peerId) {
    const peerConnection = createPeerConnection(peerId);
    
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', {
            offer: offer,
            target: peerId,
            roomId: roomId
        });
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Handle offer from peer
async function handleOffer(data) {
    const { offer, sender } = data;
    let peerConnection = peers.get(sender);
    
    if (!peerConnection) {
        peerConnection = createPeerConnection(sender);
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
            answer: answer,
            target: sender
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle answer from peer
async function handleAnswer(data) {
    const { answer, sender } = data;
    const peerConnection = peers.get(sender);
    
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
}

// Handle ICE candidate
async function handleIceCandidate(data) {
    const { candidate, sender } = data;
    const peerConnection = peers.get(sender);
    
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
}

// Add remote video to grid
function addRemoteVideo(peerId, stream) {
    // Check if video container already exists
    let videoContainer = document.getElementById(`video-${peerId}`);
    
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = `video-${peerId}`;
        videoContainer.className = 'video-container';
        
        const video = document.createElement('video');
        video.id = `remoteVideo-${peerId}`;
        video.autoplay = true;
        video.playsinline = true;
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = `Peer ${peerId.substring(0, 8)}`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(label);
        videoGrid.appendChild(videoContainer);
    }
    
    const video = document.getElementById(`remoteVideo-${peerId}`);
    if (video) {
        video.srcObject = stream;
    }
    
    updateParticipantCount();
}

// Remove peer video
function removePeer(peerId) {
    const peerConnection = peers.get(peerId);
    if (peerConnection) {
        peerConnection.close();
        peers.delete(peerId);
    }
    
    const videoContainer = document.getElementById(`video-${peerId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
    
    updateParticipantCount();
}

// Update participant count
function updateParticipantCount() {
    const count = peers.size + 1; // +1 for local user
    participantCount.textContent = count;
}

// Socket event handlers
socket.on('user-joined', (peerId) => {
    console.log('User joined:', peerId);
    createOffer(peerId);
});

socket.on('existing-peers', (peerIds) => {
    console.log('Existing peers:', peerIds);
    peerIds.forEach(peerId => {
        createOffer(peerId);
    });
});

socket.on('offer', handleOffer);
socket.on('answer', handleAnswer);
socket.on('ice-candidate', handleIceCandidate);

socket.on('user-left', (peerId) => {
    console.log('User left:', peerId);
    removePeer(peerId);
});

// Mute/unmute audio
muteBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMuted;
        });
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Unmute';
        muteBtn.classList.toggle('active', isMuted);
    }
});

// Toggle video
videoBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isVideoOff;
        });
        isVideoOff = !isVideoOff;
        videoBtn.textContent = isVideoOff ? '📹 Stop Video' : '📹 Start Video';
        videoBtn.classList.toggle('active', isVideoOff);
    }
});

// Chat functionality
function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chat-message', {
            message: message,
            roomId: roomId,
            sender: socket.id
        });
        chatInput.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Display chat message
socket.on('chat-message', (data) => {
    const { message, sender, timestamp } = data;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = sender === socket.id ? 'You' : `Peer ${sender.substring(0, 8)}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    
    // Auto-detect and linkify URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const linkedMessage = message.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    textDiv.innerHTML = linkedMessage;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'timestamp';
    timeDiv.textContent = new Date(timestamp).toLocaleTimeString();
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    peers.forEach(peerConnection => peerConnection.close());
});

// Display room ID in console for sharing
console.log(`Room ID: ${roomId}`);
console.log(`Share this link: ${window.location.href}`);

