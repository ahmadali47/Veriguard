// Global variables
const video = document.getElementById('video');
// const resultsDiv = document.getElementById('results');
// const startBtn = document.getElementById('startBtn');
// const stopBtn = document.getElementById('stopBtn');
let recognitionInterval;
let knownFaceDescriptors = [];
let knownFaceLabels = [];
let nameMap = {}; // Add this at the top with other global variables

const delaytime = 300;

const check_spoof_frame_length = 2;  // 3 frames for spoofing cases
const check_unknown_frame_length = 3; // 6 frames for unknown persons

// if increases the similarity decreases {less accurate} and easy to recognize but may give false positive 
const recognition_threshold = 0.42;
// if decreases the similarity increase {more accurate} and difficult to recognize but may give false negative

// with light 12 value 
// without light 8 value 
const blurValue = 5;
// model Fine Tunning Values 
const thresholdValue = 0.5;   // Higher = stricter detection
const inputSizeValue = 320;   // Larger = more accurate but slower

// scoreThreshold (Default: 0.5)
// This determines the minimum confidence score required for a detection to be considered valid.
// Increase this value (e.g., 0.7) to reduce false positives (but may also reduce true positives).
// inputSize (Default: 224 pixels)
// The size at which the input image is processed. Larger values can improve accuracy but slow down detection.
// Options: 128, 160, 224, 320, 416, 512, 608
// Try increasing (e.g., 320) for better accuracy.




function playBeep(frequency = 800, duration = 200, volume = 1) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';  // Sine wave (smooth beep)
        oscillator.frequency.value = frequency;  // Frequency in Hz (800 = default beep)
        gainNode.gain.value = volume;  // Volume (0 to 1)

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + (duration / 500));  // Duration in seconds
    } catch (e) {
        console.warn("Web Audio API not supported or blocked:", e);
    }
}



// Load models and initialize
async function init() {
    try {

        // fetching logs from the database
        await fetchRecentLogs();

        // Load face-api.js models
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);

        // Load known faces from database
        await loadKnownFaces();

        // Enable/disable buttons based on loaded data
        // startBtn.disabled = knownFaceDescriptors.length === 0;
        // stopBtn.disabled = false;

        if (knownFaceDescriptors.length === 0) {
            // resultsDiv.innerHTML = '<p>Error: No valid face descriptors found in database</p>';
            return;
        }

        // resultsDiv.innerHTML = '<p>Status: Ready. Click "Start" to begin.</p>';
        // startBtn.addEventListener('click', startRecognition);
        // stopBtn.addEventListener('click', stopRecognition);

    } catch (err) {
        console.error('Initialization error:', err);
        // resultsDiv.innerHTML = `<p>Error: ${err.message}</p>`;
    }
}





