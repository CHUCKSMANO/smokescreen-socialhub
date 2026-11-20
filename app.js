const video = document.querySelector("#source");
const canvas = document.querySelector("#preview");
const ctx = canvas.getContext("2d");
const guide = document.querySelector("#faceGuide");
const stageEmpty = document.querySelector("#stageEmpty");
const stageTag = document.querySelector("#stageTag");
const modeGrid = document.querySelector("#modeGrid");
const modeSummary = document.querySelector("#modeSummary");
const qualityInput = document.querySelector("#quality");
const qualityValue = document.querySelector("#qualityValue");
const areaInput = document.querySelector("#area");
const areaValue = document.querySelector("#areaValue");
const mirrorInput = document.querySelector("#mirror");
const referenceInput = document.querySelector("#reference");
const enableButton = document.querySelector("#enableCamera");
const stopButton = document.querySelector("#stopCamera");
const recordButton = document.querySelector("#record");
const snapshotButton = document.querySelector("#snapshot");
const cameraStatus = document.querySelector("#cameraStatus");
const recordStatus = document.querySelector("#recordStatus");
const serviceGrid = document.querySelector("#serviceGrid");

const modes = [
  { id: "passthrough", title: "Passthrough", kind: "none", summary: "Unmodified camera, mirrored if you ask." },
  { id: "faceBlur", title: "Face blur", kind: "faceBlur", summary: "Soft blur over the selected face area. Manual region in the browser build." },
  { id: "pixelate", title: "Pixelate", kind: "pixelate", summary: "Mosaic over the selected face area. Manual region in the browser build." },
  { id: "hideMe", title: "Hide me", kind: "hideMe", summary: "Dark veil over the selected face area." },
  { id: "hideBackground", title: "Hide background", kind: "hideBackground", summary: "Approximate person area stays sharp; the rest of the frame blurs." },
  { id: "styleNoir", title: "Noir", kind: "filter", filter: "grayscale(1) contrast(1.4)", summary: "Full-frame black and white." },
  { id: "styleComic", title: "Comic", kind: "filter", filter: "grayscale(1) contrast(2.3) brightness(1.08)", summary: "Full-frame comic-style contrast." },
  { id: "styleSepia", title: "Warm film", kind: "filter", filter: "sepia(0.8) contrast(0.92) brightness(1.06)", summary: "Full-frame warm, faded film look." },
  { id: "styleVibrant", title: "Vivid", kind: "filter", filter: "saturate(1.75) contrast(1.2)", summary: "Full-frame lifted saturation and contrast." },
  { id: "faceMap", title: "Face map", kind: "faceMap", summary: "Reference image composited onto the selected face area." },
];

const services = [
  { name: "WhatsApp", key: "⌘1", url: "https://web.whatsapp.com", color: "#25D366", monogram: "W", description: "End-to-end encrypted chats, voice, and video via WhatsApp Web." },
  { name: "Instagram", key: "⌘2", url: "https://www.instagram.com", color: "#E1306C", monogram: "I", description: "Photos, reels, stories, direct messages, and creator profiles." },
  { name: "Signal", key: "⌘3", url: "https://signal.org/download/", color: "#2C6BED", monogram: "S", note: "Desktop app required", description: "Encrypted messaging through the official desktop app. No web client by design." },
  { name: "Google Chat", key: "⌘4", url: "https://chat.google.com", color: "#1A73E8", monogram: "G", description: "Team messaging, spaces, and video calls for Workspace accounts." },
  { name: "Facebook", key: "⌘5", url: "https://www.facebook.com", color: "#1877F2", monogram: "F", description: "Communities, groups, events, and marketplace." },
];

const qualities = [
  { name: "Fast", fps: 15 },
  { name: "Balanced", fps: 24 },
  { name: "Crisp", fps: 30 },
];

let activeMode = modes[0];
let stream = null;
let frameRequest = 0;
let lastDraw = 0;
let faceRect = { x: 0.39, y: 0.2, w: 0.22 };
let reference = null;
let recorder = null;
let recordedChunks = [];
let drag = null;

