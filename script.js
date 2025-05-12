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

// Options
const options = {
  soundEnabled: false, // Disable sound
  showHandMarks: false, // Hide hand landmarks
  mirrorVideo: true // Mirror the video
};

// Game variables
let score = 0;
let confettiActive = false;
let confettiParticles = [];
let gameStartTime = 0;

// Basketball basket
const basket = {
  x: 100, // Position will be adjusted based on canvas size
  y: 400,
  width: 120,
  height: 80,
  rimWidth: 100,
  rimThickness: 10,
  netHeight: 60,
  netMeshSize: 10
};

// Ball physics variables
const ball = {
  x: 400,
  y: 300,
  radius: 30,
  velocityX: 1,
  velocityY: 1,
  color: '#FF7043', // Basketball orange
  airFriction: 0.98,
  bounceEfficiency: 0.8,
  maxSpeed: 25,
  gravity: 0.2,
  lastFingerPositions: {}, // Store previous finger positions to calculate velocity
  textureImg: null,    // Will hold the basketball texture
  inBasket: false,     // Track if ball is in basket
  lastScoreTime: 0     // Time of last score
};

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

// Load basketball texture
function loadBasketballTexture() {
  ball.textureImg = new Image();
  ball.textureImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjEwMCIgZmlsbD0iI2U2NzMyMiIvPjxwYXRoIGQ9Ik0xOTYgMTAwYzAgNDguNi0zOS40IDg4LTg4IDg4UzIwIDE0OC42IDIwIDEwMHMzOS40LTg4IDg4LTg4czg4IDM5LjQgODggODh6IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0xMCAxMDBoMTgwTTEwMCAxMHYxODBNMzUgMzVjNDMuNCAxMS45IDg2LjYgMTEuOSAxMzAgMG0tMTMwIDEzMGM0My40LTExLjkgODYuNi0xMS45IDEzMCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMyIvPjwvc3ZnPg==';
}

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
  // Skip audio initialization if sound is disabled
  if (!options.soundEnabled) return;
  
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

