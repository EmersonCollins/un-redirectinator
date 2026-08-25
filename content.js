const REDIRECT_KEYS = [
  "url",
  "u",
  "redirect",
  "redirect_uri",
  "target",
  "to",
  "dest",
  "destination"
];

const isNavigableUrl = (candidate) => {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getRedirectTarget = (currentUrl) => {
  for (const key of REDIRECT_KEYS) {
    const value = currentUrl.searchParams.get(key);
    if (value && isNavigableUrl(value)) {
      return value;
    }
  }

  return null;
};

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  if (!enabled) {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const target = getRedirectTarget(currentUrl);

  if (target && target !== window.location.href) {
    window.location.replace(target);
  }
});
