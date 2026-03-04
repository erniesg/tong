/**
 * Tong Extension - Background Service Worker
 * Handles API communication, caching, and extension lifecycle
 */

import { MessageHandler, type Message, type MessageResponse } from './messages';
import { StorageManager } from './storage';
import { ApiClient } from './api';

// Initialize services
const storage = new StorageManager();
const api = new ApiClient();
const messageHandler = new MessageHandler(storage, api);

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[Background] Received message:', message.type, sender.tab?.url);

    // Handle async messages
    messageHandler
      .handle(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error('[Background] Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }
);

// Extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - set default preferences
    await storage.setDefaultPreferences();
    console.log('[Background] Default preferences set');

    // Open options page for initial setup
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    // Migration logic if needed
    console.log('[Background] Extension updated from:', details.previousVersion);
  }
});

// Handle extension icon click when popup is disabled
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Toggle subtitle overlay
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
  } catch (error) {
    console.log('[Background] Could not toggle overlay - content script may not be loaded');
  }
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Check if this is a supported video site
  const supportedPatterns = [
    /youtube\.com\/watch/,
    /bilibili\.com\/video/,
  ];

  const isSupported = supportedPatterns.some((pattern) => pattern.test(tab.url!));

  if (isSupported) {
    console.log('[Background] Supported video page detected:', tab.url);
    // Content script should already be injected via manifest
    // This is just for logging/debugging
  }
});

console.log('[Background] Tong service worker started');
