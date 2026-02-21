(function() {
  const DEBUG = true; // Set to false for production
  
  function log(...args) {
    if (DEBUG) console.log("%c[KanopyFinder]", "color: #ff5722; font-weight: bold;", ...args);
  }

  log("Script initialized on:", window.location.href);

  const url = window.location.href;
  let detectedIds = new Set();

  // 1. SITE-SPECIFIC SCRAPING
  if (url.includes("imdb.com/title/")) {
    const imdbId = url.match(/tt\d+/)?.[0];
    if (imdbId) {
      log("Found IMDb ID in URL:", imdbId);
      detectedIds.add(imdbId);
    }
  }

  // 2. SEARCH ENGINE / WIKIPEDIA LINK SCRAPING
  const wikiLinks = document.querySelectorAll('a[href*="wikipedia.org/wiki/"]');
  if (wikiLinks.length > 0) {
    log(`Scanning ${wikiLinks.length} Wikipedia links on page...`);
    wikiLinks.forEach(link => {
      try {
        const slug = decodeURIComponent(link.href.split('/wiki/')[1].split('#')[0]);
        if (slug && !slug.includes(':')) {
          detectedIds.add(slug);
        }
      } catch (e) {
        log("Error parsing Wiki link:", link.href);
      }
    });
  }

  // 3. LOG FINAL DETECTED SET
  if (detectedIds.size === 0) {
    log("No movie identifiers found on this page.");
    return;
  }

  log("Identifiers to check:", Array.from(detectedIds));

  // 4. CROSS-REFERENCE WITH BACKGROUND DB
  detectedIds.forEach(id => {
    chrome.runtime.sendMessage({ type: "CHECK_ID", id: id }, (res) => {
      if (chrome.runtime.lastError) {
        log("Connection error to background script:", chrome.runtime.lastError);
        return;
      }

      if (res?.canWatch) {
        log(`MATCH FOUND! [${id}] -> Kanopy ID: ${res.kanopyId}`);
        injectKanopyUI(res.kanopyId);
      } else {
        log(`No Kanopy match for identifier: ${id}`);
      }
    });
  });

  function injectKanopyUI(kanopyId) {
    if (document.getElementById(`kanopy-link-${kanopyId}`)) return;

    log("Injecting UI button for:", kanopyId);
    const btn = document.createElement('a');
    btn.id = `kanopy-link-${kanopyId}`;
    btn.href = `https://www.kanopy.com/video/${kanopyId}`;
    btn.className = "kanopy-btn";
    btn.target = "_blank";
    btn.innerHTML = `<span>▶</span> Watch on Kanopy`;
    document.body.appendChild(btn);
  }
})();
