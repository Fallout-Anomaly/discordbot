import os
import json

kb_dir = r"E:\Projects\AnomalyBot\DiscordJS-V14-Bot-Template-3.0.1\src\knowledge"
output_file = r"E:\Projects\AnomalyBot\anomaly-worker\src\knowledge.js"

if not os.path.exists(os.path.dirname(output_file)):
    os.makedirs(os.path.dirname(output_file))

kb_data = []

for filename in os.listdir(kb_dir):
    if filename.endswith(".md"):
        with open(os.path.join(kb_dir, filename), "r", encoding="utf-8") as f:
            content = f.read()
            kb_data.append({
                "name": filename,
                "content": content,
                "keywords": filename.lower().replace(".md", "").split("-")
            })

with open(output_file, "w", encoding="utf-8") as f:
    f.write("export const KNOWLEDGE_BASE = " + json.dumps(kb_data, indent=2) + ";\n")
