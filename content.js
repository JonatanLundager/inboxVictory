(() => {
  const OVERLAY_ID = "__mission_accomplished_overlay__";
  const TRIGGER_COOLDOWN_MS = 1500;
  const DISPLAY_MS = 2600;
  const SEND_FALLBACK_DELAY_MS = 250;
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
  const JINGLE_EXTENSIONS = ["mp3", "wav", "ogg", "m4a"];

  let lastTriggerAt = 0;
  let pendingFallbackTimer = null;
  let audioContext = null;
  let mediaPairs = [];
  let mediaLoadPromise = null;
  let enabledEntriesMap = {};
  let celebrationEnabled = true;

  function getAudioContext() {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioContext = new Ctx();
    }
    return audioContext;
  }

  function warmAudioContext() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function createTone(ctx, frequency, startAt, duration, gainValue) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration);
  }

  function playPatrioticTune() {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const notes = [
      [392.0, 0.18], [392.0, 0.18], [440.0, 0.22], [392.0, 0.22], [523.25, 0.3], [493.88, 0.4],
      [392.0, 0.18], [392.0, 0.18], [440.0, 0.22], [392.0, 0.22], [587.33, 0.3], [523.25, 0.4]
    ];
    let startAt = ctx.currentTime + 0.03;
    for (const [freq, dur] of notes) {
      createTone(ctx, freq, startAt, dur, 0.08);
      startAt += dur + 0.04;
    }
  }

  async function resourceExists(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function resolveByBasename(baseName, folder, extensions) {
    for (const extension of extensions) {
      const relativePath = `assets/${folder}/${baseName}.${extension}`;
      const url = chrome.runtime.getURL(relativePath);
      if (await resourceExists(url)) {
        return url;
      }
    }
    return null;
  }

  async function loadMediaLibrary() {
    if (mediaLoadPromise) {
      return mediaLoadPromise;
    }

    mediaLoadPromise = (async () => {
      const pairs = [];
      try {
        enabledEntriesMap = await new Promise((resolve) => {
          chrome.storage.local.get({ enabledEntries: {} }, (result) => {
            resolve(result.enabledEntries || {});
          });
        });

        const indexUrl = chrome.runtime.getURL("assets/library.json");
        const response = await fetch(indexUrl, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          const entries = Array.isArray(payload.entries) ? payload.entries : [];
          for (const entry of entries) {
            if (typeof entry !== "string" || entry.trim() === "") {
              continue;
            }
            const name = entry.trim();
            if (enabledEntriesMap[name] === false) {
              continue;
            }
            const imageUrl = await resolveByBasename(name, "images", IMAGE_EXTENSIONS);
            if (!imageUrl) {
              continue;
            }
            const jingleUrl = await resolveByBasename(name, "jingles", JINGLE_EXTENSIONS);
            pairs.push({ name, imageUrl, jingleUrl });
          }
        }
      } catch {
      }

      mediaPairs = pairs;
      return mediaPairs;
    })();

    return mediaLoadPromise;
  }

  function loadGlobalEnabled() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ celebrationEnabled: true }, (result) => {
        celebrationEnabled = result.celebrationEnabled !== false;
        resolve(celebrationEnabled);
      });
    });
  }

  function pickRandomPair() {
    if (mediaPairs.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * mediaPairs.length);
    return mediaPairs[randomIndex];
  }

  function showCenteredImage(imageUrl) {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }

    const wrapper = document.createElement("div");
    wrapper.id = OVERLAY_ID;
    wrapper.style.position = "fixed";
    wrapper.style.inset = "0";
    wrapper.style.zIndex = "2147483647";
    wrapper.style.pointerEvents = "none";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    wrapper.style.background = "transparent";
    wrapper.style.opacity = "0";
    wrapper.style.transition = "opacity 180ms ease-in";

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "Mission accomplished";
    image.style.width = "auto";
    image.style.height = "auto";
    image.style.display = "block";
    image.style.borderRadius = "0";
    image.style.boxShadow = "none";
    wrapper.appendChild(image);

    document.body.appendChild(wrapper);
    requestAnimationFrame(() => {
      wrapper.style.opacity = "1";
    });

    window.setTimeout(() => {
      wrapper.style.opacity = "0";
      window.setTimeout(() => wrapper.remove(), 220);
    }, DISPLAY_MS);
  }

  function playJingleOrFallback(jingleUrl) {
    warmAudioContext();
    if (!jingleUrl) {
      playPatrioticTune();
      return;
    }

    const audio = new Audio(jingleUrl);
    audio.volume = 0.9;
    audio.play().catch(() => {
      playPatrioticTune();
    });
  }

  async function triggerCelebration() {
    await loadGlobalEnabled();
    if (!celebrationEnabled) {
      return;
    }
    const now = Date.now();
    if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS) {
      return;
    }
    lastTriggerAt = now;

    await loadMediaLibrary();
    if (mediaPairs.length === 0) {
      return;
    }
    const pair = pickRandomPair();
    if (!pair) {
      return;
    }
    showCenteredImage(pair.imageUrl);
    playJingleOrFallback(pair.jingleUrl);
  }

  function textLooksLikeSendConfirmation(text) {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized.includes("message sent") || normalized === "sent";
  }

  function scanNodeForSendConfirmation(node) {
    if (!(node instanceof Element || node instanceof Text)) {
      return false;
    }
    const text = node.textContent || "";
    return textLooksLikeSendConfirmation(text);
  }

  function setupSendObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (scanNodeForSendConfirmation(mutation.target)) {
            triggerCelebration();
            return;
          }
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (scanNodeForSendConfirmation(node)) {
            triggerCelebration();
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  function getElementFromEventTarget(target) {
    if (target instanceof Element) {
      return target;
    }
    if (target instanceof Text) {
      return target.parentElement;
    }
    return null;
  }

  function looksLikeSendButton(target) {
    const targetElement = getElementFromEventTarget(target);
    if (!targetElement) {
      return false;
    }
    const button = targetElement.closest("[role='button'], [gh='mtb']");
    if (!button) {
      return false;
    }

    if (button.classList.contains("aoO")) {
      return true;
    }

    const gh = button.getAttribute("gh") || button.closest("[gh]")?.getAttribute("gh");
    if (gh === "mtb") {
      return true;
    }

    const text = [button.getAttribute("aria-label"), button.getAttribute("data-tooltip"), button.textContent]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (text.includes("send") || text.includes("ctrl-enter") || text.includes("cmd-enter")) {
      return true;
    }

    const tooltip = (button.getAttribute("data-tooltip") || "").toLowerCase();
    return tooltip.includes("enter") && (tooltip.includes("ctrl") || tooltip.includes("⌘"));
  }

  function scheduleFallbackCelebration() {
    if (pendingFallbackTimer) {
      window.clearTimeout(pendingFallbackTimer);
    }
    pendingFallbackTimer = window.setTimeout(() => {
      pendingFallbackTimer = null;
      triggerCelebration();
    }, SEND_FALLBACK_DELAY_MS);
  }

  function setupSendActionFallback() {
    window.addEventListener(
      "click",
      (event) => {
        warmAudioContext();
        if (looksLikeSendButton(event.target)) {
          scheduleFallbackCelebration();
        }
      },
      { capture: true, passive: true }
    );

    window.addEventListener(
      "keydown",
      (event) => {
        warmAudioContext();
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          scheduleFallbackCelebration();
        }
      },
      { capture: true, passive: true }
    );
  }

  function init() {
    loadGlobalEnabled();
    loadMediaLibrary();
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes.enabledEntries) {
        mediaLoadPromise = null;
        loadMediaLibrary();
      }
      if (changes.celebrationEnabled) {
        celebrationEnabled = changes.celebrationEnabled.newValue !== false;
      }
    });
    setupSendObserver();
    setupSendActionFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
