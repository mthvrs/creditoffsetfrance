# Scripts

## 📜 update-legacy-data.js

**Purpose:** Rebuild `frontend/public/legacy_data.json` from `historicaldata_17Fev2026.html`

### ⚠️ Important

- This script **ONLY** updates the **Archives historiques** section (fed by `legacy_data.json`)
- It does **NOT** touch the new database
- It completely **overwrites** the existing `legacy_data.json` file

### Usage

```bash
# From project root
npm install        # Install jsdom dependency
npm run update-legacy
```

Or directly:

```bash
node scripts/update-legacy-data.js
```

### Requirements

1. `historicaldata_17Fev2026.html` must exist in project root
2. `jsdom` npm package must be installed

### What it does

1. 📖 **Reads** `historicaldata_17Fev2026.html`
2. 🔍 **Parses** the HTML table structure:
   - Extracts movie titles from `.show-title`
   - Extracts years from `.show-year` (YYYY format)
   - Reads Pré-COS and COS times from table cells
3. ⚙️ **Normalizes** times from `MM:SS` to `0:MM:SS`
4. 💾 **Writes** to `frontend/public/legacy_data.json`

### Output format

```json
[
  {
    "title": "Le rêve américain",
    "year": "2026",
    "cos": "0:04:15",
    "pre_cos": null
  },
  {
    "title": "Mon grand frère et moi",
    "year": "2026",
    "cos": "0:02:47",
    "pre_cos": "0:03:30"
  }
]
```

### Result

After running:

```
🚀 Starting legacy data update...

📖 Reading file: .../historicaldata_17Fev2026.html
Found 700 rows in table
✅ Parsed 700 movies from HTML

📋 Sample (first 5 movies):
  - Le rêve américain (2026)
    Pré-COS: N/A, COS: 0:04:15
  ...

✅ Successfully updated legacy_data.json!
   Location: .../frontend/public/legacy_data.json
   Total movies: 700

📌 Note: This only updates the "Archives historiques" section.
   The new database is NOT affected by this script.
```

---

## 📊 parse-historical-data.js (backend/scripts/)

**Purpose:** Import historical data into the **new PostgreSQL database**

⚠️ **This is separate from the legacy data!**

See `backend/scripts/README.md` for details.
