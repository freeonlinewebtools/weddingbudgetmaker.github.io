const categories = [
  { key: 'venue', name: 'Venue & Rentals', tip: 'Venue is often the largest expense. Book early for better rates.' },
  { key: 'catering', name: 'Catering & Bar', tip: 'Per-person catering costs scale quickly with guest count.' },
  { key: 'photo', name: 'Photography & Video', tip: 'Allocate enough for experienced professionals and full-day coverage.' },
  { key: 'music', name: 'Music & Entertainment', tip: 'DJ is usually cheaper; live bands cost more but elevate the event.' },
  { key: 'flowers', name: 'Flowers & Decor', tip: 'In-season flowers can significantly reduce costs.' },
  { key: 'attire', name: 'Wedding Attire', tip: 'Include accessories, tailoring, and shoes in this category.' },
  { key: 'stationery', name: 'Invitations & Stationery', tip: 'Digital RSVPs can reduce print and postage expenses.' },
  { key: 'transport', name: 'Transportation', tip: 'Add buffer for guest shuttles and late-night return trips.' },
  { key: 'planner', name: 'Wedding Planner', tip: 'A planner can prevent costly mistakes and save time.' },
  { key: 'misc', name: 'Miscellaneous / Buffer', tip: 'Keep at least 5% as contingency for unexpected costs.' }
];

const sizeProfiles = {
  intimate: [34, 19, 11, 6, 7, 6, 3, 3, 4, 7],
  medium: [35, 20, 10, 7, 7, 5, 3, 3, 5, 5],
  large: [37, 21, 9, 7, 6, 5, 3, 3, 5, 4],
  grand: [40, 22, 8, 7, 6, 4, 3, 3, 4, 3]
};

const currencySymbols = { USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$' };

const state = {
  total: 25000,
  currency: 'USD',
  size: 'medium',
  percentages: [...sizeProfiles.medium],
  chart: null
};

const STORAGE_KEY = 'wedbudget-state-v1';

const totalBudgetInput = document.getElementById('totalBudget');
const currencyInput = document.getElementById('currency');
const sizeInput = document.getElementById('weddingSize');
const resultsSection = document.getElementById('resultsSection');
const list = document.getElementById('categoryList');

function formatMoney(amount) {
  const symbol = currencySymbols[state.currency] || '$';
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

function buildCategoryList() {
  list.innerHTML = '';
  categories.forEach((cat, index) => {
    const amount = (state.total * state.percentages[index]) / 100;
    const row = document.createElement('div');
    row.className = 'category-item';
    row.innerHTML = `
      <div class="category-head">
        <span class="category-name">${cat.name}</span>
        <span class="category-meta" id="meta-${cat.key}">${state.percentages[index].toFixed(1)}% · ${formatMoney(amount)}</span>
      </div>
      <input type="range" min="0" max="70" step="0.5" value="${state.percentages[index]}" data-index="${index}" />
      <div class="tip">${cat.tip}</div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.addEventListener('input', onSliderChange);
  });
}

function rebalancePercentages(changedIndex, newValue) {
  const oldValue = state.percentages[changedIndex];
  const diff = newValue - oldValue;
  const otherIndices = state.percentages.map((_, i) => i).filter((i) => i !== changedIndex);
  const otherTotal = otherIndices.reduce((acc, i) => acc + state.percentages[i], 0);

  if (otherTotal <= 0 && diff > 0) return;

  state.percentages[changedIndex] = newValue;

  otherIndices.forEach((i) => {
    const share = otherTotal === 0 ? 1 / otherIndices.length : state.percentages[i] / otherTotal;
    state.percentages[i] = Math.max(0, state.percentages[i] - diff * share);
  });

  let sum = state.percentages.reduce((a, b) => a + b, 0);
  const correction = 100 - sum;
  state.percentages[changedIndex] += correction;
}

function onSliderChange(event) {
  const index = Number(event.target.dataset.index);
  const newValue = Number(event.target.value);
  rebalancePercentages(index, newValue);
  renderResults();
}

function renderChart() {
  const ctx = document.getElementById('budgetChart');
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map((c) => c.name),
      datasets: [{
        data: state.percentages,
        backgroundColor: ['#E8B4B8', '#C9A96E', '#F5D0D6', '#DABFA0', '#F2C2CB', '#BFA479', '#EBC9CF', '#D7B68F', '#F4DCE0', '#E6D7BE'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderResults() {
  resultsSection.hidden = false;
  buildCategoryList();
  renderChart();

  categories.forEach((cat, index) => {
    const amount = (state.total * state.percentages[index]) / 100;
    const meta = document.getElementById(`meta-${cat.key}`);
    if (meta) meta.textContent = `${state.percentages[index].toFixed(1)}% · ${formatMoney(amount)}`;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    total: state.total,
    currency: state.currency,
    size: state.size,
    percentages: state.percentages
  }));
}

function getShareUrl() {
  const params = new URLSearchParams();
  params.set('total', String(state.total));
  params.set('currency', state.currency);
  params.set('size', state.size);
  params.set('p', state.percentages.map((n) => n.toFixed(2)).join(','));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function hydrateFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.has('total')) return;
  const total = Number(params.get('total'));
  const currency = params.get('currency');
  const size = params.get('size');
  const raw = (params.get('p') || '').split(',').map(Number);
  if (!Number.isNaN(total) && total > 0) state.total = total;
  if (currencySymbols[currency]) state.currency = currency;
  if (sizeProfiles[size]) state.size = size;
  if (raw.length === categories.length && raw.every((n) => Number.isFinite(n))) {
    state.percentages = raw;
  } else {
    state.percentages = [...sizeProfiles[state.size]];
  }

  totalBudgetInput.value = state.total;
  currencyInput.value = state.currency;
  sizeInput.value = state.size;
  renderResults();
}

function hydrateFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed.total) && parsed.total > 0) state.total = parsed.total;
    if (currencySymbols[parsed.currency]) state.currency = parsed.currency;
    if (sizeProfiles[parsed.size]) state.size = parsed.size;
    if (Array.isArray(parsed.percentages) && parsed.percentages.length === categories.length) {
      state.percentages = parsed.percentages.map((n) => Number(n));
    }
    totalBudgetInput.value = state.total;
    currencyInput.value = state.currency;
    sizeInput.value = state.size;
    renderResults();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

document.getElementById('calculateBtn').addEventListener('click', () => {
  const total = Number(totalBudgetInput.value || 0);
  if (!total || total < 100) {
    totalBudgetInput.focus();
    return;
  }
  state.total = total;
  state.currency = currencyInput.value;
  state.size = sizeInput.value;
  state.percentages = [...sizeProfiles[state.size]];
  renderResults();
});

document.getElementById('shareBtn').addEventListener('click', async () => {
  const url = getShareUrl();
  await navigator.clipboard.writeText(url);
  alert('Share link copied.');
});

document.getElementById('printBtn').addEventListener('click', () => window.print());

document.getElementById('resetBtn').addEventListener('click', () => {
  state.total = 25000;
  state.currency = 'USD';
  state.size = 'medium';
  state.percentages = [...sizeProfiles.medium];
  totalBudgetInput.value = state.total;
  currencyInput.value = state.currency;
  sizeInput.value = state.size;
  localStorage.removeItem(STORAGE_KEY);
  renderResults();
});

sizeInput.addEventListener('change', () => {
  state.size = sizeInput.value;
  state.percentages = [...sizeProfiles[state.size]];
  if (!resultsSection.hidden) renderResults();
});

hydrateFromUrl();
if (resultsSection.hidden) hydrateFromStorage();