async function loadKnownFaces() {
    try {
        console.log("Fetching face embeddings...");
        const response = await fetch('http://localhost:5000/api/embeddings', {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const facesData = await response.json();
        console.log("Faces data received:", facesData);

        // Reset arrays
        knownFaceDescriptors = [];
        knownFaceLabels = [];

        // Process each face record
        facesData.forEach(face => {
            nameMap[face.regno] = face.name; // Store the name mapping
            if (!face.regno || !Array.isArray(face.embeddings)) {
                console.warn("Invalid face record:", face);
                return;
            }

            face.embeddings.forEach(embedding => {
                try {
                    // Convert to Float32Array and validate
                    const float32Array = new Float32Array(embedding);
                    if (float32Array.length !== 128) {
                        console.warn("Invalid embedding length:", float32Array.length);
                        return;
                    }

                    knownFaceDescriptors.push(
                        new faceapi.LabeledFaceDescriptors(face.regno, [float32Array])
                    );
                    knownFaceLabels.push(face.regno);
                } catch (e) {
                    console.error("Error processing embedding:", e);
                }
            });
        });

        if (knownFaceDescriptors.length === 0) {
            throw new Error("No valid face descriptors found in database");
        }

        console.log(`Successfully loaded ${knownFaceDescriptors.length} descriptors`);
        console.log("Sample descriptor:", knownFaceDescriptors[0]);

    } catch (err) {
        console.error("Face loading failed:", err);
        // resultsDiv.innerHTML = `<p>Error loading face data: ${err.message}</p> <p>Check console for details</p>`;
        throw err;
    }
}













async function isScreenSpoof(faceCanvas) {
    try {
        const ctx = faceCanvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, faceCanvas.width, faceCanvas.height);

        // Run all detection methods in parallel
        const [screenPatterns, hasPixelGrid, refreshArtifacts] = await Promise.all([
            detectScreenPatterns(imageData),  // Moiré patterns
            checkPixelGrid(imageData),        // Pixel grid detection
            detectRefreshArtifacts(faceCanvas) // Refresh rate artifacts
        ]);

        console.log('Detection Results:', {
            screenPatterns,
            hasPixelGrid,
            refreshArtifacts
        });

        return screenPatterns || hasPixelGrid || refreshArtifacts;
    } catch (err) {
        console.error('Screen detection error:', err);
        return false; // Fail-safe (assume real face)
    }
}

// 1. Moiré Pattern Detection (Improved)
function detectScreenPatterns(imageData) {
    const { data, width, height } = imageData;
    let moireScore = 0;
    const sampleStep = 5; // Check every 5th pixel for performance

    for (let y = 2; y < height - 2; y += sampleStep) {
        for (let x = 2; x < width - 2; x += sampleStep) {
            const i = (y * width + x) * 4;

            // Check high-frequency color variations
            const rightDiff = Math.abs(data[i] - data[i + 4]) +
                Math.abs(data[i + 1] - data[i + 5]) +
                Math.abs(data[i + 2] - data[i + 6]);

            const bottomDiff = Math.abs(data[i] - data[i + width * 4]) +
                Math.abs(data[i + 1] - data[i + width * 4 + 1]) +
                Math.abs(data[i + 2] - data[i + width * 4 + 2]);

            // if (rightDiff > 90 || bottomDiff > 90) { // Adjusted threshold
            if (rightDiff > 115 || bottomDiff > 115) { // Adjusted threshold
                moireScore += 1.2;
            }
        }
    }

    const moireThreshold = (width * height) / (sampleStep * sampleStep * 10);
    return moireScore > moireThreshold;
}


// 2. Pixel Grid Detection (Fixed)
function checkPixelGrid(imageData) {
    const { data, width, height } = imageData;
    const gridSize = 3;
    let gridMatches = 0;

    for (let y = gridSize; y < height - gridSize; y += gridSize) {
        for (let x = gridSize; x < width - gridSize; x += gridSize) {
            const i = (y * width + x) * 4;
            const nextPixel = (y * width + (x + gridSize)) * 4;

            const rDiff = Math.abs(data[i] - data[nextPixel]);
            const gDiff = Math.abs(data[i + 1] - data[nextPixel + 1]);
            const bDiff = Math.abs(data[i + 2] - data[nextPixel + 2]);

            if (rDiff > 40 && gDiff > 40 && bDiff > 40) {
                gridMatches++;
            }
        }
    }

    return gridMatches > (width * height) / (gridSize * gridSize * 3);
}


// 3. Refresh Artifact Detection (Async)
async function detectRefreshArtifacts(canvas) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Capture two frames with delay
    tempCtx.drawImage(canvas, 0, 0);
    const frame1 = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    await new Promise(r => setTimeout(r, 50)); // Wait for screen refresh
    tempCtx.drawImage(canvas, 0, 0);
    const frame2 = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

    // Compare frames
    let changedPixels = 0;
    for (let i = 0; i < frame1.data.length; i += 4) {
        if (Math.abs(frame1.data[i] - frame2.data[i]) > 30) changedPixels++;
    }

    return changedPixels > (canvas.width * canvas.height * 0.2);
}


// with light 12 value 
// without light 8 value 

function isFaceBlurry(imageElement, threshold = blurValue ) { 
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and calculate Laplacian variance
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = data[i + 1] = data[i + 2] = gray;
    }

    // Apply Laplacian operator
    let laplacianSum = 0;
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const center = data[idx];
            const top = data[(idx - canvas.width * 4)];
            const bottom = data[(idx + canvas.width * 4)];
            const left = data[(idx - 4)];
            const right = data[(idx + 4)];

            const laplacian = Math.abs(4 * center - top - bottom - left - right);
            laplacianSum += laplacian;
        }
    }

    const variance = laplacianSum / (canvas.width * canvas.height);
    return variance < threshold;
}



// Updated function to log face to database
async function logFaceToDatabase(logData) {
    try {
        // Send to your backend API
        const response = await fetch('http://localhost:5000/api/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData)
        });

        if (response.ok) {
            playBeep(800, 200, 0.5); // Play an 800Hz beep for 200ms at 50% volume
            fetchRecentLogs();
        }

        if (!response.ok) {
            console.error('Failed to log face:', await response.text());
        }
    } catch (error) {
        console.error('Error logging face:', error);
    }
}




let trackedFaces = []; // Stores face tracking data
let loggedFaces = []; // Stores descriptors of recently logged faces to prevent duplicates

