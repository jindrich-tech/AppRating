const CONFIG = {
  dashboardTitle: 'App Store Rating Trend (Last 30 Days)',
  chartColors: {
    ratingLine: '#22c55e',
    ratingFill: 'rgba(34, 197, 94, 0.18)',
    countLine: '#60a5fa',
    countFill: 'rgba(96, 165, 250, 0.2)'
  }
};

const numberFormat = new Intl.NumberFormat('en-US');
const decimalFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const el = {
  appIcon: document.getElementById('app-icon'),
  appName: document.getElementById('app-name'),
  latestRating: document.getElementById('latest-rating'),
  latestCount: document.getElementById('latest-count'),
  lastUpdated: document.getElementById('last-updated'),
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

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.classList.remove('hidden');
}

function clearError() {
  el.errorBanner.textContent = '';
  el.errorBanner.classList.add('hidden');
}

function updateSummaryValue(node, value, isCount = false) {
  node.classList.remove('is-positive', 'is-negative');

  if (value === null) {
    node.textContent = '—';
    return;
  }

  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absValue = Math.abs(value);
  node.textContent = isCount
    ? `${sign}${numberFormat.format(absValue)}`
    : `${sign}${decimalFormat.format(absValue)}`;

  if (value > 0) node.classList.add('is-positive');
  if (value < 0) node.classList.add('is-negative');
}

function computeChange(data, offset, key) {
  const latest = data[data.length - 1];
  const index = data.length - 1 - offset;
  if (!latest || index < 0) return null;
  return latest[key] - data[index][key];
}

function parseRatings(raw) {
  if (!Array.isArray(raw)) {
    throw new Error('ratings.json must contain an array of entries.');
  }

  const normalized = raw.map((entry) => {
    const {
      date,
      appId,
      appName,
      iconUrl,
      averageUserRating,
      userRatingCount
    } = entry || {};

    if (
      typeof date !== 'string' ||
      (typeof appId !== 'number' && typeof appId !== 'string') ||
      typeof appName !== 'string' ||
      typeof iconUrl !== 'string' ||
      typeof averageUserRating !== 'number' ||
      typeof userRatingCount !== 'number'
    ) {
      throw new Error('ratings.json has malformed entries.');
    }

    return {
      date,
      appId: String(appId),
      appName,
      iconUrl,
      averageUserRating,
      userRatingCount
    };
  });

  return normalized.sort((a, b) => a.date.localeCompare(b.date));
}

function formatUtcDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? value : dateFormat.format(date);
}

function updateHeader(data) {
  const latest = data[data.length - 1];
  el.appName.textContent = latest.appName;
  el.appIcon.src = latest.iconUrl;
  el.appIcon.alt = `${latest.appName} icon`;
  el.latestRating.textContent = decimalFormat.format(latest.averageUserRating);
  el.latestCount.textContent = numberFormat.format(latest.userRatingCount);
  el.lastUpdated.textContent = formatUtcDate(latest.date);
}

function buildDatasets(mode) {
  const labels = latestData.map((entry) => formatUtcDate(entry.date));
  if (mode === 'count') {
    return {
      labels,
      label: 'Rating count',
      values: latestData.map((entry) => entry.userRatingCount),
      borderColor: CONFIG.chartColors.countLine,
      backgroundColor: CONFIG.chartColors.countFill
    };
  }

  return {
    labels,
    label: 'Average rating',
    values: latestData.map((entry) => entry.averageUserRating),
    borderColor: CONFIG.chartColors.ratingLine,
    backgroundColor: CONFIG.chartColors.ratingFill
  };
}

function renderChart(mode = 'rating') {
  const dataset = buildDatasets(mode);
  if (chart) chart.destroy();

  chart = new Chart(el.chartCanvas, {
    type: 'line',
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: dataset.label,
          data: dataset.values,
          borderColor: dataset.borderColor,
          backgroundColor: dataset.backgroundColor,
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          ticks: {
            callback(value) {
              return mode === 'count' ? numberFormat.format(value) : decimalFormat.format(value);
            }
          }
        }
      },
      plugins: {
        legend: { labels: { color: '#e5e7eb' } },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              return mode === 'count'
                ? `Rating count: ${numberFormat.format(value)}`
                : `Average rating: ${decimalFormat.format(value)}`;
            }
          }
        }
      }
    }
  });
}

function updateSummaries(data) {
  updateSummaryValue(el.rating7d, computeChange(data, 7, 'averageUserRating'));
  updateSummaryValue(el.rating30d, computeChange(data, 30, 'averageUserRating'));
  updateSummaryValue(el.count7d, computeChange(data, 7, 'userRatingCount'), true);
  updateSummaryValue(el.count30d, computeChange(data, 30, 'userRatingCount'), true);
}

function setMode(mode) {
  chartMode = mode;
  el.showRatingBtn.classList.toggle('is-active', mode === 'rating');
  el.showCountBtn.classList.toggle('is-active', mode === 'count');
  el.showRatingBtn.setAttribute('aria-selected', String(mode === 'rating'));
  el.showCountBtn.setAttribute('aria-selected', String(mode === 'count'));
  renderChart(mode);
}

function showEmptyState(message) {
  el.chartWrapper.classList.add('hidden');
  el.chartEmptyState.textContent = message;
  el.chartEmptyState.classList.remove('hidden');
}

function hideEmptyState() {
  el.chartWrapper.classList.remove('hidden');
  el.chartEmptyState.textContent = '';
  el.chartEmptyState.classList.add('hidden');
}

async function init() {
  el.chartTitle.textContent = CONFIG.dashboardTitle;
  clearError();

  try {
    const response = await fetch('./ratings.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load ratings.json (HTTP ${response.status}).`);
    }

    const raw = await response.json();
    const parsed = parseRatings(raw);

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
    showError(
      `Dashboard error: ${error.message} Please verify ratings.json exists and has valid JSON entries.`
    );
    el.appName.textContent = 'Unable to load dashboard data';
  }
}

el.showRatingBtn.addEventListener('click', () => setMode('rating'));
el.showCountBtn.addEventListener('click', () => setMode('count'));

init();
