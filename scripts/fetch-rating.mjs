import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ratingsFilePath = path.resolve(__dirname, '../ratings.json');

function getTodayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function pickArtworkUrl(result) {
  return (
    result.artworkUrl512 ||
    result.artworkUrl100 ||
    result.artworkUrl60 ||
    ''
  );
}

async function loadExistingRatings() {
  try {
    const fileContent = await readFile(ratingsFilePath, 'utf8');
    const parsed = JSON.parse(fileContent);
    if (!Array.isArray(parsed)) {
      throw new Error('ratings.json exists but is not an array.');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function normalizeAndSort(entries) {
  return entries
    .map((entry) => ({
      date: entry.date,
      appId: entry.appId,
      appName: entry.appName,
      iconUrl: entry.iconUrl,
      averageUserRating: entry.averageUserRating,
      userRatingCount: entry.userRatingCount,
      googleRating: entry.googleRating ?? null,
      googleCount: entry.googleCount ?? null
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchLatestRating(appId) {
  const endpoint = `https://itunes.apple.com/lookup?country=cz&id=${encodeURIComponent(appId)}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Apple lookup request failed with HTTP ${response.status}.`);
  }

  const body = await response.json();

  if (!body || typeof body !== 'object' || !Array.isArray(body.results)) {
    throw new Error('Apple lookup returned an unexpected payload format.');
  }

  if (!body.resultCount || !body.results.length) {
    throw new Error(`App not found for APPLE_APP_ID=${appId}.`);
  }

  const result = body.results[0];
  const averageUserRating = result.averageUserRating;
  const userRatingCount = result.userRatingCount;

  if (typeof averageUserRating !== 'number' || typeof userRatingCount !== 'number') {
    throw new Error(
      'Rating fields are unavailable for this app in the current storefront response.'
    );
  }

  const iconUrl = pickArtworkUrl(result);
  if (!iconUrl) {
    throw new Error('Artwork URL is missing in the Apple lookup response.');
  }

  return {
    trackId: result.trackId,
    trackName: result.trackName,
    iconUrl,
    averageUserRating,
    userRatingCount
  };
}

function parseCompactNumber(text) {
  const compact = text.replace(/,/g, '').trim();
  const match = compact.match(/^(\d+(?:\.\d+)?)([KMB])?$/i);
  if (!match) return null;

  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = (match[2] || '').toUpperCase();
  const multipliers = { '': 1, K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  const multiplier = multipliers[suffix];
  if (!multiplier) return null;

  return Math.round(base * multiplier);
}

function extractGoogleRating(html) {
  const match = html.match(/aria-label="Rated\s+([0-9]+(?:\.[0-9]+)?)\s+stars\s+out\s+of\s+five\s+stars"/i);
  if (!match) return null;

  const rating = Number.parseFloat(match[1]);
  return Number.isFinite(rating) ? rating : null;
}

function extractGoogleCount(html) {
  const reviewMatch = html.match(/>(\d+(?:[.,]\d+)?\s*[KMB]?)\s+reviews</i);
  if (!reviewMatch) return null;

  return parseCompactNumber(reviewMatch[1].replace(/\s+/g, ''));
}

async function fetchGooglePlaySnapshot(packageName) {
  const endpoint = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en&gl=CZ`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Google Play request failed with HTTP ${response.status}.`);
  }

  const html = await response.text();
  const googleRating = extractGoogleRating(html);
  const googleCount = extractGoogleCount(html);

  return { googleRating, googleCount };
}

async function main() {
  const appId = process.env.APPLE_APP_ID;
  if (!appId) {
    throw new Error('Missing APPLE_APP_ID environment variable.');
  }

  const googlePackageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!googlePackageName) {
    throw new Error('Missing GOOGLE_PLAY_PACKAGE_NAME environment variable.');
  }

  const latest = await fetchLatestRating(appId);
  const today = getTodayUtcDate();

  let googleSnapshot = { googleRating: null, googleCount: null };
  try {
    googleSnapshot = await fetchGooglePlaySnapshot(googlePackageName);
    if (googleSnapshot.googleRating === null || googleSnapshot.googleCount === null) {
      console.warn('Google Play data could not be fully parsed for CZ (gl=CZ). Falling back to null values.');
      googleSnapshot = { googleRating: null, googleCount: null };
    }
  } catch (error) {
    console.warn(`Google Play scrape failed: ${error.message}`);
  }

  const existing = normalizeAndSort(await loadExistingRatings());
  const withoutToday = existing.filter((entry) => entry.date !== today);

  const snapshot = {
    date: today,
    appId: latest.trackId ?? Number(appId),
    appName: latest.trackName,
    iconUrl: latest.iconUrl,
    averageUserRating: latest.averageUserRating,
    userRatingCount: latest.userRatingCount,
    googleRating: googleSnapshot.googleRating,
    googleCount: googleSnapshot.googleCount
  };

  const updated = normalizeAndSort([...withoutToday, snapshot]);
  await writeFile(ratingsFilePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  console.log(`Updated ratings.json with snapshot for ${today}.`);
}

main().catch((error) => {
  console.error(`Failed to update ratings: ${error.message}`);
  process.exit(1);
});
