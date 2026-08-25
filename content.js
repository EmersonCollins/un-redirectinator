const DEFAULTS = {
  enabled: true,
  protectedSites: []
};

const parseUrl = (candidate, baseUrl = window.location.href) => {
  try {
    return new URL(candidate, baseUrl);
  } catch {
    return null;
  }
};

const isHttp = (url) => url && (url.protocol === "http:" || url.protocol === "https:");

const isCrossSite = (candidateUrl) => {
  const parsed = parseUrl(candidateUrl);
  return isHttp(parsed) && parsed.hostname !== window.location.hostname;
};

const blockEvent = (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

const protectAnchorClicks = () => {
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) {
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) {
        return;
      }

      if (isCrossSite(anchor.getAttribute("href"))) {
        blockEvent(event);
      }
    },
    true
  );
};

const protectFormSubmits = () => {
  document.addEventListener(
    "submit",
    (event) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
        return;
      }

      if (isCrossSite(event.target.getAttribute("action") || window.location.href)) {
        blockEvent(event);
      }
    },
    true
  );
};

const protectWindowOpen = () => {
  const originalOpen = window.open;
  window.open = function patchedOpen(url, target, features) {
    if (typeof url === "string" && isCrossSite(url)) {
      return null;
    }
    return originalOpen.call(window, url, target, features);
  };
};

const protectLocationMethods = () => {
  const originalAssign = Location.prototype.assign;
  const originalReplace = Location.prototype.replace;

  Location.prototype.assign = function patchedAssign(url) {
    if (typeof url === "string" && isCrossSite(url)) {
      return;
    }
    return originalAssign.call(this, url);
  };

  Location.prototype.replace = function patchedReplace(url) {
    if (typeof url === "string" && isCrossSite(url)) {
      return;
    }
    return originalReplace.call(this, url);
  };
};

const enableProtection = () => {
  protectAnchorClicks();
  protectFormSubmits();
  protectWindowOpen();
  protectLocationMethods();
};

chrome.storage.sync.get(DEFAULTS, ({ enabled, protectedSites }) => {
  if (!enabled || !Array.isArray(protectedSites)) {
    return;
  }

  const isProtected = protectedSites
    .map((host) => String(host).trim().toLowerCase())
    .includes(window.location.hostname.toLowerCase());

  if (isProtected) {
    enableProtection();
  }
});
