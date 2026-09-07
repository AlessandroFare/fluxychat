from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "packages" / "create-fluxy-chat" / "templates"
for path in root.rglob("package.json"):
    text = path.read_text(encoding="utf-8")
    updated = re.sub(r'"@fluxy-chat/sdk": "[^"]+"', '"@fluxy-chat/sdk": "^0.6.10"', text)
    updated = re.sub(r'"@fluxy-chat/react": "[^"]+"', '"@fluxy-chat/react": "^0.1.7"', updated)
    updated = re.sub(r'"@fluxy-chat/ui-kit": "[^"]+"', '"@fluxy-chat/ui-kit": "^0.1.5"', updated)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        print("updated", path.relative_to(root.parent))
