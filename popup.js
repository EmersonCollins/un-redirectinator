const enabledToggle = document.getElementById("enabled");

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  enabledToggle.checked = enabled;
});

enabledToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledToggle.checked });
});