// Start face recognition
async function startRecognition() {
    isRecognizing = true;
    toggleBtn.textContent = "❚❚ Stop";

    // Reset tracking variables
    trackedFaces = [];
    loggedFaces = [];


    if (!video.srcObject) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
        } catch (err) {
            // resultsDiv.innerHTML = `<p>Error accessing webcam: ${err.message}</p>`;
            return;
        }
    }

    // Initialize today's attendance log
    await fetch('http://localhost:5000/api/attendance/initialize', {
        method: 'POST'
    });


    // Clear previous interval
    if (recognitionInterval) clearInterval(recognitionInterval);






















    // this will run for each frame 
    recognitionInterval = setInterval(async () => {
        try {
            // resultsDiv.innerHTML = '';

            if (knownFaceDescriptors.length === 0) {
                throw new Error('No face descriptors available');
            }

            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({
                    scoreThreshold: thresholdValue,  // Higher = stricter detection
                    inputSize: inputSizeValue       // Larger = more accurate but slower
                })
            ).withFaceLandmarks().withFaceDescriptors();

            if (detections.length === 0) {
                // resultsDiv.innerHTML = '<p>No faces detected</p>';
                deletebox();
                trackedFaces = []; // Reset tracking when no faces detected
                return;
            }

            // Create full frame canvas once per detection cycle
            const fullFrameCanvas = document.createElement('canvas');
            fullFrameCanvas.width = video.videoWidth;
            fullFrameCanvas.height = video.videoHeight;
            const fullFrameCtx = fullFrameCanvas.getContext('2d');
            fullFrameCtx.drawImage(video, 0, 0, fullFrameCanvas.width, fullFrameCanvas.height);

            // Process all faces in parallel
            const processedFaces = await Promise.all(detections.map(async (detection) => {
                const box = detection.detection.box;
                const faceCanvas = document.createElement('canvas');
                faceCanvas.width = box.width;
                faceCanvas.height = box.height;
                const ctx = faceCanvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

                const isBlurry = isFaceBlurry(faceCanvas);
                if (isBlurry) return null; // Skip processing if blurry

                const isSpoofed = await isScreenSpoof(faceCanvas);
                const faceMatcher = new faceapi.FaceMatcher(knownFaceDescriptors, recognition_threshold);
                const bestMatch = faceMatcher.findBestMatch(detection.descriptor);



                return {
                    detection,
                    isSpoofed,
                    identity: bestMatch.label,
                    distance: bestMatch.distance,
                    descriptor: detection.descriptor,
                    faceCanvas: faceCanvas,
                    fullFrameCanvas: fullFrameCanvas
                };
            }));








            // Filter out null results (blurry faces)
            const validFaces = processedFaces.filter(face => face !== null);













            for (const face of validFaces) {
                const existingTrack = trackedFaces.find(track =>
                    faceapi.euclideanDistance(track.descriptor, face.descriptor) < recognition_threshold
                );

                if (existingTrack) {
                    existingTrack.count++;
                    existingTrack.lastDescriptor = face.descriptor;
                    existingTrack.lastFaceCanvas = face.faceCanvas;
                    existingTrack.lastFullFrameCanvas = face.fullFrameCanvas;
                    existingTrack.lastIdentity = face.identity;
                    existingTrack.lastSpoofed = face.isSpoofed;
                } else {
                    trackedFaces.push({
                        descriptor: face.descriptor,
                        lastDescriptor: face.descriptor,
                        lastFaceCanvas: face.faceCanvas,
                        lastFullFrameCanvas: face.fullFrameCanvas,
                        lastIdentity: face.identity,
                        lastSpoofed: face.isSpoofed,
                        count: 1
                    });
                }

                // Mark attendance for recognized person
                if (!face.isSpoofed && face.identity !== 'unknown') {
                    try {
                        await fetch('http://localhost:5000/api/attendance/mark', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ regno: face.identity })
                        });
                    } catch (error) {
                        console.error('Error marking attendance:', error);
                    }
                }
            }




            // Check for faces that need to be logged (only valid faces)
            trackedFaces.forEach(track => {
                // Only consider tracks that have valid faces
                if (!track.lastDescriptor) return;

                // Determine required frames based on scenario
                let requiredFrames;
                let shouldLog = false;

                // Case 1: Any spoofing (known or unknown) - 3 frames
                if (track.lastSpoofed) {
                    requiredFrames = check_spoof_frame_length;
                    shouldLog = track.count >= requiredFrames;
                }
                // Case 2: Unknown but not spoofing - 5 frames
                else if (track.lastIdentity === 'unknown') {
                    requiredFrames = check_unknown_frame_length;
                    shouldLog = track.count >= requiredFrames;
                }

                if (shouldLog) {
                    const alreadyLogged = loggedFaces.some(loggedDesc =>
                        faceapi.euclideanDistance(loggedDesc, track.descriptor) < 0.4
                    );

                    if (!alreadyLogged) {
                        let logData = null;

                        // Prepare appropriate log data
                        if (track.lastSpoofed) {
                            logData = {
                                title: 'spoofing',
                                identity: track.lastIdentity === 'unknown' ? 'unknown' : track.lastIdentity,
                                picture: track.lastFullFrameCanvas.toDataURL('image/jpeg'),
                                time: new Date().toISOString()
                            };
                        } else if (track.lastIdentity === 'unknown') {
                            logData = {
                                title: 'unknown',
                                identity: 'unknown',
                                picture: track.lastFaceCanvas.toDataURL('image/jpeg'),
                                time: new Date().toISOString()
                            };
                        }

                        if (logData) {
                            logFaceToDatabase(logData);
                            loggedFaces.push(track.descriptor);

                            setTimeout(() => {
                                loggedFaces = loggedFaces.filter(d =>
                                    !faceapi.euclideanDistance(d, track.descriptor) < 0.4
                                );
                            }, 5 * 60 * 1000);
                        }
                    }
                }
            });

            // Clean up tracks for faces that are no longer detected
            trackedFaces = trackedFaces.filter(track => {
                // Keep tracks that either:
                // 1. Still have matching valid faces in current frame, OR
                // 2. Haven't been matched yet (new tracks)
                return validFaces.some(face =>
                    faceapi.euclideanDistance(track.lastDescriptor, face.descriptor) < 0.4
                ) || !track.lastDescriptor;
                // return processedFaces.some(face =>
                //     faceapi.euclideanDistance(track.lastDescriptor, face.descriptor) < 0.4
                // );
            });

            // Draw boxes (using your existing function)
            // Draw boxes only for valid (non-blurry) faces
            const validDetections = detections.filter((_, i) => processedFaces[i] !== null);
            drawFaceBoxes(validDetections, validFaces);
            // drawFaceBoxes(detections, processedFaces);

        } catch (err) {
            console.error('Recognition error:', err);
            // resultsDiv.innerHTML = `<p>Error: ${err.message}</p>`;
            stopRecognition();
        }
    }, delaytime);






    // resultsDiv.innerHTML = '<p>Status: Recognition started...</p>';
}