const scratch = document.createElement("canvas");
const scratchCtx = scratch.getContext("2d");

function heightFor(width) {
  return Math.min(0.7, width * (canvas.width / canvas.height) * 1.25);
}

function usesFaceArea(mode) {
  return ["faceBlur", "pixelate", "hideMe", "hideBackground", "faceMap"].includes(mode.kind);
}

function renderModes() {
  modeGrid.innerHTML = "";
  for (const mode of modes) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode.title;
    button.dataset.mode = mode.id;
    button.classList.toggle("active", mode.id === activeMode.id);
    button.addEventListener("click", () => setMode(mode));
    modeGrid.append(button);
  }
  modeSummary.textContent = activeMode.summary;
}

function setMode(mode) {
  activeMode = mode;
  modeSummary.textContent = mode.summary;
  for (const button of modeGrid.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.mode === mode.id);
  }
  stageTag.textContent = `IDENTITY · ${mode.title.toUpperCase()}`;
  guide.hidden = !usesFaceArea(mode);
}

function updateGuide() {
  const height = heightFor(faceRect.w);
  guide.style.left = `${faceRect.x * 100}%`;
  guide.style.top = `${faceRect.y * 100}%`;
  guide.style.width = `${faceRect.w * 100}%`;
  guide.style.height = `${height * 100}%`;
}

function renderServices() {
  for (const service of services) {
    const card = document.createElement("a");
    card.className = "service-card";
    card.href = service.url;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.style.setProperty("--service", service.color);
    card.innerHTML = `
      <div class="service-card-head">
        <span class="service-icon">${service.monogram}</span>
        <span class="service-key">${service.key}</span>
      </div>
      <h3>${service.name}</h3>
      <p>${service.description}</p>
      <span class="service-open">${service.note || "Open service"} →</span>
    `;
    serviceGrid.append(card);
  }
}

function ellipsePath(context, x, y, width, height) {
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width * 0.48, height * 0.48, 0, 0, Math.PI * 2);
}

function applyRegion(x, y, width, height) {
  const kind = activeMode.kind;
  if (kind === "none" || kind.startsWith("filter")) return;
  if (kind === "hideBackground") {
    ctx.filter = "blur(18px) brightness(0.75)";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width * 0.62, height * 0.62, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return;
  }

  scratch.width = Math.max(1, Math.ceil(width));
  scratch.height = Math.max(1, Math.ceil(height));
  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.drawImage(canvas, x, y, width, height, 0, 0, scratch.width, scratch.height);

  ctx.save();
  ellipsePath(ctx, x, y, width, height);
  ctx.clip();

  if (kind === "faceBlur") {
    ctx.filter = "blur(16px)";
    ctx.drawImage(scratch, x, y, width, height);
  } else if (kind === "pixelate") {
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.floor(width / 14));
    small.height = Math.max(1, Math.floor(height / 14));
    const smallCtx = small.getContext("2d");
    smallCtx.imageSmoothingEnabled = true;
    smallCtx.drawImage(scratch, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, x, y, width, height);
  } else if (kind === "hideMe") {
    ctx.fillStyle = "rgba(9, 7, 18, 0.94)";
    ctx.fillRect(x, y, width, height);
  } else if (kind === "faceMap" && reference) {
    ctx.drawImage(reference, x, y, width, height);
  }
  ctx.restore();
}

