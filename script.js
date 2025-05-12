// DOM elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const startButton = document.getElementById('start-btn');
const stopButton = document.getElementById('stop-btn');
const canvasCtx = canvasElement.getContext('2d');

// MediaPipe variables
let hands;
let camera;
let webcamRunning = false;

// Audio variables
let audioContext;
let oscillators = {};
const fingerNotes = [
  'C4', 'D4', 'E4', 'F4', 'G4', // Thumb to pinky, right hand
  'A4', 'B4', 'C5', 'D5', 'E5'  // Thumb to pinky, left hand
];
const noteFrequencies = {
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
  'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25
};

// Setup event listeners
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);

// Initialize MediaPipe Hands
function initMediaPipeHands() {
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });
  
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  
  hands.onResults(processResults);
  
  console.log("MediaPipe Hands initialized");
}

// Initialize the audio context
function initAudio() {
  // Create audio context
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create a compressor to avoid clipping
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(audioContext.destination);
  
  // Create oscillators for each finger (10 total for two hands)
  for (let i = 0; i < 10; i++) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = noteFrequencies[fingerNotes[i]];
    
    gain.gain.value = 0; // Start with volume at 0
    
    oscillator.connect(gain);
    gain.connect(compressor);
    
    oscillator.start();
    
    oscillators[i] = {
      oscillator: oscillator,
      gain: gain,
      isActive: false
    };
  }
}

// Start camera and setup processing
async function startCamera() {
  // Initialize if not already
  if (!hands) {
    initMediaPipeHands();
  }
  
  // Initialize audio
  if (!audioContext) {
    initAudio();
  } else if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  // Setup camera
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
  });
  
  // Set canvas dimensions
  canvasElement.width = 1280;
  canvasElement.height = 720;
  
  // Start camera
  try {
    await camera.start();
    webcamRunning = true;
    
    // Update buttons
    startButton.disabled = true;
    stopButton.disabled = false;
  } catch (error) {
    console.error('Error starting camera:', error);
    alert('Unable to access the camera. Please make sure it is connected and permissions are granted.');
  }
}

// Stop camera and audio
function stopCamera() {
  if (camera) {
    camera.stop();
  }
  
  webcamRunning = false;
  
  // Mute all oscillators
  Object.values(oscillators).forEach(osc => {
    osc.gain.gain.value = 0;
    osc.isActive = false;
  });
  
  // Update buttons
  startButton.disabled = false;
  stopButton.disabled = true;
  
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

// Process hand landmark results and update audio
function processResults(results) {
  // Clear canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Draw the video frame first
  canvasCtx.drawImage(
    results.image, 0, 0, canvasElement.width, canvasElement.height
  );
  
  // Reset all oscillators to inactive
  Object.values(oscillators).forEach(osc => {
    osc.isActive = false;
  });
  
  // Check if hands are detected
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Process each detected hand
    for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
      const landmarks = results.multiHandLandmarks[handIndex];
      const handedness = results.multiHandedness[handIndex];
      const isRightHand = handedness.label === 'Right';
      
      // Draw landmarks
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                    {color: isRightHand ? '#00FF00' : '#FF0000', lineWidth: 3});
      drawLandmarks(canvasCtx, landmarks, 
                   {color: isRightHand ? '#00CC00' : '#CC0000', lineWidth: 1});
      
      // Process finger landmarks for audio
      processFingerLandmarks(landmarks, handIndex, isRightHand);
    }
  }
  
  // Update audio for all oscillators
  updateAudio();
  
  canvasCtx.restore();
}

// Process finger landmarks to control audio
function processFingerLandmarks(landmarks, handIndex, isRightHand) {
  // Finger indices: 
  // - Thumb: 1-4
  // - Index: 5-8
  // - Middle: 9-12
  // - Ring: 13-16
  // - Pinky: 17-20
  // (0 is the wrist)
  
  const fingerTips = [4, 8, 12, 16, 20]; // Tip landmark indices
  const handOffset = isRightHand ? 0 : 5; // Offset for left/right hand notes
  
  // Process each finger
  for (let i = 0; i < fingerTips.length; i++) {
    const tipIndex = fingerTips[i];
    const fingerIndex = i + handOffset;
    
    // Check if finger is extended by comparing with palm
    const tipY = landmarks[tipIndex].y;
    const palmY = landmarks[0].y;
    
    // A finger is extended if its tip is higher than the palm (lower y value)
    if (tipY < palmY - 0.05) {
      // Finger is extended
      oscillators[fingerIndex].isActive = true;
      
      // Map Y position to pitch (reverse mapping as y increases downward)
      // Use relative position from palm to calculate pitch
      const relativeY = palmY - tipY;
      
      // Map to a range of +/- 1 octave
      const basePitch = noteFrequencies[fingerNotes[fingerIndex]];
      const pitchFactor = 1 + 2 * relativeY; // Map to range of 1x to 3x (one octave up)
      
      // Set new frequency
      oscillators[fingerIndex].oscillator.frequency.setTargetAtTime(
        basePitch * pitchFactor, audioContext.currentTime, 0.1
      );
    }
  }
}

// Update audio based on finger positions
function updateAudio() {
  Object.values(oscillators).forEach(osc => {
    if (osc.isActive) {
      // Gradually increase volume if finger is active
      osc.gain.gain.setTargetAtTime(0.1, audioContext.currentTime, 0.05);
    } else {
      // Gradually decrease volume if finger is not active
      osc.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.05);
    }
  });
}

// Utility functions to draw hand landmarks
function drawConnectors(ctx, landmarks, connections, options) {
  const canvas = ctx.canvas;
  
  for (const connection of connections) {
    const from = landmarks[connection[0]];
    const to = landmarks[connection[1]];
    if (from && to) {
      ctx.beginPath();
      ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
      ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
      ctx.strokeStyle = options.color;
      ctx.lineWidth = options.lineWidth;
      ctx.stroke();
    }
  }
}

function drawLandmarks(ctx, landmarks, options) {
  const canvas = ctx.canvas;
  
  for (const landmark of landmarks) {
    ctx.beginPath();
    ctx.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      options.lineWidth * 2,
      0, 2 * Math.PI
    );
    ctx.fillStyle = options.color;
    ctx.fill();
  }
}

// Define hand connections for drawing
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index finger
  [0, 9], [9, 10], [10, 11], [11, 12], // middle finger
  [0, 13], [13, 14], [14, 15], [15, 16], // ring finger
  [0, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], [5, 9], [9, 13], [13, 17] // palm
];

// Initialize app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded. Ready to start.');
}); 