// Play bounce sound effect
function playBounceSound() {
  if (!audioContext || !options.soundEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  oscillator.type = 'triangle';
  oscillator.frequency.value = 300 + Math.random() * 200;
  
  gain.gain.value = 0.2;
  
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  
  // Fade out quickly
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
}

// Play score sound
function playScoreSound() {
  if (!audioContext || !options.soundEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.value = 600;
  
  gain.gain.value = 0.3;
  
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  
  // Create ascending tone
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
  
  // Fade out
  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
}

// Start camera and setup processing
async function startCamera() {
  // Initialize if not already
  if (!hands) {
    initMediaPipeHands();
  }
  
  // Load basketball texture
  loadBasketballTexture();
  
  // Initialize audio if sound is enabled
  if (options.soundEnabled) {
    if (!audioContext) {
      initAudio();
    } else if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  }
  
  // Reset game variables
  score = 0;
  gameStartTime = Date.now();
  
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
  
  // Position basket based on canvas size
  basket.x = canvasElement.width - basket.width - 50;
  basket.y = canvasElement.height / 2;
  
  // Reset ball position
  ball.x = canvasElement.width / 4;
  ball.y = canvasElement.height / 4;
  ball.velocityX = 0;
  ball.velocityY = 0;
  ball.inBasket = false;
  
  // Start camera
  try {
    await camera.start();
    webcamRunning = true;
    
    // Start animation loop
    animateBall();
    
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
  
  // Mute all oscillators if sound is enabled
  if (options.soundEnabled && oscillators) {
    Object.values(oscillators).forEach(osc => {
      osc.gain.gain.value = 0;
      osc.isActive = false;
    });
  }
  
  // Update buttons
  startButton.disabled = false;
  stopButton.disabled = true;
  
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Clear confetti
  confettiParticles = [];
  confettiActive = false;
}

// Update ball position and handle collisions
function updateBall() {
  // Apply gravity
  ball.velocityY += ball.gravity;
  
  // Update ball position
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
  
  // Handle wall collisions
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.velocityX = -ball.velocityX * ball.bounceEfficiency;
    if (options.soundEnabled) playBounceSound();
  } else if (ball.x + ball.radius > canvasElement.width) {
    ball.x = canvasElement.width - ball.radius;
    ball.velocityX = -ball.velocityX * ball.bounceEfficiency;
    if (options.soundEnabled) playBounceSound();
  }
  
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.velocityY = -ball.velocityY * ball.bounceEfficiency;
    if (options.soundEnabled) playBounceSound();
  } else if (ball.y + ball.radius > canvasElement.height) {
    ball.y = canvasElement.height - ball.radius;
    ball.velocityY = -ball.velocityY * ball.bounceEfficiency;
    if (options.soundEnabled) playBounceSound();
  }
  
  // Check for basket collision
  checkBasketCollision();
  
  // Apply air friction
  ball.velocityX *= ball.airFriction;
  ball.velocityY *= ball.airFriction;
  
  // Update confetti
  updateConfetti();
}

// Check if the ball collides with the basket
function checkBasketCollision() {
  // Check if ball is above the rim
  const rimLeft = basket.x + (basket.width - basket.rimWidth) / 2;
  const rimRight = rimLeft + basket.rimWidth;
  const rimY = basket.y;
  
  if (ball.y + ball.radius >= rimY && ball.y - ball.radius <= rimY + basket.rimThickness &&
      ball.x + ball.radius >= rimLeft && ball.x - ball.radius <= rimRight) {
    
    // Check if ball is entering the basket from above (downward velocity)
    if (ball.velocityY > 0 && !ball.inBasket) {
      // If the ball is mostly inside the rim horizontally
      if (ball.x > rimLeft + ball.radius/2 && ball.x < rimRight - ball.radius/2) {
        ball.inBasket = true;
      } else {
        // If the ball hits the rim, bounce off
        ball.velocityY = -ball.velocityY * 0.7;
        if (ball.x < rimLeft + ball.radius) ball.velocityX -= 2; // Bounce left
        if (ball.x > rimRight - ball.radius) ball.velocityX += 2; // Bounce right
      }
    }
  }
  
  // Check if ball is below the basket net
  const netBottom = rimY + basket.netHeight;
  if (ball.inBasket && ball.y - ball.radius > netBottom) {
    // Ball has gone through the basket completely
    increaseScore();
    ball.inBasket = false;
  }
}

// Increase score and trigger confetti
function increaseScore() {
  // Don't score too often (prevent multiple scores for same basket)
  const now = Date.now();
  if (now - ball.lastScoreTime < 1500) return;
  
  score++;
  ball.lastScoreTime = now;
  
  // Trigger confetti
  createConfetti();
  
  // Play score sound
  if (options.soundEnabled) playScoreSound();
}

// Create confetti particles
function createConfetti() {
  confettiActive = true;
  
  // Create 100 confetti particles
  for (let i = 0; i < 100; i++) {
    confettiParticles.push({
      x: basket.x + basket.width / 2,
      y: basket.y + basket.netHeight / 2,
      size: 5 + Math.random() * 5,
      color: `hsl(${Math.random() * 360}, 90%, 70%)`,
      velocityX: (Math.random() * 8) - 4,
      velocityY: (Math.random() * -10) - 5,
      gravity: 0.1,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 10) - 5
    });
  }
}

// Update confetti particles
function updateConfetti() {
  if (!confettiActive) return;
  
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const particle = confettiParticles[i];
    
    // Update position
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    
    // Apply gravity
    particle.velocityY += particle.gravity;
    
    // Update rotation
    particle.rotation += particle.rotationSpeed;
    
    // Remove particles that have fallen out of view
    if (particle.y > canvasElement.height) {
      confettiParticles.splice(i, 1);
    }
  }
  
  // Deactivate confetti if no particles left
  if (confettiParticles.length === 0) {
    confettiActive = false;
  }
}

// Draw confetti particles
function drawConfetti() {
  if (!confettiActive) return;
  
  for (const particle of confettiParticles) {
    canvasCtx.save();
    canvasCtx.translate(particle.x, particle.y);
    canvasCtx.rotate(particle.rotation * Math.PI / 180);
    
    canvasCtx.fillStyle = particle.color;
    canvasCtx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    
    canvasCtx.restore();
  }
}

