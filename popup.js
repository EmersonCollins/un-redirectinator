const protectionToggle = document.getElementById("toggle-protection");
const toggleLabel = document.getElementById("toggle-label");
const siteHint = document.getElementById("site-hint");
const whitelistInput = document.getElementById("whitelist-input");
const whitelistAddButton = document.getElementById("whitelist-add");
const whitelistList = document.getElementById("whitelist-list");
const DEFAULTS = { enabled: true, protectedSites: [], whitelistUrls: [] };

const normalizeHost = (host) => host.trim().toLowerCase();

const parseActiveHost = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
};

const parseHostFromInput = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
};

const getActiveTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
      resolve(activeTab || null);
    });
  });

const getSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, resolve);
  });

const setSettings = (value) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(value, resolve);
  });

const setProtectionToggleState = (isEnabled, isDisabled = false) => {
  protectionToggle.disabled = isDisabled;
  protectionToggle.setAttribute("aria-pressed", String(isEnabled));
  toggleLabel.textContent = isEnabled ? "The Un-Redirectinator is Active" : "The Un-Redirectinator is Inactive";
};

const renderWhitelist = (whitelistHosts, onChange) => {
  whitelistList.textContent = "";
  whitelistHosts.forEach((host) => {
    const item = document.createElement("li");
    const hostText = document.createElement("span");
    const removeButton = document.createElement("button");

    hostText.textContent = host;
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      const nextWhitelist = whitelistHosts.filter((entry) => entry !== host);
      await setSettings({ whitelistUrls: nextWhitelist });
      onChange(nextWhitelist);
    });

    item.append(hostText, removeButton);
    whitelistList.append(item);
  });
};

const init = async () => {
  const [settings, activeTab] = await Promise.all([getSettings(), getActiveTab()]);
  const activeHost = parseActiveHost(activeTab?.url || "");
  const protectedSites = Array.isArray(settings.protectedSites) ? settings.protectedSites : [];
  const normalizedSites = protectedSites.map(normalizeHost);
  let whitelistHosts = (Array.isArray(settings.whitelistUrls) ? settings.whitelistUrls : [])
    .map((entry) => normalizeHost(String(entry)))
    .filter(Boolean);

  if (!activeHost) {
    setProtectionToggleState(false, true);
    siteHint.textContent = "Open a regular website tab to protect it.";
  } else {
    let toggleEnabled = Boolean(settings.enabled) && normalizedSites.includes(activeHost);
    setProtectionToggleState(toggleEnabled);
    siteHint.textContent = `Current site: ${activeHost}`;

    protectionToggle.addEventListener("click", async () => {
      const nextSites = new Set(normalizedSites);
      toggleEnabled = !toggleEnabled;

      if (toggleEnabled) {
        nextSites.add(activeHost);
        await setSettings({ enabled: true, protectedSites: [...nextSites] });
      } else {
        nextSites.delete(activeHost);
        await setSettings({ enabled: false, protectedSites: [...nextSites] });
      }

      setProtectionToggleState(toggleEnabled);
    });
  }

  const syncWhitelist = (nextWhitelist) => {
    whitelistHosts = nextWhitelist;
    renderWhitelist(whitelistHosts, syncWhitelist);
  };

  syncWhitelist(whitelistHosts);

  whitelistAddButton.addEventListener("click", async () => {
    const host = parseHostFromInput(whitelistInput.value);
    if (!host) {
      return;
    }

    whitelistHosts = [...new Set([...whitelistHosts, host])];
    await setSettings({ whitelistUrls: whitelistHosts });
    syncWhitelist(whitelistHosts);
    whitelistInput.value = "";
  });
};

init();
