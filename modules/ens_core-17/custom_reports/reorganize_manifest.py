#!/usr/bin/env python3
"""Script to reorganize the manifest file with proper alphabetical order"""

import re

# Read the manifest file
with open('/data/enswork-workspace/modules/odoo-17/ens_core/custom_reports/__manifest__.py', 'r') as f:
    content = f.read()

# Find the data section
data_match = re.findall(r'"([^"]*)",?\s*', content)

# Separate disable files from others
other_entries = []
disable_entries = []

for entry in data_match:
    if 'disable' in entry:
        disable_entries.append(f'        "{entry}",\n')
    else:
        other_entries.append(f'        "{entry}",\n')

# Sort disable entries alphabetically
disable_entries.sort()

# Reconstruct the data section
all_entries = other_entries + disable_entries
new_data_section = '    "data": [\n' + ''.join(all_entries) + '    ],'

# Replace the data section in the content
content = re.sub(r'"data":\s*\[.*?\],', new_data_section, content, flags=re.DOTALL)

# Write back to file
with open('/data/enswork-workspace/modules/odoo-17/ens_core/custom_reports/__manifest__.py', 'w') as f:
    f.write(content)

print("✅ Le fichier manifest a été réorganisé correctement")