// Draw the basketball
function drawBall() {
  if (ball.textureImg && ball.textureImg.complete) {
    // Draw the basketball with texture
    canvasCtx.save();
    canvasCtx.translate(ball.x, ball.y);
    
    // Rotate ball based on velocity
    const rotation = Math.atan2(ball.velocityY, ball.velocityX);
    canvasCtx.rotate(rotation);
    
    // Draw the basketball image
    canvasCtx.drawImage(
      ball.textureImg, 
      -ball.radius, 
      -ball.radius, 
      ball.radius * 2, 
      ball.radius * 2
    );
    
    canvasCtx.restore();
  } else {
    // Fallback to a simple orange circle if texture isn't loaded
    canvasCtx.beginPath();
    canvasCtx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    canvasCtx.fillStyle = ball.color;
    canvasCtx.fill();
    
    // Add simple lines to make it look like a basketball
    canvasCtx.beginPath();
    canvasCtx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    canvasCtx.strokeStyle = '#000';
    canvasCtx.lineWidth = 1;
    canvasCtx.stroke();
    
    // Horizontal line
    canvasCtx.beginPath();
    canvasCtx.moveTo(ball.x - ball.radius, ball.y);
    canvasCtx.lineTo(ball.x + ball.radius, ball.y);
    canvasCtx.stroke();
    
    // Vertical line
    canvasCtx.beginPath();
    canvasCtx.moveTo(ball.x, ball.y - ball.radius);
    canvasCtx.lineTo(ball.x, ball.y + ball.radius);
    canvasCtx.stroke();
  }
}

// Draw the basket
function drawBasket() {
  const rimLeft = basket.x + (basket.width - basket.rimWidth) / 2;
  const rimTop = basket.y;
  
  // Draw backboard
  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.fillRect(basket.x, basket.y - 100, basket.width, 100);
  
  // Draw backboard border
  canvasCtx.strokeStyle = '#000000';
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(basket.x, basket.y - 100, basket.width, 100);
  
  // Draw rim
  canvasCtx.fillStyle = '#FF5722';
  canvasCtx.fillRect(rimLeft, rimTop, basket.rimWidth, basket.rimThickness);
  
  // Draw rim border
  canvasCtx.strokeStyle = '#000000';
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(rimLeft, rimTop, basket.rimWidth, basket.rimThickness);
  
  // Draw net
  canvasCtx.strokeStyle = '#FFFFFF';
  canvasCtx.lineWidth = 1;
  
  // Draw vertical net lines
  const netSteps = Math.floor(basket.rimWidth / basket.netMeshSize);
  for (let i = 0; i <= netSteps; i++) {
    const x = rimLeft + (i * basket.rimWidth / netSteps);
    canvasCtx.beginPath();
    canvasCtx.moveTo(x, rimTop + basket.rimThickness);
    
    // Curve the net lines slightly
    const midY = rimTop + basket.rimThickness + basket.netHeight / 2;
    const midX = x + (i < netSteps/2 ? -5 : i > netSteps/2 ? 5 : 0);
    
    canvasCtx.quadraticCurveTo(midX, midY, x, rimTop + basket.rimThickness + basket.netHeight);
    canvasCtx.stroke();
  }
  
  // Draw horizontal net lines
  const netVerticalSteps = Math.floor(basket.netHeight / basket.netMeshSize);
  for (let i = 1; i <= netVerticalSteps; i++) {
    const y = rimTop + basket.rimThickness + (i * basket.netHeight / netVerticalSteps);
    const amplitude = 5 * Math.sin(i / netVerticalSteps * Math.PI); // Create a tapering effect
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(rimLeft, y);
    
    // Create a wavy line for the net
    for (let x = rimLeft; x <= rimLeft + basket.rimWidth; x += 5) {
      const wave = amplitude * Math.sin((x - rimLeft) / basket.rimWidth * Math.PI * 2);
      canvasCtx.lineTo(x, y + wave);
    }
    
    canvasCtx.stroke();
  }
}

