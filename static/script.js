let currentThreshold = 0.5;
let cameraStream = null;

function updateThreshold(value) {
    currentThreshold = value / 100;
    document.getElementById('thresholdValue').textContent = currentThreshold.toFixed(2);
}

function uploadImage() {
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            processImage(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

async function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = cameraStream;
        modal.style.display = 'flex';
    } catch (err) {
        alert('Error accessing camera: ' + err.message);
    }
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
    modal.style.display = 'none';
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg');
    closeCamera();
    processImage(imageData);
}

async function processImage(imageData) {
    const placeholder = document.getElementById('placeholder');
    const loading = document.getElementById('loading');
    const resultImage = document.getElementById('resultImage');
    const detectionsInfo = document.getElementById('detectionsInfo');
    
    placeholder.style.display = 'none';
    resultImage.style.display = 'none';
    detectionsInfo.style.display = 'none';
    loading.style.display = 'block';
    
    try {
        const response = await fetch('/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData,
                threshold: currentThreshold
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultImage.src = result.image;
            resultImage.style.display = 'block';
            
            // Show detections
            if (result.detections.length > 0) {
                displayDetections(result.detections);
            }
        } else {
            alert('Error: ' + result.error);
            placeholder.style.display = 'block';
        }
    } catch (err) {
        alert('Error processing image: ' + err.message);
        placeholder.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function displayDetections(detections) {
    const detectionsInfo = document.getElementById('detectionsInfo');
    const detectionsList = document.getElementById('detectionsList');
    
    detectionsList.innerHTML = '';
    
    detections.forEach((det, idx) => {
        const item = document.createElement('div');
        item.className = 'detection-item';
        item.innerHTML = `
            <span class="detection-class">${det.class}</span> - 
            <span class="detection-confidence">${(det.confidence * 100).toFixed(1)}%</span>
        `;
        detectionsList.appendChild(item);
    });
    
    detectionsInfo.style.display = 'block';
}

// Allow re-processing when threshold changes
document.getElementById('thresholdSlider').addEventListener('change', function() {
    const resultImage = document.getElementById('resultImage');
    if (resultImage.style.display === 'block' && resultImage.src) {
        // Get original image and reprocess
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = function(event) {
                processImage(event.target.result);
            };
            reader.readAsDataURL(fileInput.files[0]);
        }
    }
});
