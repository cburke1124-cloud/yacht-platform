"""Quick security/quality scan of the backend."""
import os, re

backend = os.path.join(os.path.dirname(__file__), "app")
issues = []

SKIP_DIRS = {"venv", "__pycache__", "migrations"}

for root, dirs, files in os.walk(backend):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fname in files:
        if not fname.endswith(".py"):
            continue
        fpath = os.path.join(root, fname)
        rel = fpath.replace(backend, "app")
        with open(fpath, encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        for i, line in enumerate(lines, 1):
            s = line.strip()
            # SQL injection: text() with f-string
            if re.search(r'text\(f["\']', line):
                issues.append(("CRITICAL: SQL-INJECT (f-string in text())", rel, i, s))
            # filename used directly without sanitization
            if "file.filename" in line and "replace" not in line and "split" not in line:
                issues.append(("MEDIUM: FILENAME not sanitized", rel, i, s))
            # MIME type trusting client header only
            if "content_type" in line and "ALLOWED_" in line and "magic" not in line.lower():
                issues.append(("INFO: MIME type from client header (not magic bytes)", rel, i, s))
            # admin route checks
            if "@router" in line and "admin" in fpath and "Depends(get_current_user)" not in line and "def " not in line:
                pass  # skip
            # unvalidated redirect
            if re.search(r'RedirectResponse.*request\.(query_params|path)', line):
                issues.append(("MEDIUM: Open redirect risk", rel, i, s))

print(f"\n{'='*70}")
print(f"  BACKEND SCAN — {len(issues)} items")
print(f"{'='*70}\n")
for severity, path, lineno, text in issues:
    print(f"[{severity}]\n  {path}:{lineno}\n  {text}\n")
