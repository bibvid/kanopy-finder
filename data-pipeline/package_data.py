import os
import shutil
from pathlib import Path

# --- CONFIGURATION ---
# We use pathlib for cross-platform (Windows/Mac/Linux) path handling
BASE_DIR = Path(__file__).resolve().parent
EXTENSION_DIR = BASE_DIR.parent / "extension"
SOURCE_DATA = BASE_DIR / "kanopy_data.json"
TARGET_DATA = EXTENSION_DIR / "initial_data.json"
TARGET_SHA = EXTENSION_DIR / "initial_sha.txt"

def package():
    print("📦 Starting packaging routine...")

    # 1. Ensure extension directory exists
    if not EXTENSION_DIR.exists():
        print(f"❌ Error: Extension directory not found at {EXTENSION_DIR}")
        return

    # 2. Check for the source data file
    if not SOURCE_DATA.exists():
        print(f"⚠️ Warning: {SOURCE_DATA.name} not found. Did you run generate_data.py?")
        return

    # 3. Copy data file to extension folder (and rename to initial_data.json)
    try:
        shutil.copy2(SOURCE_DATA, TARGET_DATA)
        print(f"✅ Copied: {SOURCE_DATA.name} -> {TARGET_DATA.name}")
    except Exception as e:
        print(f"❌ Failed to copy data: {e}")

    # 4. Generate/Update the SHA file
    # We use this to help the extension know if it needs to update from GitHub later
    try:
        # If running in GitHub Actions, we'd pull the real SHA. 
        # Locally, we can use the current git commit hash
        sha_val = os.getenv("GITHUB_SHA")
        if not sha_val:
            import subprocess
            try:
                sha_val = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode("utf-8").strip()
            except Exception:
                sha_val = "local-development-build"
        
        with open(TARGET_SHA, "w", encoding="utf-8") as f:
            f.write(sha_val)
        print(f"📄 Created: {TARGET_SHA.name} (SHA: {sha_val[:7]})")
    except Exception as e:
        print(f"❌ Failed to create SHA file: {e}")

    print("\n🚀 Ready! Your /extension folder is now up to date.")

if __name__ == "__main__":
    package()