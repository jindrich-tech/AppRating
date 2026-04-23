# AppRating

AppRating is a lightweight GitHub Pages dashboard that tracks one iOS app's public App Store rating metrics over time.

It uses:
- **Static frontend** (HTML/CSS/vanilla JS + Chart.js)
- **Daily GitHub Actions automation** to fetch fresh rating data
- **`ratings.json` committed in-repo** as the historical store

No backend server is required.

---

## Quick start

1. Fork or create a repository with these project files.
2. Set your app ID in GitHub Actions secrets as `APPLE_APP_ID` (example: `1234567890`).
3. Enable the workflow in **Actions**.
4. Run **Update App Ratings** once via **Run workflow**.
5. Enable GitHub Pages from the repository root.
6. Open your Pages URL to view the dashboard.

---

## How it works

- `scripts/fetch-rating.mjs` calls Apple's iTunes Lookup API using `APPLE_APP_ID`.
- It upserts **one snapshot per UTC date** into `ratings.json`.
- `.github/workflows/update-ratings.yml` runs daily and commits `ratings.json` only when changed.
- `index.html` + `app.js` loads `./ratings.json` and draws charts for the most recent 30 entries.

### Historical data limitation

App Store lookup returns current aggregate values, not historical daily values. That means historical trend data starts accumulating **from the day your workflow first runs**.

---

## Configuration

### Set APPLE_APP_ID

Recommended: set as repository secret.

1. Go to **Settings → Secrets and variables → Actions**.
2. Create a new **Repository secret**:
   - Name: `APPLE_APP_ID`
   - Value: your numeric iOS app ID

> You can also store it as a repository variable, but this workflow reads from secrets by default.

### Customize chart title and colors

In `app.js`, update the `CONFIG` object near the top:

- `dashboardTitle`
- `chartColors.ratingLine`
- `chartColors.ratingFill`
- `chartColors.countLine`
- `chartColors.countFill`

---

## Enable GitHub Pages

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch), folder `/ (root)`
3. Save, then wait for deployment.

---

## Local testing

### Frontend

Serve the repository root with any static server (recommended to avoid local file CORS issues):

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

### Fetch script

Run manually:

```bash
APPLE_APP_ID=1234567890 node scripts/fetch-rating.mjs
```

This updates `ratings.json` for today's UTC date.

---

## Data format (`ratings.json`)

`ratings.json` is an array sorted by date ascending. Each entry:

- `date` (UTC, `YYYY-MM-DD`)
- `appId`
- `appName`
- `iconUrl`
- `averageUserRating`
- `userRatingCount`

The fetch script is idempotent for the current UTC day: if today's record exists, it is replaced.

---

## Troubleshooting

### 1) `ratings.json` is empty or chart doesn't render

- Confirm the workflow has run successfully at least once.
- Check the Actions log for script errors.
- Ensure `ratings.json` is valid JSON array format.
- UI will show a friendly error if data is missing or malformed.

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
- Re-run manually after confirming app is publicly available on the App Store.

---

## Extending later

This project is intentionally structured so it can be extended to support multiple apps later (for example, by storing separate JSON files per app or adding `appId` filtering in the frontend).
