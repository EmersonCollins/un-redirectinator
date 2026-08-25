const DEFAULTS = {
  enabled: true,
  protectedSites: [],
  whitelistUrls: []
};

const RULE_ID_START = 10_000;
const RULE_ID_END = 1_000_000;

const storageGet = (defaults) =>
  new Promise((resolve) => chrome.storage.sync.get(defaults, resolve));

const storageSet = (value) =>
  new Promise((resolve) => chrome.storage.sync.set(value, resolve));

const getDynamicRules = () =>
  new Promise((resolve) => chrome.declarativeNetRequest.getDynamicRules(resolve));

const updateDynamicRules = (options) =>
  new Promise((resolve) => chrome.declarativeNetRequest.updateDynamicRules(options, resolve));

const tabsGet = (tabId) =>
  new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      resolve(chrome.runtime.lastError ? null : tab);
    });
  });

const tabsRemove = (tabId) =>
  new Promise((resolve) => chrome.tabs.remove(tabId, resolve));

const normalizeHost = (host) => host.trim().toLowerCase();

const getHostnameFromUrl = (candidate) => {
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return normalizeHost(parsed.hostname);
  } catch {
    return null;
  }
};

const hashHost = (host) => {
  let hash = 0;
  for (let index = 0; index < host.length; index += 1) {
    hash = (hash * 31 + host.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const getRuleId = (host, takenIds) => {
  const rangeSize = RULE_ID_END - RULE_ID_START;
  let ruleId = RULE_ID_START + (hashHost(host) % rangeSize);

  while (takenIds.has(ruleId)) {
    ruleId += 1;
    if (ruleId >= RULE_ID_END) {
      ruleId = RULE_ID_START;
    }
  }

  takenIds.add(ruleId);
  return ruleId;
};

const buildRule = (id, host) => ({
  id,
  priority: 1,
  action: { type: "block" },
  condition: {
    resourceTypes: ["main_frame"],
    initiatorDomains: [host],
    excludedRequestDomains: [host]
  }
});

const getManagedRuleIds = (rules) =>
  rules
    .filter((rule) => rule.id >= RULE_ID_START && rule.id < RULE_ID_END)
    .map((rule) => rule.id);

const syncProtectionRules = async () => {
  const { enabled, protectedSites } = await storageGet(DEFAULTS);
  const existingRules = await getDynamicRules();
  const removeRuleIds = getManagedRuleIds(existingRules);

  if (!enabled || protectedSites.length === 0) {
    if (removeRuleIds.length > 0) {
      await updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const uniqueHosts = [...new Set(protectedSites.map(normalizeHost).filter(Boolean))];
  const takenIds = new Set();
  const addRules = uniqueHosts.map((host) => buildRule(getRuleId(host, takenIds), host));

  await updateDynamicRules({ removeRuleIds, addRules });
};

const ensureDefaults = async () => {
  const current = await storageGet(DEFAULTS);
  await storageSet({
    enabled: Boolean(current.enabled),
    protectedSites: Array.isArray(current.protectedSites) ? current.protectedSites : [],
    whitelistUrls: Array.isArray(current.whitelistUrls) ? current.whitelistUrls : []
  });
};

const bootstrap = async () => {
  await ensureDefaults();
  await syncProtectionRules();
};

const shouldCloseCreatedTab = async (newTab) => {
  if (!newTab.id || !newTab.openerTabId) {
    return false;
  }

  const [settings, openerTab] = await Promise.all([
    storageGet(DEFAULTS),
    tabsGet(newTab.openerTabId)
  ]);

  if (!settings.enabled || !openerTab) {
    return false;
  }

  const openerHost = getHostnameFromUrl(openerTab.url || openerTab.pendingUrl);
  if (!openerHost) {
    return false;
  }

  const protectedHosts = new Set(
    (Array.isArray(settings.protectedSites) ? settings.protectedSites : [])
      .map((host) => normalizeHost(String(host)))
      .filter(Boolean)
  );

  return protectedHosts.has(openerHost);
};

const ensureWhitelistProtectionForUrl = async (url) => {
  const host = getHostnameFromUrl(url);
  if (!host) {
    return;
  }

  const settings = await storageGet(DEFAULTS);
  const whitelistHosts = new Set(
    (Array.isArray(settings.whitelistUrls) ? settings.whitelistUrls : [])
      .map((entry) => normalizeHost(String(entry)))
      .filter(Boolean)
  );

  if (!whitelistHosts.has(host)) {
    return;
  }

  const protectedHosts = new Set(
    (Array.isArray(settings.protectedSites) ? settings.protectedSites : [])
      .map((entry) => normalizeHost(String(entry)))
      .filter(Boolean)
  );

  if (!settings.enabled || !protectedHosts.has(host)) {
    protectedHosts.add(host);
    await storageSet({ enabled: true, protectedSites: [...protectedHosts] });
  }
};

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  syncProtectionRules();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (changes.enabled || changes.protectedSites) {
    syncProtectionRules();
  }
});

chrome.tabs.onCreated.addListener(async (newTab) => {
  if (await shouldCloseCreatedTab(newTab)) {
    await tabsRemove(newTab.id);
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.url || (changeInfo.status === "complete" && (tab.url || tab.pendingUrl))) {
    await ensureWhitelistProtectionForUrl(changeInfo.url || tab.url || tab.pendingUrl);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await tabsGet(tabId);
  if (tab) {
    await ensureWhitelistProtectionForUrl(tab.url || tab.pendingUrl);
  }
});
