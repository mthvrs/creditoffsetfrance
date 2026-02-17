# Search Improvements - Accent-Insensitive & Smarter Ranking

## Changes Made

This update adds **accent-insensitive fuzzy search** to both the main database search and legacy archives search.

### Features

- **Accent handling**: Searching "rever" now finds "rêver", "cinéma" finds "cinema", etc.
- **Smart ranking**: Exact matches and word-start matches appear before substring matches
- **Stricter fuzzy matching**: Only relevant results (minor typos, accents) appear
- **Clickable legacy link**: When legacy results exist, click to open the modal with prefilled search

### Technical Details

#### Backend (PostgreSQL)
- Uses PostgreSQL's `unaccent` extension for accent removal
- Priority-based ordering:
  1. Exact matches (with or without accents)
  2. Word-start matches
  3. Substring matches
  4. Sorted by submission count and release date

#### Frontend (React + Fuse.js)
- Uses Fuse.js v7.0.0 for client-side fuzzy search
- Threshold: 0.2 (strict - only minor variations)
- Custom sorting to prioritize:
  1. Exact matches
  2. Word starts
  3. Whole word boundaries
  4. Fuse.js relevance score

## Deployment Steps

### 1. Enable PostgreSQL Extension

**CRITICAL**: Run this SQL migration on your database:

```bash
psql -U your_user -d your_database -f backend/migrations/enable_unaccent.sql
```

Or manually in psql:
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 2. Update Code

```bash
git pull origin main
```

### 3. Install New Dependencies

```bash
cd frontend
npm install
```

### 4. Rebuild Frontend

```bash
npm run build
```

### 5. Restart Backend

```bash
cd ../backend
npm restart  # or pm2 restart, systemctl restart, etc.
```

## Testing

### Database Search
Try searching:
- "rever" → should find "GOAT : Rêver plus haut"
- "cinema" → should find movies with "cinéma"
- "francais" → should find titles with "français"

### Legacy Archives
Open "Archives Historiques" and search:
- "rever" → "GOAT : Rêver plus haut" should appear at the top
- "wakanda" should NOT appear in results for "rever"

### Ordering Check
Search "rever":
- ✅ "Rêver" (exact match) should be first
- ✅ "Revenir" (word start) should be second
- ❌ "Wakanda Forever" (substring) should NOT appear or be very low

## Files Modified

- `frontend/package.json` - Added fuse.js dependency
- `frontend/src/components/LegacyDataModal.jsx` - Improved search with custom ranking
- `frontend/src/components/DatabaseSearch.jsx` - Added stricter search + clickable link
- `frontend/src/components/HomePage.jsx` - Added callback for prefilled legacy search
- `backend/routes/movies.js` - Added unaccent-based search with priority ordering
- `backend/migrations/enable_unaccent.sql` - PostgreSQL extension migration

## Troubleshooting

### Backend search still doesn't work with accents

**Cause**: The `unaccent` extension is not enabled.

**Fix**: Run the migration:
```bash
psql -U postgres -d creditoffset -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
```

### "function unaccent(text) does not exist" error

**Cause**: PostgreSQL contrib package not installed.

**Fix** (Ubuntu/Debian):
```bash
sudo apt-get install postgresql-contrib
```

**Fix** (Other systems):
Check your PostgreSQL installation documentation for enabling contrib extensions.

### Frontend search ordering still wrong

**Cause**: Browser cache or incomplete build.

**Fix**:
```bash
cd frontend
rm -rf build/
npm run build
# Hard refresh in browser (Ctrl+Shift+R)
```

## Performance Notes

- The `unaccent()` function adds minimal overhead to queries
- Consider adding an index if the database grows large:
  ```sql
  CREATE INDEX idx_movies_title_unaccent ON movies (unaccent(title));
  CREATE INDEX idx_movies_original_title_unaccent ON movies (unaccent(original_title));
  ```

## Rollback

If you need to revert:

```bash
git checkout <previous-commit>
cd frontend
npm install
npm run build
cd ../backend
npm restart
```

The `unaccent` extension can stay enabled - it doesn't hurt anything.
