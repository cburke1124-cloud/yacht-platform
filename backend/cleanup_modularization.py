import os
import shutil

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LEGACY_DIR = os.path.join(BASE_DIR, "legacy_cleanup")

# Files to delete entirely
DELETE_FILES = [
    "add_subscription_tier.py",
    "add_team_management.py",
    "rate_limiter.py",
]

# Files to archive (kept for reference)
ARCHIVE_FILES = [
    "error_handler.py",
    "optimized_scraper.py",
]

def ensure_legacy_dir():
    if not os.path.exists(LEGACY_DIR):
        os.makedirs(LEGACY_DIR)
        print(f"📁 Created archive directory: {LEGACY_DIR}")

def delete_files():
    for filename in DELETE_FILES:
        path = os.path.join(BASE_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
            print(f"🗑️ Deleted: {filename}")
        else:
            print(f"✔️ Already removed: {filename}")

def archive_files():
    for filename in ARCHIVE_FILES:
        src = os.path.join(BASE_DIR, filename)
        dst = os.path.join(LEGACY_DIR, filename)
        if os.path.exists(src):
            shutil.move(src, dst)
            print(f"📦 Archived: {filename}")
        else:
            print(f"✔️ Already archived: {filename}")

def main():
    print("=== YachtVersal Modular Cleanup ===")
    ensure_legacy_dir()
    delete_files()
    archive_files()
    print("🎉 Cleanup complete!")

if __name__ == "__main__":
    main()