function draw(now) {
  frameRequest = requestAnimationFrame(draw);
  if (!stream || video.readyState < 2) return;
  const fps = qualities[Number(qualityInput.value)].fps;
  if (now - lastDraw < 1000 / fps) return;
  lastDraw = now;

  const width = canvas.width;
  const height = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (mirrorInput.checked) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  const regionHeight = heightFor(faceRect.w) * height;
  const regionWidth = faceRect.w * width;
  const regionX = faceRect.x * width;
  const regionY = faceRect.y * height;

  if (activeMode.kind !== "hideBackground") {
    ctx.filter = activeMode.filter || "none";
    ctx.drawImage(video, 0, 0, width, height);
    ctx.filter = "none";
  }
  applyRegion(regionX, regionY, regionWidth, regionHeight);
  ctx.restore();
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "Camera API unavailable in this browser";
    return;
  }
  cameraStatus.textContent = "Requesting camera access…";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    stageEmpty.hidden = true;
    enableButton.disabled = true;
    stopButton.disabled = false;
    recordButton.disabled = false;
    snapshotButton.disabled = false;
    cameraStatus.textContent = `Live · ${stream.getVideoTracks()[0].label || "camera"}`;
    frameRequest = requestAnimationFrame(draw);
  } catch (error) {
    cameraStatus.textContent = `Camera unavailable · ${error.name || "permission denied"}`;
  }
}

function stopCamera() {
  cancelAnimationFrame(frameRequest);
  stopRecording();
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stageEmpty.hidden = false;
  enableButton.disabled = false;
  stopButton.disabled = true;
  recordButton.disabled = true;
  snapshotButton.disabled = true;
  cameraStatus.textContent = "Camera off";
  stageTag.textContent = "IDENTITY · OFF";
}

function startRecording() {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    recordStatus.textContent = "Recording unsupported in this browser";
    return;
  }
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    recordStatus.textContent = "No supported recording format";
    return;
  }
  recordedChunks = [];
  recorder = new MediaRecorder(canvas.captureStream(30), { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "smokescreen-live-identity.webm";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    recordStatus.textContent = `Saved · ${Math.round(blob.size / 1024)} KB`;
  };
  recorder.start();
  recordButton.textContent = "Stop recording";
  recordStatus.textContent = "Recording…";
}

function stopRecording() {
  if (!recorder || recorder.state === "inactive") return;
  recorder.stop();
  recorder = null;
  recordButton.textContent = "Record";
}

function downloadSnapshot() {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "smokescreen-snapshot.png";
  link.click();
  recordStatus.textContent = "Snapshot saved";
}

guide.addEventListener("pointerdown", (event) => {
  drag = { x: event.clientX, y: event.clientY, originX: faceRect.x, originY: faceRect.y };
  guide.setPointerCapture(event.pointerId);
});
guide.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const rect = guide.parentElement.getBoundingClientRect();
  faceRect.x = Math.max(0, Math.min(1 - faceRect.w, drag.originX + (event.clientX - drag.x) / rect.width));
  const maxY = 1 - heightFor(faceRect.w);
  faceRect.y = Math.max(0, Math.min(maxY, drag.originY + (event.clientY - drag.y) / rect.height));
  updateGuide();
});
guide.addEventListener("pointerup", () => { drag = null; });
guide.addEventListener("pointercancel", () => { drag = null; });

enableButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
recordButton.addEventListener("click", () => (recorder ? stopRecording() : startRecording()));
snapshotButton.addEventListener("click", downloadSnapshot);

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualities[Number(qualityInput.value)].name} · ${qualities[Number(qualityInput.value)].fps} fps`;
});
areaInput.addEventListener("input", () => {
  faceRect.w = Number(areaInput.value) / 100;
  faceRect.y = Math.min(faceRect.y, 1 - heightFor(faceRect.w));
  areaValue.textContent = `${areaInput.value}%`;
  updateGuide();
});
referenceInput.addEventListener("change", () => {
  const file = referenceInput.files?.[0];
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    reference = image;
    modeSummary.textContent = `${activeMode.summary} Reference loaded.`;
  };
  image.src = URL.createObjectURL(file);
});

window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || !/^[1-5]$/.test(event.key)) return;
  event.preventDefault();
  window.open(services[Number(event.key) - 1].url, "_blank", "noreferrer");
});

window.addEventListener("beforeunload", () => {
  stream?.getTracks().forEach((track) => track.stop());
});

renderModes();
renderServices();
setMode(modes[0]);
updateGuide();
