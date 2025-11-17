# Video Conferencing Web App

A simple but powerful video conferencing web application built with WebRTC, Bun, Hono, and Socket.io. Anyone with the link can join via their browser using camera and microphone.

## Features

- 🎥 **Multi-participant video conferencing** - See all participants in a grid layout
- 🎤 **Audio/Video controls** - Mute/unmute audio and toggle video
- 💬 **Live chat** - Real-time chat with link detection and sharing
- 🔗 **Easy sharing** - Share room link with anyone
- 📱 **Responsive design** - Works on desktop and mobile devices
- 🚀 **Fast & lightweight** - Built with Bun runtime and Hono framework

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **WebRTC**: Native browser APIs for peer-to-peer video/audio
- **Backend**: Bun runtime + Hono framework + Socket.io
- **Package Manager**: pnpm

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- [pnpm](https://pnpm.io/) package manager installed
- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)

## Installation

1. Install Bun (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install pnpm globally:
   ```bash
   npm install -g pnpm
   # or
   bun install -g pnpm
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

## Running the Application

1. Start the server:
   ```bash
   bun run dev
   # or
   bun server/server.ts
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Allow camera and microphone access when prompted.

4. Share the URL (including the room ID) with others to invite them to join.

## Usage

- **Joining a room**: The app automatically generates a room ID from the URL. If you visit without a room ID, one will be created and added to the URL.
- **Sharing**: Copy the URL from your browser's address bar and share it with others.
- **Chat**: Type messages in the chat sidebar on the right. Links are automatically detected and clickable.
- **Controls**: Use the "Mute" and "Stop Video" buttons to control your audio/video.

## Architecture

The app uses a **mesh topology** where each peer connects directly to all other peers. This works well for small groups (4-6 participants).

### How it works:

1. User requests camera/microphone access
2. Client connects to Socket.io signaling server
3. Server manages room membership and WebRTC signaling
4. Peers exchange offers/answers and ICE candidates via Socket.io
5. Direct peer-to-peer connections are established using WebRTC
6. Video/audio streams are displayed in a responsive grid layout

## Browser APIs Used

- **getUserMedia()** - Access to camera and microphone
- **RTCPeerConnection** - Peer-to-peer connections
- **RTCDataChannel** - Low-latency data channel (optional for chat)
- **MediaStream API** - Managing audio/video streams

## Performance Considerations

- Mesh topology limits scalability to ~4-6 participants
- Each peer connection consumes bandwidth
- CPU usage increases with number of participants
- Mobile devices may experience battery drain

## Troubleshooting

- **Camera/Microphone not working**: Check browser permissions and ensure devices are not being used by other applications
- **Can't see other participants**: Check firewall settings and ensure STUN servers are accessible
- **Connection issues**: Try refreshing the page or rejoining the room

## License

MIT

