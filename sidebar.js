const entriesRoot = document.getElementById("entries");
const globalToggleButton = document.getElementById("global-toggle-btn");
const globalToggleStatus = document.getElementById("global-toggle-status");
const customEntryNameInput = document.getElementById("custom-entry-name");
const customImageFileInput = document.getElementById("custom-image-file");
const customSoundFileInput = document.getElementById("custom-sound-file");
const customUploadButton = document.getElementById("custom-upload-btn");
const customUploadStatus = document.getElementById("custom-upload-status");

function getEnabledMap() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ enabledEntries: {} }, (result) => {
      resolve(result.enabledEntries || {});
    });
  });
}

function setEnabledMap(enabledEntries) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ enabledEntries }, () => resolve());
  });
}

function getGlobalEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ celebrationEnabled: true }, (result) => {
      resolve(result.celebrationEnabled !== false);
    });
  });
}

function setGlobalEnabled(enabled) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ celebrationEnabled: enabled }, () => resolve());
  });
}

function getCustomEntries() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ customEntries: {} }, (result) => {
      resolve(result.customEntries || {});
    });
  });
}

function setCustomEntries(customEntries) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ customEntries }, () => resolve());
  });
}

function setUploadStatus(message) {
  customUploadStatus.textContent = message;
}

function deriveBasename(fileName) {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

function normalizeEntryName(rawName) {
  return rawName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function loadLibraryEntries() {
  const response = await fetch(chrome.runtime.getURL("assets/library.json"), { cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const payload = await response.json();
  if (!Array.isArray(payload.entries)) {
    return [];
  }
  return payload.entries.filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim());
}

function createEntryRow(entryName, checked, isCustom, onToggle, onDelete) {
  const row = document.createElement("div");
  row.className = "entry";

  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", () => onToggle(checkbox.checked));

  const name = document.createElement("span");
  name.className = "entry-name";
  name.textContent = entryName;

  const meta = document.createElement("span");
  meta.className = "entry-meta";
  meta.textContent = isCustom ? "custom" : "built-in";

  label.appendChild(checkbox);
  label.appendChild(name);
  label.appendChild(meta);
  row.appendChild(label);

  if (isCustom) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", onDelete);
    row.appendChild(deleteButton);
  }
  return row;
}

function renderGlobalToggle(enabled) {
  globalToggleButton.textContent = enabled ? "Disable celebrations" : "Enable celebrations";
  globalToggleStatus.textContent = enabled ? "Currently enabled" : "Currently disabled";
}

async function render() {
  const [libraryEntries, customEntries, enabledMap, globalEnabled] = await Promise.all([
    loadLibraryEntries(),
    getCustomEntries(),
    getEnabledMap(),
    getGlobalEnabled()
  ]);

  renderGlobalToggle(globalEnabled);
  entriesRoot.textContent = "";

  const allEntryNames = Array.from(new Set([...libraryEntries, ...Object.keys(customEntries)])).sort((a, b) =>
    a.localeCompare(b)
  );

  if (allEntryNames.length === 0) {
    entriesRoot.textContent = "No built-in or custom entries are available.";
    return;
  }

  for (const entryName of allEntryNames) {
    const checked = enabledMap[entryName] !== false;
    const isCustom = Object.prototype.hasOwnProperty.call(customEntries, entryName);
    const row = createEntryRow(
      entryName,
      checked,
      isCustom,
      async (isChecked) => {
        const nextMap = await getEnabledMap();
        nextMap[entryName] = isChecked;
        await setEnabledMap(nextMap);
      },
      async () => {
        const nextCustomEntries = await getCustomEntries();
        delete nextCustomEntries[entryName];
        await setCustomEntries(nextCustomEntries);
        const nextEnabledMap = await getEnabledMap();
        delete nextEnabledMap[entryName];
        await setEnabledMap(nextEnabledMap);
        setUploadStatus(`Deleted custom pair "${entryName}".`);
        await render();
      }
    );
    const checkbox = row.querySelector("input[type='checkbox']");
    if (checkbox) {
      checkbox.disabled = !globalEnabled;
    }
    entriesRoot.appendChild(row);
  }
}

async function handleUpload() {
  setUploadStatus("");
  const imageFile = customImageFileInput.files && customImageFileInput.files[0];
  const soundFile = customSoundFileInput.files && customSoundFileInput.files[0];
  if (!imageFile || !soundFile) {
    setUploadStatus("Select both an image/GIF and a matching sound file.");
    return;
  }

  const manualName = normalizeEntryName(customEntryNameInput.value || "");
  const imageBaseName = normalizeEntryName(deriveBasename(imageFile.name));
  const soundBaseName = normalizeEntryName(deriveBasename(soundFile.name));
  let entryName = manualName;

  if (!entryName) {
    if (!imageBaseName || !soundBaseName || imageBaseName !== soundBaseName) {
      setUploadStatus("Provide an entry name or pick files that share the same base filename.");
      return;
    }
    entryName = imageBaseName;
  }

  const [imageUrl, jingleUrl] = await Promise.all([readFileAsDataUrl(imageFile), readFileAsDataUrl(soundFile)]);
  const customEntries = await getCustomEntries();
  customEntries[entryName] = {
    imageUrl,
    jingleUrl,
    imageFileName: imageFile.name,
    soundFileName: soundFile.name,
    updatedAt: Date.now()
  };
  await setCustomEntries(customEntries);

  const enabledMap = await getEnabledMap();
  enabledMap[entryName] = true;
  await setEnabledMap(enabledMap);

  customEntryNameInput.value = "";
  customImageFileInput.value = "";
  customSoundFileInput.value = "";
  setUploadStatus(`Saved custom pair "${entryName}".`);
  await render();
}

globalToggleButton.addEventListener("click", async () => {
  const currentEnabled = await getGlobalEnabled();
  await setGlobalEnabled(!currentEnabled);
  await render();
});

customUploadButton.addEventListener("click", () => {
  handleUpload().catch((error) => {
    const message = error instanceof Error ? error.message : "Failed to save custom pair.";
    setUploadStatus(message);
  });
});

render();
