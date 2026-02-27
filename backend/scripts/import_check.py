import importlib.util

spec = importlib.util.spec_from_file_location(
    "yacht_main",
    r"c:\Users\cburk\yacht-platform\backend\main.py",
)
module = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(module)
    print("Module imported successfully")
except Exception as e:
    print("Import failed:", type(e).__name__, e)
    raise