// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Service worker: turns "auction ending soon" messages from the content script
// into system notifications, auto-dismisses them when the auction ends, and
// focuses the originating tab when a notification is clicked.
//
// MV3 service workers are ephemeral — they can be torn down between the create
// and the click. So we encode the target tab/window INTO the notification id
// ("ebay|<tabId>|<windowId>|<stamp>") instead of keeping an in-memory map; the
// click handler parses it back, so it works even after a restart. The same
// "ebay|<tabId>|" prefix lets the auto-dismiss sweep find a tab's own badges.

// Prefer the listing's own photo; fall back to the bundled icon.
function iconFor(msg) {
  return typeof msg.iconUrl === "string" && /^https?:\/\//.test(msg.iconUrl)
    ? msg.iconUrl
    : "icons/icon128.png";
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  const tab = sender.tab;
  if (!tab) return;

  if (msg.type === "ending-soon") {
    const id = `ebay|${tab.id}|${tab.windowId}|${Date.now()}`;
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: iconFor(msg),
      title: `Auction ending in ${msg.threshold}s`,
      message: msg.title || "An eBay auction is ending soon.",
      priority: 2,
      requireInteraction: true, // stay until clicked/dismissed
    });
    return;
  }

  if (msg.type === "auction-ended") {
    // Auto-dismiss every outstanding "ending soon" badge this tab raised — the
    // countdown is over, so a lingering "ending in Ns" badge is now stale.
    const prefix = `ebay|${tab.id}|`;
    chrome.notifications.getAll((all) => {
      Object.keys(all || {}).forEach((id) => {
        if (id.startsWith(prefix)) chrome.notifications.clear(id);
      });
      // Opt-in: leave a single persistent "ended" badge in their place. Same id
      // shape (so a click still focuses the tab); the "ended" stamp keeps it
      // identifiable and distinct from the swept "ending soon" ids.
      if (msg.persistent) {
        chrome.notifications.create(`ebay|${tab.id}|${tab.windowId}|ended`, {
          type: "basic",
          iconUrl: iconFor(msg),
          title: "Auction ended",
          message: msg.title || "An eBay auction you were watching has ended.",
          priority: 2,
          requireInteraction: true,
        });
      }
    });
    return;
  }
});

chrome.notifications.onClicked.addListener((id) => {
  const parts = id.split("|");
  if (parts[0] !== "ebay") return;
  const tabId = Number(parts[1]);
  const windowId = Number(parts[2]);
  // Focus the window, then activate the tab. Neither call needs the sensitive
  // "tabs" permission (we only touch active/focused, not url/title).
  if (Number.isInteger(windowId)) chrome.windows.update(windowId, { focused: true });
  if (Number.isInteger(tabId)) chrome.tabs.update(tabId, { active: true });
  chrome.notifications.clear(id);
});
