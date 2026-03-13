const entriesRoot = document.getElementById("entries");
const globalToggleButton = document.getElementById("global-toggle-btn");
const globalToggleStatus = document.getElementById("global-toggle-status");

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

function createEntryRow(entryName, checked, onToggle) {
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

  label.appendChild(checkbox);
  label.appendChild(name);
  row.appendChild(label);
  return row;
}

function renderGlobalToggle(enabled) {
  globalToggleButton.textContent = enabled ? "Disable celebrations" : "Enable celebrations";
  globalToggleStatus.textContent = enabled ? "Currently enabled" : "Currently disabled";
}

async function render() {
  const [libraryEntries, enabledMap, globalEnabled] = await Promise.all([
    loadLibraryEntries(),
    getEnabledMap(),
    getGlobalEnabled()
  ]);

  renderGlobalToggle(globalEnabled);
  entriesRoot.textContent = "";

  if (libraryEntries.length === 0) {
    entriesRoot.textContent = "No entries in assets/library.json";
    return;
  }

  for (const entryName of libraryEntries) {
    const checked = enabledMap[entryName] !== false;
    const row = createEntryRow(entryName, checked, async (isChecked) => {
      const nextMap = await getEnabledMap();
      nextMap[entryName] = isChecked;
      await setEnabledMap(nextMap);
    });
    const checkbox = row.querySelector("input[type='checkbox']");
    if (checkbox) {
      checkbox.disabled = !globalEnabled;
    }
    entriesRoot.appendChild(row);
  }
}

globalToggleButton.addEventListener("click", async () => {
  const currentEnabled = await getGlobalEnabled();
  await setGlobalEnabled(!currentEnabled);
  await render();
});

render();
