const ISO2_RE = /^[a-z]{2}$/i;

const wrapper = document.getElementById('map-wrapper');
const mapContainer = document.getElementById('map-container');
const tooltip = document.getElementById('tooltip');
let svg = null;

let scale = 1, panX = 0, panY = 0;
let isDragging = false, dragMoved = false, startX = 0, startY = 0;

fetch('assets/world.svg')
  .then(res => res.text())
  .then(svgText => {
    mapContainer.innerHTML = svgText;
    svg = mapContainer.querySelector('svg');

    svg.querySelectorAll('title').forEach(el => el.remove());
    svg.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));

    if (!svg.getAttribute('viewBox')) {
      const origW = svg.getAttribute('width');
      const origH = svg.getAttribute('height');
      if (origW && origH && !origW.includes('%')) {
        svg.setAttribute('viewBox', `0 0 ${parseFloat(origW)} ${parseFloat(origH)}`);
      } else {
        const bbox = svg.getBBox();
        svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      }
    }

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';

    markAvailableCountries();
    initPanZoom();
    initHoverAndClick();
  })
  .catch(err => console.error('Error loading the SVG:', err));

function isCountryAvailable(code) {
  return Boolean(code && typeof countryData !== 'undefined' && countryData[code]);
}

function markAvailableCountries() {
  if (typeof countryData === 'undefined') return;
  Object.keys(countryData).forEach(code => {
    const elements = svg.querySelectorAll(`[id="${code.toLowerCase()}"], [id="${code.toUpperCase()}"]`);
    elements.forEach(el => el.classList.add('country-available'));
  });
}

function resolveCountryCode(target) {
  let el = target;
  while (el && el !== svg) {
    if (el.id && ISO2_RE.test(el.id)) return el.id.toLowerCase();
    el = el.parentElement;
  }
  return null;
}

function initHoverAndClick() {
  svg.addEventListener('mouseover', (e) => {
    const code = resolveCountryCode(e.target);
    if (!isCountryAvailable(code)) return;
    setHighlight(code, true);
    showTooltip(code);
  });

  svg.addEventListener('mouseout', (e) => {
    const code = resolveCountryCode(e.target);
    if (!code) return;
    setHighlight(code, false);
    tooltip.classList.remove('visible');
  });

  wrapper.addEventListener('mousemove', (e) => {
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
  });
}

function setHighlight(code, on) {
  const elements = svg.querySelectorAll(`[id="${code.toLowerCase()}"], [id="${code.toUpperCase()}"]`);
  elements.forEach(el => el.classList.toggle('hovered', on));
}

function showTooltip(code) {
  const info = countryData[code];
  if (!info) return;

  const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/1x1/${code}.svg`;

  tooltip.innerHTML = `
    <div class="tooltip-flag-box">
      <img src="${flagUrl}" alt="Drapeau ${info.name}" class="tooltip-flag">
    </div>
    <div class="tooltip-body">
      <span class="tooltip-title">${info.name}</span>
      <span class="tooltip-export">Largest exporter of ${info.export}</span>
      <span class="tooltip-production">${info.production}</span>
    </div>
  `;
  tooltip.classList.add('visible');
}

function updateTransform() {
  mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function clampPan() {
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  const minPanX = w * (1 - scale);
  const minPanY = h * (1 - scale);

  panX = clamp(panX, minPanX, 0);
  panY = clamp(panY, minPanY, 0);
}

function applyZoom(factor, clientX, clientY) {
  const prevScale = scale;
  const newScale = clamp(scale * factor, 1, 8);

  if (newScale === prevScale) return;

  if (newScale === 1) {
    scale = 1;
    panX = 0;
    panY = 0;
  } else {
    const rect = wrapper.getBoundingClientRect();
    const originX = clientX - rect.left;
    const originY = clientY - rect.top;
    const appliedFactor = newScale / prevScale;

    panX = originX - (originX - panX) * appliedFactor;
    panY = originY - (originY - panY) * appliedFactor;
    scale = newScale;
    clampPan();
  }

  updateTransform();
}

function initPanZoom() {
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    applyZoom(factor, e.clientX, e.clientY);
  }, { passive: false });

  wrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragMoved = false;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    mapContainer.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newPanX = e.clientX - startX;
    const newPanY = e.clientY - startY;

    if (Math.abs(newPanX - panX) > 4 || Math.abs(newPanY - panY) > 4) {
      dragMoved = true;
    }

    panX = newPanX;
    panY = newPanY;
    clampPan();
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    mapContainer.classList.remove('dragging');
  });

  document.getElementById('zoom-in').addEventListener('click', () => {
    const rect = wrapper.getBoundingClientRect();
    applyZoom(1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    const rect = wrapper.getBoundingClientRect();
    applyZoom(1 / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
}