// Draw score
function drawScore() {
  const timePlayed = Math.floor((Date.now() - gameStartTime) / 1000);
  const minutes = Math.floor(timePlayed / 60);
  const seconds = timePlayed % 60;
  
  canvasCtx.font = '30px Arial';
  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.textAlign = 'left';
  canvasCtx.textBaseline = 'top';
  
  // Draw score
  canvasCtx.fillText(`Score: ${score}`, 20, 20);
  
  // Draw time
  canvasCtx.fillText(`Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, 20, 60);
}

// Animation loop for ball physics
function animateBall() {
  if (!webcamRunning) return;
  
  // Update ball physics
  updateBall();
  
  // Request next frame
  requestAnimationFrame(animateBall);
}

// Process hand landmark results and update audio
function processResults(results) {
  // Clear canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Apply mirror transformation if enabled
  if (options.mirrorVideo) {
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
  }
  
  // Draw the video frame first
  canvasCtx.drawImage(
    results.image, 0, 0, canvasElement.width, canvasElement.height
  );
  
  // Reset canvas transformation
  if (options.mirrorVideo) {
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
  }
  
  // Draw the basket
  drawBasket();
  
  // Draw the ball
  drawBall();
  
  // Draw confetti
  drawConfetti();
  
  // Draw score
  drawScore();
  
  // Reset all oscillators to inactive
  if (options.soundEnabled && oscillators) {
    Object.values(oscillators).forEach(osc => {
      osc.isActive = false;
    });
  }
  
  // Check if hands are detected
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Process each detected hand
    for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
      const landmarks = results.multiHandLandmarks[handIndex];
      const handedness = results.multiHandedness[handIndex];
      const isRightHand = handedness.label === 'Right';
      
      // Draw landmarks if enabled
      if (options.showHandMarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                      {color: isRightHand ? '#00FF00' : '#FF0000', lineWidth: 3});
        drawLandmarks(canvasCtx, landmarks, 
                     {color: isRightHand ? '#00CC00' : '#CC0000', lineWidth: 1});
      }
      
      // Process finger landmarks for audio if sound is enabled
      if (options.soundEnabled) {
        processFingerLandmarks(landmarks, handIndex, isRightHand);
      }
      
      // Need to adjust coordinates for mirrored video
      const adjustedLandmarks = [...landmarks];
      if (options.mirrorVideo) {
        adjustedLandmarks.forEach(mark => {
          mark.x = 1 - mark.x;  // Mirror x-coordinate
        });
      }
      
      // Handle ball collisions with fingertips
      checkFingerBallCollisions(adjustedLandmarks, handIndex);
    }
  }
  
  // Update audio for all oscillators
  if (options.soundEnabled) {
    updateAudio();
  }
  
  canvasCtx.restore();
}

// Check for collisions between fingers and ball
function checkFingerBallCollisions(landmarks, handIndex) {
  const fingerTips = [4, 8, 12, 16, 20]; // Tip landmark indices
  
  for (let i = 0; i < fingerTips.length; i++) {
    const tipIndex = fingerTips[i];
    const fingerKey = `${handIndex}-${tipIndex}`;
    
    // Get finger position in screen coordinates
    const tipX = landmarks[tipIndex].x * canvasElement.width;
    const tipY = landmarks[tipIndex].y * canvasElement.height;
    
    // Calculate distance between finger and ball
    const dx = tipX - ball.x;
    const dy = tipY - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check for collision
    if (distance < ball.radius + 10) {
      // Calculate finger velocity
      let fingerVelocityX = 0;
      let fingerVelocityY = 0;
      
      if (ball.lastFingerPositions[fingerKey]) {
        fingerVelocityX = tipX - ball.lastFingerPositions[fingerKey].x;
        fingerVelocityY = tipY - ball.lastFingerPositions[fingerKey].y;
      }
      
      // Apply impulse to ball based on finger velocity
      if (Math.abs(fingerVelocityX) > 3 || Math.abs(fingerVelocityY) > 3) {
        // Apply stronger impulse with some randomness for more natural feel
        ball.velocityX += fingerVelocityX * 0.8 + (Math.random() * 2 - 1);
        ball.velocityY += fingerVelocityY * 0.8 + (Math.random() * 2 - 1);
        
        // Limit maximum speed
        const speed = Math.sqrt(ball.velocityX * ball.velocityX + ball.velocityY * ball.velocityY);
        if (speed > ball.maxSpeed) {
          const ratio = ball.maxSpeed / speed;
          ball.velocityX *= ratio;
          ball.velocityY *= ratio;
        }
        
        // Play a bounce sound if enabled
        if (options.soundEnabled) playBounceSound();
      }
    }
    
    // Store finger position for next frame
    ball.lastFingerPositions[fingerKey] = {x: tipX, y: tipY};
  }
}

// Process finger landmarks to control audio
function processFingerLandmarks(landmarks, handIndex, isRightHand) {
  // Skip if sound is disabled
  if (!options.soundEnabled) return;
  
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
  if (!options.soundEnabled || !oscillators) return;
  
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