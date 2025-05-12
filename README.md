# Hand Gesture Music Generator

A web application that uses MediaPipe hand detection to create music based on hand movements in your webcam. Each finger controls a different musical note, and the pitch changes based on the position of your fingers.

## How It Works

1. Your webcam captures video of your hands
2. MediaPipe's hand landmark detection identifies the position of each finger
3. Each finger controls a different musical note
4. Moving your fingers up and down changes the pitch of the notes
5. The application visualizes the hand landmarks on the canvas

## Setup Instructions

1. Clone or download this repository
2. Due to browser security restrictions, you'll need to serve the files through a web server
   - You can use any local web server of your choice
   - For a simple option, use Python's built-in HTTP server:
     - Python 3: `python -m http.server`
     - Python 2: `python -m SimpleHTTPServer`
   - Or use Node.js with `npx serve`
3. Open your browser and navigate to the server address (usually `localhost:8000` or `127.0.0.1:8000`)
4. Allow camera permissions when prompted

## Usage

1. Click the "Start" button to activate your webcam and start the hand tracking
2. Position your hands in front of the camera
3. Extend your fingers (raise them above your palm) to play notes
4. Move your fingers up and down to change the pitch
5. Each finger plays a different note:
   - Right hand: Thumb (C4), Index (D4), Middle (E4), Ring (F4), Pinky (G4)
   - Left hand: Thumb (A4), Index (B4), Middle (C5), Ring (D5), Pinky (E5)
6. Click "Stop" to pause the application

## Requirements

- Modern web browser with WebGL support (Chrome, Firefox, Edge, Safari)
- Webcam access
- JavaScript enabled

## Technologies Used

- HTML5, CSS3, and JavaScript
- MediaPipe Hands API for hand tracking
- Web Audio API for sound generation

## Troubleshooting

If you encounter issues:

1. Make sure your browser supports the MediaPipe API and WebGL
2. Check that you've granted camera permissions
3. Try refreshing the page if the hand tracking doesn't start
4. Ensure you're serving the files from a web server (not opening the HTML file directly)
5. For best results, use Chrome or Edge browsers

## Notes

- For best performance, use the application in a well-lit environment
- Hand detection works best when your hands are clearly visible to the camera
- The application requires webcam permissions, which you'll need to grant when prompted 