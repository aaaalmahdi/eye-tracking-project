let video;
let model;
const pointer = document.getElementById('pointer');
const selectSound = document.getElementById('select-sound');
let speed = 10;
let accuracy = 100; // Increased sampling rate for better accuracy
let eyeClosedDuration = 0;
const eyeClosedThreshold = 1; // Decreased threshold for quicker selection
let lastFrameTime = performance.now();
let frameCount = 0;

document.getElementById('speed').addEventListener('input', (event) => {
    speed = event.target.value;
});

document.getElementById('accuracy').addEventListener('input', (event) => {
    accuracy = event.target.value;
});

document.getElementById('add-card-btn').addEventListener('click', () => {
    const newText = document.getElementById('add-card-text').value;
    if (newText) {
        addCard(newText);
        document.getElementById('add-card-text').value = ''; // Clear the input field
    }
});

document.getElementById('alignment').addEventListener('change', (event) => {
    const cardContainer = document.getElementById('card-container');
    if (event.target.value === 'vertical') {
        cardContainer.style.flexDirection = 'column';
    } else {
        cardContainer.style.flexDirection = 'row';
    }
});

document.getElementById('spacing').addEventListener('input', (event) => {
    const cardContainer = document.getElementById('card-container');
    cardContainer.style.gap = `${event.target.value}px`;
});

function addCard(text) {
    const cardContainer = document.getElementById('card-container');
    const newCard = document.createElement('div');
    newCard.className = 'card';
    newCard.innerHTML = text + '<button class="delete-btn" onclick="deleteCard(event, this)">X</button>';
    newCard.onclick = function() { editCardText(this); };
    cardContainer.appendChild(newCard);
}

function deleteCard(event, button) {
    event.stopPropagation();
    button.parentElement.remove();
}

async function setupCamera() {
    video = document.createElement('video');
    video.width = 640;
    video.height = 480;
    video.style.transform = "scaleX(-1)"; // Mirror the video feed
    video.style.display = "none"; // Hide the video element
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

async function loadModel() {
    model = await facemesh.load();
}

function updateFPS() {
    const now = performance.now();
    frameCount++;
    const elapsed = now - lastFrameTime;

    if (elapsed >= 1000) {
        const fps = (frameCount / elapsed) * 1000;
        document.getElementById('fps-counter').innerText = `FPS: ${Math.round(fps)}`;
        frameCount = 0;
        lastFrameTime = now;
    }
}

async function trackFace() {
    const predictions = await model.estimateFaces(video, false);

    if (predictions.length > 0) {
        const keypoints = predictions[0].scaledMesh;

        // Calculate the average position of the eyes
        const leftEye = keypoints[33];
        const rightEye = keypoints[263];

        // Calculate the distances between the key points around the eyes
        const leftEyeClosed = calculateEyeClosure(keypoints, [159, 145, 133, 153]); // Adjust these indices as needed
        const rightEyeClosed = calculateEyeClosure(keypoints, [386, 374, 362, 382]); // Adjust these indices as needed

        // Check if both eyes are closed
        if (leftEyeClosed && rightEyeClosed) {
            eyeClosedDuration++;
        } else {
            eyeClosedDuration = 0;
        }

        if (eyeClosedDuration > eyeClosedThreshold) {
            selectCardUnderPointer();
            eyeClosedDuration = 0;
        }

        // Flip the eye coordinates horizontally
        const eyeX = video.width - (leftEye[0] + rightEye[0]) / 2;
        const eyeY = (leftEye[1] + rightEye[1]) / 2;

        // Smooth the pointer movement
        const currentX = parseFloat(pointer.style.left || 0);
        const currentY = parseFloat(pointer.style.top || 0);
        const newX = (eyeX / video.width) * window.innerWidth;
        const newY = (eyeY / video.height) * window.innerHeight;

        pointer.style.left = `${currentX + (newX - currentX) / speed}px`;
        pointer.style.top = `${currentY + (newY - currentY) / speed}px`;

        // Move the mouse cursor to the eye position
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: newX,
            clientY: newY
        });
        document.dispatchEvent(mouseEvent);
    }

    updateFPS();
    setTimeout(trackFace, 1000 / accuracy); // Adjust tracking speed based on accuracy
}

function calculateEyeClosure(keypoints, indices) {
    const distances = indices.map((index, i) => {
        if (i % 2 === 0) {
            return Math.sqrt(
                Math.pow(keypoints[index][0] - keypoints[indices[i + 1]][0], 2) +
                Math.pow(keypoints[index][1] - keypoints[indices[i + 1]][1], 2)
            );
        }
        return 0;
    }).filter(dist => dist !== 0);

    const averageDistance = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    return averageDistance < 5; // Adjust the threshold value as needed
}

function selectCardUnderPointer() {
    const pointerRect = pointer.getBoundingClientRect();
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (pointerRect.left >= rect.left && pointerRect.right <= rect.right &&
            pointerRect.top >= rect.top && pointerRect.bottom <= rect.bottom) {
            card.classList.add('selected');
            showNotification(`تم اختيار البطاقة: ${card.innerText}`);
            playSelectSound();
        } else {
            card.classList.remove('selected');
        }
    });
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.innerText = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

function playSelectSound() {
    selectSound.play();
}

async function main() {
    await setupCamera();
    await loadModel();
    video.play();
    trackFace();
}

main();

document.addEventListener('mousemove', (event) => {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
});

function editCardText(card) {
    const currentText = card.firstChild.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'edit-input';
    card.innerHTML = '';
    card.appendChild(input);
    input.focus();
    input.addEventListener('blur', () => {
        card.innerHTML = input.value + '<button class="delete-btn" onclick="deleteCard(event, this)">X</button>';
        card.onclick = function() { editCardText(this); };
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
}
