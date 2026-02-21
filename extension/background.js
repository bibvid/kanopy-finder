const REPO = "YOUR_USER/YOUR_REPO";
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log("%c[KanopyBackground]", "color: #2196f3; font-weight: bold;", ...args);
}

// --- 1. DATABASE ABSTRACTION (IndexedDB) ---
const DB = {
  name: "KanopyDB",
  store: "mappings",
  version: 1,

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.store)) {
          db.createObjectStore(this.store, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async get(id) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction(this.store, "readonly");
      const request = tx.objectStore(this.store).get(id);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async setAll(data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, "readwrite");
      const store = tx.objectStore(this.store);
      store.clear();
      for (const [extId, kanopyId] of Object.entries(data)) {
        store.put({ id: extId, kanopyId });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

// --- 2. SEEDING & SYNC LOGIC ---

async function seedDatabase() {
  const { storedSHA } = await chrome.storage.local.get('storedSHA');
  if (storedSHA) return;

  log("SEED: First-run initialization...");
  let initialData = null;
  let initialSHA = "local-seed-no-sha";

  try {
    const dataResp = await fetch(chrome.runtime.getURL("initial_data.json"));
    if (dataResp.ok) initialData = await dataResp.json();
    
    const shaResp = await fetch(chrome.runtime.getURL("initial_sha.txt"));
    if (shaResp.ok) initialSHA = (await shaResp.text()).trim();
  } catch (err) { log("SEED: Local files missing or unreadable."); }

  if (initialData) {
    await DB.setAll(initialData);
    await chrome.storage.local.set({ storedSHA: initialSHA, lastUpdated: `${new Date().toLocaleString()} (Local)` });
    log("SEED: Success.");
  } else {
    await syncData();
  }
}

async function syncData() {
  log("SYNC: Checking GitHub...");
  try {
    const branch = await (await fetch(`https://api.github.com/repos/${REPO}/branches/main`)).json();
    const { storedSHA } = await chrome.storage.local.get('storedSHA');

    if (branch.commit.sha !== storedSHA) {
      log("SYNC: Updating data...");
      const data = await (await fetch(`https://raw.githubusercontent.com/${REPO}/main/extension/initial_data.json`)).json();
      await DB.setAll(data);
      await chrome.storage.local.set({ storedSHA: branch.commit.sha, lastUpdated: new Date().toLocaleString() });
    }
  } catch (e) { log("SYNC: Error", e); }
}

// --- 3. MESSAGE LISTENER (KAPI AUTH CHECK) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_ID") {
    (async () => {
      // 1. Check local DB first
      const entry = await DB.get(request.id);
      if (!entry) {
        sendResponse({ canWatch: false });
        return;
      }

      try {
        log(`KAPI: Checking Authorization for ${entry.kanopyId}...`);
        
        // 2. Fetch the Bearer Token from Kanopy's cookies
        const cookie = await chrome.cookies.get({
          url: "https://www.kanopy.com",
          name: "kapi_token"
        });

          const headers = { 'Accept': 'application/json',
			    'x-version': 'web/undefined/undefined/undefined'
			  };
        if (cookie?.value) {
          headers['Authorization'] = `Bearer ${cookie.value}`;
        }

        // 3. Query the Kanopy API
        const apiResp = await fetch(`https://www.kanopy.com/kapi/videos/${entry.kanopyId}`, {
          method: 'GET',
          headers: headers
        });

        if (apiResp.ok) {
          const data = await apiResp.json();
          // Logic: Only show the button if it's an actual video
          const isVideo = data.type === 'video';
          log(`KAPI: Entry type is "${data.type}" -> Valid: ${isVideo}`);
          sendResponse({ canWatch: isVideo, kanopyId: entry.kanopyId });
        } else {
          log(`KAPI: Failed (${apiResp.status}). User likely not authorized.`);
          sendResponse({ canWatch: false });
        }
      } catch (e) {
        log("KAPI: Critical error", e);
        sendResponse({ canWatch: false });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

// Lifecycle Events
chrome.runtime.onInstalled.addListener(async (d) => {
  await seedDatabase();
  if (d.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  syncData();
});
chrome.runtime.onStartup.addListener(syncData);
