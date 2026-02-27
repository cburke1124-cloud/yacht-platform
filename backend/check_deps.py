import os
import re
import ast
from pathlib import Path
from collections import defaultdict

class DependencyChecker:
    def __init__(self, root_path):
        self.root_path = Path(root_path)
        self.all_imports = defaultdict(list)
        self.existing_modules = set()
        self.missing_imports = []
        
    def find_python_files(self):
        """Find all Python files in the project"""
        return list(self.root_path.rglob("*.py"))
    
    def extract_imports(self, filepath):
        """Extract all imports from a Python file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content)
            imports = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module)
            
            return imports
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return []
    
    def module_path_to_file(self, module_name):
        """Convert a module name to a file path"""
        if not module_name.startswith("app."):
            return None
        
        parts = module_name.split(".")
        
        # Try as a file
        file_path = self.root_path / "/".join(parts[1:]) 
        if file_path.with_suffix(".py").exists():
            return file_path.with_suffix(".py")
        
        # Try as a package
        if (file_path / "__init__.py").exists():
            return file_path / "__init__.py"
        
        return None
    
    def check_dependencies(self):
        """Check all dependencies in the project"""
        print("🔍 Scanning Python files...")
        py_files = self.find_python_files()
        print(f"Found {len(py_files)} Python files\n")
        
        # Catalog existing modules
        for py_file in py_files:
            relative = py_file.relative_to(self.root_path)
            module_name = "app." + str(relative.with_suffix("")).replace(os.sep, ".")
            if module_name.endswith(".__init__"):
                module_name = module_name[:-9]
            self.existing_modules.add(module_name)
        
        print(f"📦 Found {len(self.existing_modules)} existing modules\n")
        
        # Check imports
        print("🔎 Checking imports...\n")
        for py_file in py_files:
            imports = self.extract_imports(py_file)
            relative = py_file.relative_to(self.root_path)
            
            for imp in imports:
                if imp.startswith("app."):
                    self.all_imports[str(relative)].append(imp)
                    
                    # Check if module exists
                    base_module = imp.split(".")[0] + "." + imp.split(".")[1] if len(imp.split(".")) > 1 else imp
                    
                    if imp not in self.existing_modules and not any(imp.startswith(mod) for mod in self.existing_modules):
                        file_path = self.module_path_to_file(imp)
                        if file_path is None or not file_path.exists():
                            self.missing_imports.append((str(relative), imp))
        
        # Report missing
        if self.missing_imports:
            print("❌ MISSING IMPORTS FOUND:\n")
            by_file = defaultdict(list)
            for file, imp in self.missing_imports:
                by_file[file].append(imp)
            
            for file, imports in sorted(by_file.items()):
                print(f"  📄 {file}")
                for imp in imports:
                    expected_path = self.module_path_to_file(imp)
                    print(f"     ❌ {imp}")
                    if expected_path:
                        print(f"        Expected at: {expected_path}")
                print()
        else:
            print("✅ All imports found!\n")
        
        return len(self.missing_imports) == 0

def main():
    root = Path(".")
    if not (root / "app").exists():
        print("❌ Error: Run this from your backend directory (where 'app' folder is)")
        return
    
    checker = DependencyChecker(root / "app")
    all_good = checker.check_dependencies()
    
    if not all_good:
        print("\n💡 SUGGESTED FIXES:\n")
        print("1. Create the missing files")
        print("2. Or comment out/remove the imports that reference them")
        print("3. Or fix the import paths if they're incorrect")
    else:
        print("✅ All dependencies resolved!")

if __name__ == "__main__":
    main()
