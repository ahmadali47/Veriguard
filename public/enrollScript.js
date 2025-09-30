
let collectedEmbeddings = [];

// the number of pictures it will take for face enrollment 
const imgDataSize = 15;
// const imgDataSize = 3;
//  for nose position calculation this is distance between new nose position 
const nosieDist = 10;
// delay time for capturing frames from the video element 
const delaytime = 100;
// to check similarity between images during enrollment       if 0.90 means more difficult to enroll     0.99 means easy to enroll 
const similar = 0.99;

// with light 12 value 
// without light 8 value 
const blurValue = 7;


// model Fine Tunning Values 
const thresholdValue = 0.5;   // Higher = stricter detection
const inputSizeValue = 320;   // Larger = more accurate but slower

const thresholdValuefirst = 0.1;   // Higher = stricter detection
const inputSizeValuefirst = 320;   // Larger = more accurate but slower

// scoreThreshold (Default: 0.5)
// This determines the minimum confidence score required for a detection to be considered valid.
// Increase this value (e.g., 0.7) to reduce false positives (but may also reduce true positives).
// inputSize (Default: 224 pixels)
// The size at which the input image is processed. Larger values can improve accuracy but slow down detection.
// Options: 128, 160, 224, 320, 416, 512, 608
// Try increasing (e.g., 320) for better accuracy.








// with light 12 value 
// without light 8 value 

function isImageBlurry(imageElement, threshold = blurValue) {
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








async function startCamera() {
    const video = document.getElementById('video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Unable to access the camera. Please ensure permissions are granted.");
    }
}

function resetCapture() {
    collectedEmbeddings = [];
    document.getElementById('status').innerText = "Ready to capture.";
    console.log("Capture state reset.");
}

async function loadModels() {
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models')
    ]);
    console.log("All models loaded.");
}

async function enrollPerson(regno, name, picture) {

    const personData = {
        pic: picture,
        name: name,
        regno: regno,
        embeddings: collectedEmbeddings.map(item => item.embedding) // Store all embeddings
    };

    try {
        const response = await fetch('http://127.0.0.1:5000/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personData)
        });
        console.log(personData);

        if (response.ok) {
            const result = await response.json(); // Parse the response JSON
            console.log("Face enrolled successfully!");
            document.getElementById('status').innerText = result.message;
            // collectedEmbeddings = []; // Reset for next user
            resetCapture(); // Reset for next user
        } else {
            console.error("Error enrolling face:", await response.text());
            resetCapture(); // Reset for next user
        }
    } catch (error) {
        console.error("Network error:", error);
    }
}



// Function to calculate cosine similarity between two embeddings
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to calculate distance between two points
function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1._x - p2._x, 2) + Math.pow(p1._y - p2._y, 2));
}



let firstTake; // This will store the canvas

async function coverPhoto() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    firstTake = canvas; // Store the canvas element, not the context

    const imgCanvas = document.querySelector(".imgcanvas");
    imgCanvas.style.display = "inline";

    // Show the image inside the .imgcanvas div
    // Convert the `firstTake` (HTMLVideoElement or Canvas) to a data URL
    const imageDataUrl = firstTake.toDataURL("image/png");

    // Set it inside the div
    imgCanvas.innerHTML = `<img src="${imageDataUrl}" style="max-width:100%; border:1px solid grey; border-radius: .5rem; "/>`;
}



let isCapturing = false;

