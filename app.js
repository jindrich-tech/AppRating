const isGoogleMode = new URLSearchParams(window.location.search).get('google') === 'on';

const CONFIG = {
  dashboardTitle: 'App Store Rating Trend (Last 30 Days)',
  chartColors: {
    appleRatingLine: '#22c55e',
    appleCountLine: '#60a5fa',
    googleRatingLine: '#f59e0b',
    googleCountLine: '#a78bfa'
  }
};

const numberFormat = new Intl.NumberFormat('en-US');
const decimalFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const axisDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const el = {
  appIcon: document.getElementById('app-icon'),
  appName: document.getElementById('app-name'),
  latestRating: document.getElementById('latest-rating'),
  latestCount: document.getElementById('latest-count'),
  latestGoogleRatingRow: document.getElementById('latest-google-rating-row'),
  latestGoogleCountRow: document.getElementById('latest-google-count-row'),
  latestGoogleRating: document.getElementById('latest-google-rating'),
  latestGoogleCount: document.getElementById('latest-google-count'),
  lastUpdated: document.getElementById('last-updated'),
  latestRatingLabel: document.querySelector('dd#latest-rating')?.previousElementSibling,
  latestCountLabel: document.querySelector('dd#latest-count')?.previousElementSibling,
  summaryHeading: document.querySelector('.summary-panel h2'),
  pageHeading: document.querySelector('.page-header h1'),
  pageSubtitle: document.querySelector('.page-header .subtitle'),
  rating7d: document.getElementById('rating-change-7d'),
  rating30d: document.getElementById('rating-change-30d'),
  count7d: document.getElementById('count-change-7d'),
  count30d: document.getElementById('count-change-30d'),
  chartTitle: document.getElementById('chart-title'),
  chartCanvas: document.getElementById('rating-chart'),
  chartEmptyState: document.getElementById('chart-empty-state'),
  chartWrapper: document.getElementById('rating-chart-wrapper'),
  errorBanner: document.getElementById('error-banner'),
  showRatingBtn: document.getElementById('show-rating'),
  showCountBtn: document.getElementById('show-count')
};

let chart;
let chartMode = 'rating';
let latestData = [];

function showError(message) { el.errorBanner.textContent = message; el.errorBanner.classList.remove('hidden'); }
function clearError() { el.errorBanner.textContent = ''; el.errorBanner.classList.add('hidden'); }

function updateSummaryValue(node, value, isCount = false) {
  node.classList.remove('is-positive', 'is-negative');
  if (value === null) { node.textContent = '—'; return; }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absValue = Math.abs(value);
  node.textContent = isCount ? `${sign}${numberFormat.format(absValue)}` : `${sign}${decimalFormat.format(absValue)}`;
  if (value > 0) node.classList.add('is-positive');
  if (value < 0) node.classList.add('is-negative');
}

function renderStoreSummaryPanel(panel, title, changes) {
  const heading = panel.querySelector('h2');
  const values = panel.querySelectorAll('.summary-value');
  if (heading) heading.textContent = title;
  updateSummaryValue(values[0], changes.rating7d);
  updateSummaryValue(values[1], changes.rating30d);
  updateSummaryValue(values[2], changes.count7d, true);
  updateSummaryValue(values[3], changes.count30d, true);
}

function computeChange(data, offset, key) {
  const latest = data[data.length - 1];
  const index = data.length - 1 - offset;
  if (!latest || index < 0 || typeof latest[key] !== 'number' || typeof data[index][key] !== 'number') return null;
  return latest[key] - data[index][key];
}

function parseRatings(raw) {
  if (!Array.isArray(raw)) throw new Error('ratings.json must contain an array of entries.');

  const normalized = raw.map((entry) => {
    const { date, appId, appName, iconUrl, averageUserRating, userRatingCount, googleRating = null, googleCount = null } = entry || {};
    if (
      typeof date !== 'string' ||
      (typeof appId !== 'number' && typeof appId !== 'string') ||
      typeof appName !== 'string' ||
      typeof iconUrl !== 'string' ||
      typeof averageUserRating !== 'number' ||
      typeof userRatingCount !== 'number' ||
      (googleRating !== null && typeof googleRating !== 'number') ||
      (googleCount !== null && typeof googleCount !== 'number')
    ) {
      throw new Error('ratings.json has malformed entries.');
    }
    return { date, appId: String(appId), appName, iconUrl, averageUserRating, userRatingCount, googleRating, googleCount };
  });

  return normalized.sort((a, b) => a.date.localeCompare(b.date));
}

const parseUtcDate = (value) => { const date = new Date(`${value}T00:00:00Z`); return Number.isNaN(date.valueOf()) ? null : date; };
const formatUtcDate = (value) => { const date = parseUtcDate(value); return date ? dateFormat.format(date) : value; };
const formatAxisDate = (value) => { const date = parseUtcDate(value); return date ? axisDateFormat.format(date) : value; };

function updateHeader(data) {
  const latest = data[data.length - 1];
  el.appName.textContent = latest.appName;
  el.appIcon.src = latest.iconUrl;
  el.appIcon.alt = `${latest.appName} icon`;
  el.latestRating.textContent = decimalFormat.format(latest.averageUserRating);
  el.latestCount.textContent = numberFormat.format(latest.userRatingCount);
  el.lastUpdated.textContent = formatUtcDate(latest.date);

  if (isGoogleMode) {
    if (el.pageHeading) el.pageHeading.textContent = 'AppRating';
    if (el.pageSubtitle) el.pageSubtitle.textContent = 'App rating trend for CZ region';
    if (el.latestRatingLabel) el.latestRatingLabel.textContent = 'App Store Rating';
    if (el.latestCountLabel) el.latestCountLabel.textContent = 'App Store Count';
    el.latestGoogleRatingRow.classList.remove('hidden');
    el.latestGoogleCountRow.classList.remove('hidden');
    el.latestGoogleRating.textContent = latest.googleRating === null ? '—' : decimalFormat.format(latest.googleRating);
    el.latestGoogleCount.textContent = latest.googleCount === null ? '—' : numberFormat.format(latest.googleCount);
  }
}

