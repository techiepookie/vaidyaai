/**
 * @file maps.js
 * @description Leaflet.js + OpenStreetMap clinic finder (no API key required).
 *
 * Uses Leaflet.js (open-source, MIT) with OpenStreetMap tiles.
 * No Google Maps API key needed — loads instantly, always works.
 */

// ─── Sample clinic data (Bangalore) ─────────────────────────────────
const SAMPLE_CLINICS = [
  {
    id: 1, name: 'Apollo Clinic',
    type: 'Multi-specialty', address: '12 MG Road, Bangalore',
    lat: 12.9716, lng: 77.5946, hours: 'Mon–Sat 8am–9pm',
    phone: '+91 80 4242 4242', rating: 4.8,
  },
  {
    id: 2, name: 'Fortis Healthcare',
    type: 'Hospital', address: '14 Cunningham Rd, Bangalore',
    lat: 12.9830, lng: 77.5984, hours: 'Open 24/7',
    phone: '+91 80 6621 4444', rating: 4.7,
  },
  {
    id: 3, name: 'Manipal Hospital',
    type: 'Hospital', address: '98 HAL Airport Rd, Bangalore',
    lat: 12.9592, lng: 77.6487, hours: 'Open 24/7',
    phone: '+91 80 2502 4444', rating: 4.6,
  },
  {
    id: 4, name: 'Columbia Asia Hospital',
    type: 'Multi-specialty', address: 'Kirloskar Business Park, Bangalore',
    lat: 13.0012, lng: 77.5636, hours: 'Open 24/7',
    phone: '+91 80 7179 3333', rating: 4.5,
  },
  {
    id: 5, name: 'Narayana Health City',
    type: 'Super-specialty', address: '258/A Bommasandra, Bangalore',
    lat: 12.8201, lng: 77.6762, hours: 'Mon–Sat 7am–8pm',
    phone: '+91 80 7122 2200', rating: 4.9,
  },
  {
    id: 6, name: 'Sakra World Hospital',
    type: 'Multi-specialty', address: 'Devarabisanahalli, Marathahalli, Bangalore',
    lat: 12.9481, lng: 77.7003, hours: 'Open 24/7',
    phone: '+91 80 4969 4969', rating: 4.7,
  },
  {
    id: 7, name: 'Kidwai Cancer Institute',
    type: 'Specialty — Oncology', address: 'Dr M H Marigowda Rd, Bangalore',
    lat: 12.9305, lng: 77.5926, hours: 'Mon–Fri 8am–5pm',
    phone: '+91 80 2656 0203', rating: 4.6,
  },
  {
    id: 8, name: 'St. John\'s Medical Hospital',
    type: 'Teaching Hospital', address: 'Sarjapur Rd, Bangalore',
    lat: 12.9255, lng: 77.6202, hours: 'Open 24/7',
    phone: '+91 80 2206 5000', rating: 4.5,
  },
];

let _mapInitialised = false;
let _map = null;
let _markers = {};

/**
 * Lazy-initialise Leaflet map and render clinic pins.
 * Safe to call multiple times — only loads once.
 */
export async function initClinicFinder() {
  renderClinicList();
  if (_mapInitialised) return;
  _mapInitialised = true;

  try {
    await loadLeaflet();
    renderLeafletMap();
  } catch (err) {
    console.error('[maps] Leaflet load error:', err.message);
    renderMapError();
  }
}

// ─── Clinic list (left panel) ────────────────────────────────────────