async function captureFace() {

    if (
        !faceapi.nets.tinyFaceDetector.isLoaded ||
        !faceapi.nets.faceLandmark68Net.isLoaded ||
        !faceapi.nets.faceRecognitionNet.isLoaded
    ) {
        console.error("Face API models are still loading. Please wait.");
        return;
    }

    if (isCapturing) return;

    const video = document.getElementById('video');


    let isBlur = true;
    let faceCanvas = document.createElement('canvas');

    // while (isBlur) {


    //     // // 1. take the first image and then process the captured image with faceapi
    //     // const firstpic = await faceapi.detectAllFaces(firstTake, new faceapi.TinyFaceDetectorOptions({
    //     //     scoreThreshold: thresholdValuefirst,  // Higher = stricter detection
    //     //     inputSize: inputSizeValuefirst        // Larger = more accurate but slower
    //     // })).withFaceLandmarks();

    const firstpic = await faceapi.detectAllFaces(firstTake, new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: thresholdValuefirst,
        inputSize: inputSizeValuefirst
    })).withFaceLandmarks();

    if (firstpic.length === 0) {
        document.getElementById('status').innerText = "No Cover Image Found";
        return;
    }

    const box = firstpic[0].detection.box;
    faceCanvas.width = box.width;
    faceCanvas.height = box.height;

    const ctx = faceCanvas.getContext('2d');
    ctx.drawImage(
        firstTake,  // canvas or video
        box.x, box.y, box.width, box.height,
        0, 0, box.width, box.height
    );

    const picture = faceCanvas.toDataURL('image/jpeg', 0.99);  // Cover photo





    const name = document.getElementById('name').value.trim();
    const regNumber = document.getElementById('regNumber').value.trim();

    if (!name) return alert('Please Enter Name');
    if (!regNumber) return alert('Please enter a Reg.No');

    isCapturing = true; // Set capturing flag to true
    document.getElementById('status').innerText = "Capturing images...";


    while (collectedEmbeddings.length < imgDataSize) {

        // Detect face with landmarks and descriptor
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
            scoreThreshold: thresholdValue,  // Higher = stricter detection
            inputSize: inputSizeValue       // Larger = more accurate but slower
        }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.log("No face detected. Trying again...");
            await new Promise(resolve => setTimeout(resolve, delaytime));
            continue;
        }


        const box = detection.detection.box;
        faceCanvas.width = box.width;
        faceCanvas.height = box.height;
        const ctx = faceCanvas.getContext('2d');

        // Draw just the face region
        ctx.drawImage(
            video,
            box.x, box.y, box.width, box.height, // source rectangle
            0, 0, box.width, box.height          // destination rectangle
        );

        let stat = (collectedEmbeddings.length / imgDataSize) * 100;
        stat = Math.round(stat);

        // Check if image is blurry
        const img = new Image();
        img.src = faceCanvas.toDataURL('image/jpeg', 0.99);
        await new Promise(resolve => { img.onload = resolve; });

        if (isImageBlurry(img)) {
            console.log('Blurry image !!! ');
            document.getElementById('status').innerHTML = `<span> ${stat}% complete. </span> Image is too blurry!`;
            // return;
            continue;
        }


        const newEmbedding = Array.from(detection.descriptor);
        const nose = detection.landmarks.getNose(); // Get nose position


        // Check if face position is different from last captured image
        if (collectedEmbeddings.length > 0) {
            const lastNose = collectedEmbeddings[collectedEmbeddings.length - 1].nose;
            const noseDistance = distance(nose[0], lastNose[0]);

            if (noseDistance < nosieDist) {
                // Ensure the person moves slightly before capturing
                console.log("Face position too similar, move your head slightly.");
                await new Promise(resolve => setTimeout(resolve, delaytime));
                continue;
            }

        }


        let isUnique = true; // Flag to track if the new embedding is unique

        for (let prevEmbedding of collectedEmbeddings) {
            const similarity = cosineSimilarity(newEmbedding, prevEmbedding.embedding);
            if (similarity > similar) {
                console.log("Duplicate image detected, take another.");
                isUnique = false; // Mark as duplicate
                break; // Exit the loop early since a duplicate is found
            }
        }

        if (isUnique) {
            // If the embedding is unique, store it
            collectedEmbeddings.push({ embedding: newEmbedding, nose });
            console.log(`Captured Image ${collectedEmbeddings.length}/${imgDataSize}`);
            document.getElementById('status').innerText = `Captured ${collectedEmbeddings.length}/${imgDataSize} images.`;
        } else {
            // If the embedding is a duplicate, skip storing it
            console.log("Skipping duplicate image.");
        }



        console.log(`Captured Image ${collectedEmbeddings.length}/${imgDataSize}`);

        document.getElementById('status').innerHTML = `<span> ${stat}% complete. </span> Move your head slightly.`;

        await new Promise(resolve => setTimeout(resolve, delaytime));
    }

    // If we have 10 images, proceed with enrollment
    console.log(`Collected ${imgDataSize} images, sending to database...`);
    await enrollPerson(regNumber, name, picture);

    // Reset capturing state
    isCapturing = false;
    document.getElementById('status').innerHTML = "Face enrolled successfully!";

}








// Function to check if regno already exists
async function checkRegNoExists(regno) {
    try {
        // Replace this with your actual API call to check regno
        const response = await fetch('http://127.0.0.1:5000/api/check-regno', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ regno: regno })
        });

        const data = await response.json();
        return data.exists; // Your API should return {exists: true/false}
    } catch (error) {
        console.error('Error checking regno:', error);
        return false; // or handle error as you prefer
    }
}

// Modified click handler for the capture button
async function helper() {

    const name = document.getElementById('name').value.trim();
    const regno = document.getElementById('regNumber').value.trim();

    if (!name) return alert('Please Enter Name');
    if (!regno) return alert('Please enter a Reg.No');

    if (!regno) {
        alert('Please enter a Reg.No');
        return;
    }

    // First check if regno exists
    const regnoExists = await checkRegNoExists(regno);

    if (regnoExists) {
        alert('User already exists!');
        return;
    }
    // If regno doesn't exist, proceed with face capture
    captureFace();
}


















window.onload = async () => {
    await loadModels();
    await startCamera();
};
