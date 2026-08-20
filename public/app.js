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
const generationProgress = document.querySelector("#generation-progress");
const generationStage = document.querySelector("#generation-stage");
const generationElapsed = document.querySelector("#generation-elapsed");
const sourceFileTabs = document.querySelector("#source-file-tabs");
const sourceFileName = document.querySelector("#source-file-name");
const sourceFileDescription = document.querySelector("#source-file-description");
const sourceFileStatus = document.querySelector("#source-file-status");
const sourceEditor = document.querySelector("#source-editor");
const sourceSaveHint = document.querySelector("#source-save-hint");
const saveSourceButton = document.querySelector("#save-source-button");
const sourceEditorError = document.querySelector("#source-editor-error");

let currentPdfUrl = null;
let generationElapsedTimer = null;
let generationStageTimer = null;
let generationStartedAt = 0;
let sourceFiles = [];
let activeSourceFileId = null;
let sourceEditorDirty = false;
let sourceSaveInFlight = false;

const GENERATION_STAGES = [
  "Reading the role signal…",
  "Checking evidence against your source…",
  "Building the tailored draft…",
  "Rendering your PDF…",
];

const SAMPLE_AD = `We are looking for a Computer Vision / Machine Learning Engineer to join our applied AI team. You will develop and deploy vision systems for industrial inspection, work with image data and deep learning models, and collaborate with robotics and automation engineers.

The role includes building data and training pipelines, evaluating model performance, improving inference for real-time applications, integrating cameras and sensors, and validating solutions in laboratory and production-like environments. Experience with Python, PyTorch, OpenCV, ONNX or TensorRT, ROS, and strong software engineering practices is valued.`;

function updateInputState() {
  const length = jobAd.value.length;
  charCount.textContent = `${length.toLocaleString()} character${length === 1 ? "" : "s"}`;
  generateButton.disabled = jobAd.value.trim().length < 40;
  inputError.textContent = "";
}

function updateGenerationElapsed() {
  const elapsed = Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000));
  generationElapsed.textContent = `${elapsed}s`;
}

function setGenerating(isGenerating) {
  generateButton.disabled = isGenerating || jobAd.value.trim().length < 40;
  generateButton.querySelector(".button-label").textContent = isGenerating ? "Building your CV…" : "Generate tailored CV";
  generateButton.querySelector(".button-arrow").textContent = isGenerating ? "·" : "↗";
  document.body.classList.toggle("is-generating", isGenerating);

  if (isGenerating) {
    generationStartedAt = Date.now();
    generationStage.textContent = GENERATION_STAGES[0];
    generationElapsed.textContent = "0s";
    generationProgress.hidden = false;
    clearInterval(generationElapsedTimer);
    clearInterval(generationStageTimer);
    generationElapsedTimer = setInterval(updateGenerationElapsed, 1_000);
    let stageIndex = 0;
    generationStageTimer = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, GENERATION_STAGES.length - 1);
      generationStage.textContent = GENERATION_STAGES[stageIndex];
      resultTitle.textContent = GENERATION_STAGES[stageIndex];
    }, 4_000);
    return;
  }

  clearInterval(generationElapsedTimer);
  clearInterval(generationStageTimer);
  generationElapsedTimer = null;
  generationStageTimer = null;
  generationProgress.hidden = true;
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
  if (sourceEditorDirty) {
    showError("Save your source changes before generating a CV.");
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

function setSourceStatus(message, state = "") {
  sourceFileStatus.className = "source-file-status";
  if (state) sourceFileStatus.classList.add(state);
  sourceFileStatus.textContent = message;
}

function renderSourceTabs() {
  sourceFileTabs.replaceChildren();
  sourceFiles.forEach((file) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "source-file-tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(file.id === activeSourceFileId));
    if (file.id === activeSourceFileId) button.classList.add("active");

    const label = document.createElement("strong");
    label.textContent = file.label;
    const filename = document.createElement("small");
    filename.textContent = file.filename;
    button.append(label, filename);
    button.addEventListener("click", () => selectSourceFile(file.id));
    sourceFileTabs.append(button);
  });
}

function selectSourceFile(fileId) {
  if (fileId === activeSourceFileId) return;
  if (sourceEditorDirty && !window.confirm("Discard unsaved source changes?")) return;

  const file = sourceFiles.find((item) => item.id === fileId);
  if (!file) return;
  activeSourceFileId = file.id;
  sourceEditorDirty = false;
  sourceEditor.value = file.content;
  sourceEditor.disabled = false;
  sourceFileName.textContent = file.filename;
  sourceFileDescription.textContent = file.description;
  sourceSaveHint.textContent = "Saved files stay on this machine.";
  saveSourceButton.disabled = true;
  setSourceStatus("Saved", "saved");
  sourceEditorError.textContent = "";
  renderSourceTabs();
}

function markSourceDirty() {
  if (!activeSourceFileId || sourceSaveInFlight) return;
  sourceEditorDirty = true;
  saveSourceButton.disabled = false;
  sourceSaveHint.textContent = "Save before generating so the new facts are used.";
  setSourceStatus("Unsaved changes", "dirty");
}

async function saveSourceFile() {
  if (!activeSourceFileId || !sourceEditorDirty || sourceSaveInFlight) return;

  sourceSaveInFlight = true;
  saveSourceButton.disabled = true;
  saveSourceButton.querySelector(".button-label").textContent = "Saving…";
  setSourceStatus("Saving…");
  sourceEditorError.textContent = "";

  try {
    const response = await fetch(`/api/source-files/${encodeURIComponent(activeSourceFileId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sourceEditor.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save the source file.");

    sourceFiles = sourceFiles.map((file) => file.id === payload.id ? payload : file);
    sourceEditorDirty = false;
    sourceSaveHint.textContent = `Saved to ${payload.filename}.`;
    setSourceStatus("Saved", "saved");
  } catch (error) {
    sourceEditorError.textContent = error.message || "Could not save the source file.";
    setSourceStatus("Save failed", "dirty");
  } finally {
    sourceSaveInFlight = false;
    saveSourceButton.querySelector(".button-label").textContent = "Save changes";
    saveSourceButton.disabled = !sourceEditorDirty;
  }
}

async function loadSourceFiles() {
  sourceEditor.disabled = true;
  setSourceStatus("Loading…");
  try {
    const response = await fetch("/api/source-files");
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.files)) throw new Error(payload.error || "Could not load source files.");
    sourceFiles = payload.files;
    activeSourceFileId = null;
    renderSourceTabs();
    if (sourceFiles.length) selectSourceFile(sourceFiles[0].id);
  } catch (error) {
    sourceFileTabs.replaceChildren();
    const message = document.createElement("div");
    message.className = "source-loading";
    message.textContent = "Source files could not be loaded.";
    sourceFileTabs.append(message);
    sourceEditorError.textContent = error.message || "Could not load source files.";
    sourceFileName.textContent = "Source files unavailable";
    sourceFileDescription.textContent = "Restart the local server and refresh this page.";
    setSourceStatus("Unavailable");
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
sourceEditor.addEventListener("input", markSourceDirty);
sourceEditor.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSourceFile();
  }
});
saveSourceButton.addEventListener("click", saveSourceFile);
window.addEventListener("beforeunload", (event) => {
  if (!sourceEditorDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

updateInputState();
loadStatus();
loadSourceFiles();
