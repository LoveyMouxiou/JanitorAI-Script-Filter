# Script Entry Cleaner

An offline browser tool for removing selected entries from JSON script/lorebook exports. Files are processed locally in the browser and are never uploaded.

## Use
## Case 1 (Website)
https://loveymouxiou.github.io/JanitorAI-Script-Filter/

### Case 2 (Local)
1. Open `index.html` in a modern browser.
2. Choose the JSON export file.
3. Mark entries to remove, or enter IDs/ranges such as `4, 10-20`.
4. Download the filtered JSON and review it before importing it back into your editor.

## Supported shapes
- A top-level array of entries (including the sample entry format).
- An object with an `entries`, `scripts`, `lorebook`, `data`, `items`, or `cards` array.
- An object whose values are entry objects, including inside those common wrapper properties.
- UTF-8 JSON, UTF-8 with BOM, and UTF-16 JSON with a BOM.

The source file is not modified. The export retains the original wrapper shape where recognized.