function buildDatasets(mode) {
  const labels = latestData.map((entry) => formatAxisDate(entry.date));
  if (mode === 'count') {
    const datasets = [{ label: 'Apple App Store count', values: latestData.map((entry) => entry.userRatingCount), borderColor: CONFIG.chartColors.appleCountLine }];
    if (isGoogleMode) datasets.push({ label: 'Google Play count', values: latestData.map((entry) => entry.googleCount), borderColor: CONFIG.chartColors.googleCountLine });
    return { labels, datasets };
  }
  const datasets = [{ label: 'Apple App Store rating', values: latestData.map((entry) => entry.averageUserRating), borderColor: CONFIG.chartColors.appleRatingLine }];
  if (isGoogleMode) datasets.push({ label: 'Google Play rating', values: latestData.map((entry) => entry.googleRating), borderColor: CONFIG.chartColors.googleRatingLine });
  return { labels, datasets };
}

function renderChart(mode = 'rating') {
  const data = buildDatasets(mode);
  if (chart) chart.destroy();

  chart = new Chart(el.chartCanvas, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: data.datasets.map((set) => ({
        label: set.label,
        data: set.values,
        borderColor: set.borderColor,
        fill: false,
        tension: 0.25,
        pointRadius: 3,
        pointHoverRadius: 5,
        spanGaps: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          min: mode === 'count' ? 1600 : 0,
          max: mode === 'rating' ? 5 : undefined,
          ticks: {
            callback(value) {
              return mode === 'count' ? numberFormat.format(value) : decimalFormat.format(value);
            }
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              if (value === null || value === undefined) return `${context.dataset.label}: —`;
              return mode === 'count' ? `${context.dataset.label}: ${numberFormat.format(value)}` : `${context.dataset.label}: ${decimalFormat.format(value)}`;
            }
          }
        }
      }
    }
  });
}

function updateSummaries(data) {
  const appleChanges = {
    rating7d: computeChange(data, 7, 'averageUserRating'),
    rating30d: computeChange(data, 30, 'averageUserRating'),
    count7d: computeChange(data, 7, 'userRatingCount'),
    count30d: computeChange(data, 30, 'userRatingCount')
  };

  if (isGoogleMode) {
    renderStoreSummaryPanel(document.querySelector('.summary-panel'), 'App Store Change Summary', appleChanges);

    const googlePanel = document.querySelector('.summary-panel').cloneNode(true);
    renderStoreSummaryPanel(googlePanel, 'Google Play Change Summary', {
      rating7d: computeChange(data, 7, 'googleRating'),
      rating30d: computeChange(data, 30, 'googleRating'),
      count7d: computeChange(data, 7, 'googleCount'),
      count30d: computeChange(data, 30, 'googleCount')
    });

    document.querySelector('.summary-panel').after(googlePanel);
    return;
  }

  updateSummaryValue(el.rating7d, appleChanges.rating7d);
  updateSummaryValue(el.rating30d, appleChanges.rating30d);
  updateSummaryValue(el.count7d, appleChanges.count7d, true);
  updateSummaryValue(el.count30d, appleChanges.count30d, true);
}

function setMode(mode) { chartMode = mode; el.showRatingBtn.classList.toggle('is-active', mode === 'rating'); el.showCountBtn.classList.toggle('is-active', mode === 'count'); el.showRatingBtn.setAttribute('aria-selected', String(mode === 'rating')); el.showCountBtn.setAttribute('aria-selected', String(mode === 'count')); renderChart(mode); }
function showEmptyState(message) { el.chartWrapper.classList.add('hidden'); el.chartEmptyState.textContent = message; el.chartEmptyState.classList.remove('hidden'); }
function hideEmptyState() { el.chartWrapper.classList.remove('hidden'); el.chartEmptyState.textContent = ''; el.chartEmptyState.classList.add('hidden'); }

async function init() {
  el.chartTitle.textContent = isGoogleMode ? 'Rating trend' : CONFIG.dashboardTitle;
  clearError();

  try {
    const response = await fetch('./ratings.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load ratings.json (HTTP ${response.status}).`);
    const parsed = parseRatings(await response.json());

    if (!parsed.length) {
      showEmptyState('No rating snapshots yet. After the first GitHub Action run, data will appear here.');
      el.appName.textContent = 'No data yet';
      return;
    }

    updateHeader(parsed);
    updateSummaries(parsed);
    latestData = parsed.slice(-30);

    if (latestData.length < 2) {
      showEmptyState('At least 2 data points are needed to draw a trend chart.');
      return;
    }

    hideEmptyState();
    setMode(chartMode);
  } catch (error) {
    console.error(error);
    showEmptyState('Could not render chart data.');
    showError(`Dashboard error: ${error.message} Please verify ratings.json exists and has valid JSON entries.`);
    el.appName.textContent = 'Unable to load dashboard data';
  }
}

el.showRatingBtn.addEventListener('click', () => setMode('rating'));
el.showCountBtn.addEventListener('click', () => setMode('count'));

init();