function renderClinicList() {
  const list = document.getElementById('clinic-list');
  if (!list) return;

  list.innerHTML = '';
  SAMPLE_CLINICS.forEach(clinic => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'clinic-item';
    item.setAttribute('aria-label', `${clinic.name}, ${clinic.type}`);
    item.dataset.clinicId = String(clinic.id);

    const stars = '★'.repeat(Math.round(clinic.rating)) + '☆'.repeat(5 - Math.round(clinic.rating));

    item.innerHTML = `
      <div class="clinic-item__name">${escapeHtml(clinic.name)}</div>
      <div class="clinic-item__type">${escapeHtml(clinic.type)}</div>
      <div class="clinic-item__address">${escapeHtml(clinic.address)}</div>
      <div class="clinic-item__meta">
        <span class="clinic-item__hours">${escapeHtml(clinic.hours)}</span>
        <span class="clinic-item__rating" title="${clinic.rating} / 5">${stars} ${clinic.rating}</span>
      </div>`;

    item.addEventListener('click', () => selectClinic(clinic.id));
    list.appendChild(item);
  });

  // Auto-select first
  selectClinic(SAMPLE_CLINICS[0].id);
}

function selectClinic(id) {
  document.querySelectorAll('.clinic-item').forEach(el => {
    el.setAttribute('data-selected', String(el.dataset.clinicId === String(id)));
  });

  if (_map) {
    const clinic = SAMPLE_CLINICS.find(c => c.id === id);
    if (clinic) {
      _map.setView([clinic.lat, clinic.lng], 15, { animate: true });
      _markers[id]?.openPopup();
    }
  }
}

// ─── Leaflet loader ───────────────────────────────────────────────────

async function loadLeaflet() {
  if (window.L) return;

  // Load Leaflet CSS
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // Load Leaflet JS
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Leaflet script failed to load.'));
    document.head.appendChild(script);
  });
}

// ─── Map render ───────────────────────────────────────────────────────

function renderLeafletMap() {
  const container = document.getElementById('clinic-map-container');
  if (!container || !window.L) { renderMapError(); return; }

  // Create map div inside the container
  container.innerHTML = '<div id="clinic-map" style="width:100%;height:100%;min-height:420px"></div>';
  const mapEl = document.getElementById('clinic-map');

  _map = window.L.map(mapEl, {
    center: [12.9716, 77.5946],
    zoom: 12,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // OpenStreetMap tile layer — no API key required
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(_map);

  // Custom icon using SVG (brutalist red dot)
  const clinicIcon = window.L.divIcon({
    className: '',
    html: `<div style="
      width: 24px; height: 24px;
      background: #C8302A;
      border: 3px solid #0A0A0A;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      cursor: pointer;
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  });

  // Add markers for each clinic
  SAMPLE_CLINICS.forEach(clinic => {
    const popup = window.L.popup({
      maxWidth: 240,
      className: 'leaflet-brutalist-popup',
    }).setContent(`
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.6">
        <strong style="font-size:13px;display:block;margin-bottom:4px">${escapeHtml(clinic.name)}</strong>
        <span style="color:#C8302A;display:block">${escapeHtml(clinic.type)}</span>
        <span style="color:#6B6860;display:block">${escapeHtml(clinic.address)}</span>
        <span style="display:block;margin-top:4px">${escapeHtml(clinic.hours)}</span>
        <a href="tel:${clinic.phone}" style="color:#C8302A;display:block;margin-top:4px">${clinic.phone}</a>
      </div>
    `);

    const marker = window.L.marker([clinic.lat, clinic.lng], { icon: clinicIcon })
      .addTo(_map)
      .bindPopup(popup);

    marker.on('click', () => selectClinic(clinic.id));
    _markers[clinic.id] = marker;
  });

  // Open popup for first clinic
  _markers[1]?.openPopup();
}

function renderMapError() {
  const container = document.getElementById('clinic-map-container');
  if (!container) return;
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:300px;
      font-family:'IBM Plex Mono',monospace;font-size:0.8rem;color:var(--c-grey-500);text-align:center;padding:2rem">
      <div>
        <div style="font-size:2rem;opacity:0.25;margin-bottom:1rem">[ MAP ]</div>
        <div style="font-weight:700;margin-bottom:0.5rem">Map temporarily unavailable</div>
        <div>Check your internet connection</div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
