async function refresh() {
  const { storedSHA, lastUpdated } = await chrome.storage.local.get(['storedSHA', 'lastUpdated']);
  document.getElementById('sha-val').textContent = storedSHA?.substring(0, 7) || 'None';
  document.getElementById('sync-val').textContent = lastUpdated || 'Never';
}

document.getElementById('sync-button').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: "FORCE_SYNC" }, (res) => {
    if (res.success) {
      refresh();
      document.getElementById('sync-msg').textContent = "Success!";
    }
  });
});

refresh();