async function fetchRecentLogs() {
    try {
        const response = await fetch('http://localhost:5000/api/logsget?limit=10');
        if (!response.ok) throw new Error('Failed to fetch logs');

        const { data } = await response.json();
        displayLogs(data);
    } catch (error) {
        console.error('Error fetching logs:', error);
        document.querySelector('.logs-container').innerHTML =
            '<p class="error">Failed to load logs. Please try again.</p>';
    }
}

function displayLogs(logs) {
    const container = document.querySelector('.logs-container');
    container.innerHTML = '';

    if (logs.length === 0) {
        container.innerHTML = '<p>No logs found</p>';
        return;
    }

    logs.forEach(log => {
        const logElement = document.createElement('div');
        logElement.className = 'log-item';

        logElement.innerHTML = `

            <img src="${log.picture}" alt="Captured image" class="log-image" 
             >

            <div class="log-header">      
                <p class="log-type ${log.title}">${log.title.toUpperCase()}</p>
                <p class="log-identity" >${log.identity}</p>
                <div class="log-time">${new Date(log.time).toLocaleString()}</div>
            </div>

        `;

        container.appendChild(logElement);
    });
}



// Fetch logs when page loads
document.addEventListener('DOMContentLoaded', fetchRecentLogs);







// Helper function for recognition
async function recognizeFace(detection) {
    const faceMatcher = new faceapi.FaceMatcher(knownFaceDescriptors, recognition_threshold);
    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
    return {
        identity: bestMatch.label,
        distance: bestMatch.distance
    };
}






