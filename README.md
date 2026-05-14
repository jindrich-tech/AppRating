# AppRating

AppRating is a lightweight GitHub Pages dashboard that tracks one iOS app's public App Store rating metrics over time, with optional Google Play data collection.

It uses:
- **Static frontend** (HTML/CSS/vanilla JS + Chart.js)
- **Daily GitHub Actions automation** to fetch fresh rating data
- **`ratings.json` committed in-repo** as the historical store

No backend server is required.

---

## Quick start

1. Fork or create a repository with these project files.
2. Set your app identifiers in GitHub Actions secrets:
   - `APPLE_APP_ID` (example: `1234567890`)
   - `GOOGLE_PLAY_PACKAGE_NAME` (example: `com.example.app`)
3. Enable the workflow in **Actions**.
4. Run **Update App Ratings** once via **Run workflow**.
5. Enable GitHub Pages from the repository root.
6. Open your Pages URL to view the dashboard.

---

## How it works

- `scripts/fetch-rating.mjs` calls Apple's iTunes Lookup API with `country=cz` and `APPLE_APP_ID`.
- The same script also fetches Google Play from:
  `https://play.google.com/store/apps/details?id=...&hl=en&gl=CZ`
- It upserts **one snapshot per UTC date** into `ratings.json`.
- `.github/workflows/rating-cron.yml` runs daily and commits `ratings.json` only when changed.
- `index.html` + `app.js` loads `./ratings.json` and draws charts for the most recent 30 entries.

Apple and Google Play both use Czech Republic storefront targeting (`cz` / `CZ`) in the current implementation.

### Historical data limitation

Storefront APIs/pages return current aggregate values, not full historical daily values. Historical trend data starts accumulating from the day your workflow first runs.

---

## Hidden Google test mode

Default URL remains Apple-only (production behavior):

- `https://jindrich-tech.github.io/AppRating/`

To show Apple + Google lines/cards for testing, open:

- `https://jindrich-tech.github.io/AppRating/?google=on`

When `?google=on` is not present, the UI intentionally shows only Apple values.

---

## Configuration

### Set APPLE_APP_ID and GOOGLE_PLAY_PACKAGE_NAME

Recommended: set both as repository secrets.

1. Go to **Settings → Secrets and variables → Actions**.
2. Create two **Repository secrets**:
   - `APPLE_APP_ID`: numeric iOS app ID
   - `GOOGLE_PLAY_PACKAGE_NAME`: Android package name

### Google Play scraping note

Google Play scraping is unofficial and depends on page markup. If Google changes HTML patterns, parser updates may be required.

If CZ-specific page data is unavailable or parsing fails, the script keeps Apple updates running and stores:

- `googleRating: null`
- `googleCount: null`

---

## Local testing

### Frontend

```bash
python3 -m http.server 8080
```

Open:
- `http://localhost:8080/` (Apple-only)
- `http://localhost:8080/?google=on` (Apple + Google)

### Fetch script

```bash
APPLE_APP_ID=1234567890 GOOGLE_PLAY_PACKAGE_NAME=com.example.app node scripts/fetch-rating.mjs
```

---

## Data format (`ratings.json`)

`ratings.json` is an array sorted by date ascending. Each entry uses:

- `date` (UTC, `YYYY-MM-DD`)
- `appId`
- `appName`
- `iconUrl`
- `averageUserRating`
- `userRatingCount`
- `googleRating` (`number` or `null`)
- `googleCount` (`number` or `null`)

### Migration behavior

Existing Apple-only history is preserved. During script runs, older entries are normalized by adding:

- `googleRating: null`
- `googleCount: null`

No fake historical Google values are backfilled. Google history starts from first successful scrape.

---

## Troubleshooting

### 1) `ratings.json` is empty or chart doesn't render

- Confirm the workflow has run successfully at least once.
- Check the Actions log for script errors.
- Ensure `ratings.json` is valid JSON array format.

### 2) GitHub Action permission errors

- Ensure workflow includes `permissions: contents: write`.
- In repository settings, confirm Actions has permission to write to the repository.

### 3) GitHub Pages not updating

- Check **Actions** and **Pages** deployment status.
- Verify Pages source branch/folder points to your latest commit.
- Hard refresh the browser (or clear cache).

### 4) Apple lookup returns no result

- Verify `APPLE_APP_ID` is correct and numeric.
- Some apps may not expose rating fields in all storefronts.

### 5) Google rating/count missing

- Verify `GOOGLE_PLAY_PACKAGE_NAME` is correct.
- Google markup may have changed; parser patterns may need adjustment.
- If Google fails, Apple updates continue by design.
