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
      userRatingCount: entry.userRatingCount
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchLatestRating(appId) {
  const endpoint = `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}`;
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

async function main() {
  const appId = process.env.APPLE_APP_ID;
  if (!appId) {
    throw new Error('Missing APPLE_APP_ID environment variable.');
  }

  const latest = await fetchLatestRating(appId);
  const today = getTodayUtcDate();

  const existing = await loadExistingRatings();
  const withoutToday = existing.filter((entry) => entry.date !== today);

  const snapshot = {
    date: today,
    appId: latest.trackId ?? Number(appId),
    appName: latest.trackName,
    iconUrl: latest.iconUrl,
    averageUserRating: latest.averageUserRating,
    userRatingCount: latest.userRatingCount
  };

  const updated = normalizeAndSort([...withoutToday, snapshot]);
  await writeFile(ratingsFilePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  console.log(`Updated ratings.json with snapshot for ${today}.`);
}

main().catch((error) => {
  console.error(`Failed to update ratings: ${error.message}`);
  process.exit(1);
});
