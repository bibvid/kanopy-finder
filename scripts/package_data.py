import os
import shutil
import requests
from pathlib import Path

# --- CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent.parent
EXTENSION_DIR = BASE_DIR / "extension"
TARGET_DATA = EXTENSION_DIR / "initial_data.json"
TARGET_SHA = EXTENSION_DIR / "initial_sha.txt"

REPO = "bibvid/kanopy-finder-data"
DATA_URL = f"https://raw.githubusercontent.com/{REPO}/master/kanopy_data.json"
COMMITS_API = f"https://api.github.com/repos/{REPO}/commits?path=kanopy_data.json&per_page=1"

def package():
    print("📦 Starting packaging routine...")

    # 1. Ensure extension directory exists
    if not EXTENSION_DIR.exists():
        print(f"❌ Error: Extension directory not found at {EXTENSION_DIR}")
        return

    # 2. Fetch the latest SHA and data from GitHub
    print(f"📡 Fetching latest data from {REPO}...")
    try:
        # Get latest commit SHA for the data file
        commit_resp = requests.get(COMMITS_API)
        commit_resp.raise_for_status()
        sha_val = commit_resp.json()[0]['sha']

        # Get the data file content
        data_resp = requests.get(DATA_URL)
        data_resp.raise_for_status()
        data_content = data_resp.text

        # 3. Write data file to extension folder
        with open(TARGET_DATA, "w", encoding="utf-8") as f:
            f.write(data_content)
        print(f"✅ Updated: {TARGET_DATA.name} (from GitHub)")

        # 4. Update the SHA file
        with open(TARGET_SHA, "w", encoding="utf-8") as f:
            f.write(sha_val)
        print(f"📄 Updated: {TARGET_SHA.name} (SHA: {sha_val[:7]})")

    except Exception as e:
        print(f"❌ Failed to fetch data from GitHub: {e}")
        print("⚠️ Falling back to local build if possible...")
        # (Optional: add local fallback logic here if needed)

    print("\n🚀 Ready! Your /extension folder is now up to date with the latest remote data.")

if __name__ == "__main__":
    package()
