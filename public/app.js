const jobAd = document.querySelector("#job-ad");
const charCount = document.querySelector("#char-count");
const generateButton = document.querySelector("#generate-button");
const sampleButton = document.querySelector("#sample-button");
const inputError = document.querySelector("#input-error");
const systemBadge = document.querySelector("#system-badge");
const emptyResult = document.querySelector("#empty-result");
const resultContent = document.querySelector("#result-content");
const resultTitle = document.querySelector("#result-title");
const engineLabel = document.querySelector("#engine-label");
const resultRole = document.querySelector("#result-role");
const resultSummary = document.querySelector("#result-summary");
const matchList = document.querySelector("#match-list");
const previewList = document.querySelector("#preview-list");
const downloadButton = document.querySelector("#download-button");
const openButton = document.querySelector("#open-button");
const warningMessage = document.querySelector("#warning-message");

let currentPdfUrl = null;

const SAMPLE_AD = `We are looking for a Computer Vision / Machine Learning Engineer to join our applied AI team. You will develop and deploy vision systems for industrial inspection, work with image data and deep learning models, and collaborate with robotics and automation engineers.

The role includes building data and training pipelines, evaluating model performance, improving inference for real-time applications, integrating cameras and sensors, and validating solutions in laboratory and production-like environments. Experience with Python, PyTorch, OpenCV, ONNX or TensorRT, ROS, and strong software engineering practices is valued.`;

function updateInputState() {
  const length = jobAd.value.length;
  charCount.textContent = `${length.toLocaleString()} character${length === 1 ? "" : "s"}`;
  generateButton.disabled = jobAd.value.trim().length < 40;
  inputError.textContent = "";
}

function setGenerating(isGenerating) {
  generateButton.disabled = isGenerating || jobAd.value.trim().length < 40;
  generateButton.querySelector(".button-label").textContent = isGenerating ? "Building your CV…" : "Generate tailored CV";
  generateButton.querySelector(".button-arrow").textContent = isGenerating ? "·" : "↗";
  document.body.classList.toggle("is-generating", isGenerating);
}

function showError(message) {
  inputError.textContent = message;
  resultTitle.textContent = "Let’s try that again.";
  if (!resultContent.hidden) {
    warningMessage.hidden = false;
    warningMessage.textContent = message;
  }
}

function renderResult(result) {
  emptyResult.hidden = true;
  resultContent.hidden = false;
  resultTitle.textContent = "A focused version, ready to send.";
  engineLabel.textContent = result.engine === "codex" ? "GENERATED WITH LOCAL CODEX" : "EVIDENCE-ONLY LOCAL DRAFT";
  resultRole.textContent = result.cv.headline;
  resultSummary.textContent = result.cv.summary;

  matchList.replaceChildren();
  (result.cv.match_notes || []).slice(0, 4).forEach((note) => {
    const item = document.createElement("div");
    item.className = "match-item";
    const title = document.createElement("strong");
    title.textContent = note.theme;
    const evidence = document.createElement("span");
    evidence.textContent = note.evidence;
    item.append(title, evidence);
    matchList.append(item);
  });

  previewList.replaceChildren();
  (result.cv.experience_bullets || []).slice(0, 4).forEach((bullet) => {
    const item = document.createElement("li");
    item.textContent = bullet;
    previewList.append(item);
  });

  if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
  const binary = atob(result.pdf_base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  currentPdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  downloadButton.href = currentPdfUrl;
  openButton.href = currentPdfUrl;

  if (result.warning) {
    warningMessage.hidden = false;
    warningMessage.textContent = `Note: ${result.warning}`;
  } else {
    warningMessage.hidden = true;
    warningMessage.textContent = "";
  }
}

async function generate() {
  const value = jobAd.value.trim();
  if (value.length < 40) {
    showError("Paste the full job advertisement so the tailoring has enough signal.");
    return;
  }

  setGenerating(true);
  inputError.textContent = "";
  resultTitle.textContent = "Reading the role signal…";
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_ad: value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Generation failed.");
    renderResult(payload);
  } catch (error) {
    showError(error.message || "Generation failed.");
  } finally {
    setGenerating(false);
  }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    if (status.codex.available) {
      systemBadge.textContent = `Codex · ${status.codex.model}`;
      systemBadge.classList.add("ready");
    } else if (status.fallback_enabled) {
      systemBadge.textContent = "Local fallback mode";
      systemBadge.classList.add("fallback");
    } else {
      systemBadge.textContent = "Codex setup needed";
      systemBadge.classList.add("fallback");
    }
  } catch (error) {
    systemBadge.textContent = "Server not connected";
    systemBadge.classList.add("fallback");
  }
}

jobAd.addEventListener("input", updateInputState);
jobAd.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") generate();
});
generateButton.addEventListener("click", generate);
sampleButton.addEventListener("click", () => {
  jobAd.value = SAMPLE_AD;
  updateInputState();
  jobAd.focus();
});

updateInputState();
loadStatus();