function drawFaceBoxes(detections, results) {
    // Clear previous drawings
    document.querySelectorAll('.face-box, .face-label, .spoof-label, .spoof-alert').forEach(el => el.remove());

    const videoWidth = video.offsetWidth;
    const videoHeight = video.offsetHeight;

    detections.forEach((detection, i) => {
        const box = detection.detection.box;
        const result = results[i]; // Now guaranteed to exist from our changes

        // Determine display properties based on results
        const isSpoofed = result.isSpoofed;
        const isUnknown = result.identity === 'unknown';
        const confidence = (1 - result.distance).toFixed(2);

        // Create face box
        const faceBox = document.createElement('div');
        faceBox.className = 'face-box';
        Object.assign(faceBox.style, {
            position: 'absolute',
            left: `${box.x * videoWidth / video.videoWidth}px`,
            top: `${box.y * videoHeight / video.videoHeight}px`,
            width: `${box.width * videoWidth / video.videoWidth}px`,
            height: `${box.height * videoHeight / video.videoHeight}px`,
            border: isSpoofed ? '3px solid red' :
                isUnknown ? '3px solid orange' : '3px solid rgb(38, 119, 160)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 1000,
            animation: isSpoofed ? 'pulse 0.5s infinite' : 'none'
        });

        // Create main label
        const label = document.createElement('div');
        label.className = 'face-label';
        label.textContent = isSpoofed ? 'SPOOF DETECTED' :
            isUnknown ? 'UNKNOWN PERSON' :
                `${nameMap[result.identity] || result.identity} (${confidence})`;
        Object.assign(label.style, {
            position: 'absolute',
            left: `${box.x * videoWidth / video.videoWidth}px`,
            top: `${(box.y - 25) * videoHeight / video.videoHeight}px`,
            backgroundColor: isSpoofed ? 'red' :
                isUnknown ? 'orange' : 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '2px 5px',
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: isSpoofed ? 'bold' : 'normal',
            zIndex: 1001
        });

        // Create additional spoof warning (if needed)
        if (isSpoofed) {
            const spoofLabel = document.createElement('div');
            spoofLabel.className = 'spoof-label';
            spoofLabel.textContent = '⚠️ SECURITY ALERT';
            Object.assign(spoofLabel.style, {
                position: 'absolute',
                left: `${box.x * videoWidth / video.videoWidth}px`,
                top: `${(box.y + box.height + 5) * videoHeight / video.videoHeight}px`,
                backgroundColor: 'red',
                color: 'white',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1001,
                animation: 'blink 1s infinite'
            });
            document.querySelector('.video-container').appendChild(spoofLabel);
        }

        // Add elements to DOM
        document.querySelector('.video-container').append(faceBox, label);
    });
}








function deletebox() {
    document.querySelectorAll('.face-box, .face-label, .spoof-label, .spoof-alert').forEach(el => el.remove());
}


let isRecognizing = false;
const toggleBtn = document.getElementById("toggleBtn");

toggleBtn.addEventListener("click", () => {
    if (isRecognizing) {
        stopRecognition();
    } else {
        startRecognition();
    }
});

function stopRecognition() {
    isRecognizing = false;
    toggleBtn.textContent = "▶ Start";

    deletebox();

    // Add your recognition stop logic here
    if (recognitionInterval) {
        clearInterval(recognitionInterval);
        recognitionInterval = null;
    }

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    deletebox();
    // resultsDiv.innerHTML = '<p>Status: Recognition stopped</p>';
}






































async function fetchTodayAttendance() {
    try {
        const response = await fetch('http://localhost:5000/api/attendance/today');
        if (!response.ok) throw new Error('Failed to fetch attendance');

        const data = await response.json();
        updateAttendanceUI(data);
    } catch (error) {
        console.error('Error fetching attendance:', error);
    }
}

function updateAttendanceUI(attendanceData) {
    if (!attendanceData || !attendanceData.attend) return;

    const presentCount = attendanceData.attend.filter(p => p.status === 'present').length;
    // const absentCount = attendanceData.attend.length - presentCount;

    // Update stats

    let percent = presentCount / attendanceData.attend.length * 100;
    percent = Math.round(percent);

    function setProgress(percent) {
        const circle = document.querySelector('.circle');
        const text = document.querySelector('.percentage');

        // Ensure the percent stays between 0 and 100
        percent = Math.max(0, Math.min(percent, 100));

        // Set stroke-dasharray
        circle.setAttribute('stroke-dasharray', `${percent}, 100`);

        // Update the text inside the circle
        text.textContent = `${percent}%`;
    }

    // Example:
    setProgress(percent);






    // Update list (optional)
    const listContainer = document.querySelector('.attendance-list');
    listContainer.innerHTML = '';

    attendanceData.attend.forEach(person => {
        const personElement = document.createElement('div');
        personElement.className = `attendance-item ${person.status}`;
        personElement.innerHTML = `
            <span class="regno">${person.regno}</span>
            <span class="name">${person.name}</span>
            <span id="stat" class="status">${person.status.toUpperCase()}</span>
        `;
        listContainer.appendChild(personElement);
    });
}

// Call this periodically to update attendance display
setInterval(fetchTodayAttendance, 10000); // Update every 10 seconds
fetchTodayAttendance(); // Initial fetch


































// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);