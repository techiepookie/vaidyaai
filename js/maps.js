/**
 * @file maps.js
 * @description Google Maps lazy-initialisation for the Clinic Finder tab.
 *
 * The Maps API is loaded only when the Clinic Finder tab is activated,
 * preventing unnecessary script loading on initial page load.
 */

import { MAPS_API_KEY } from './config.js';

// ─── Sample clinic data (demo) ────────────────────────────────────
const SAMPLE_CLINICS = [
  { id: 1, name: 'Apollo Clinic',          type: 'Multi-specialty',   address: '12 MG Road, Bangalore', lat: 12.9716, lng: 77.5946, hours: 'Mon–Sat 8am–9pm' },
  { id: 2, name: 'Fortis Healthcare',      type: 'Hospital',          address: '14 Cunningham Rd, Bangalore', lat: 12.9830, lng: 77.5984, hours: 'Open 24/7' },
  { id: 3, name: 'Manipal Hospital',       type: 'Hospital',          address: '98 HAL Airport Rd, Bangalore', lat: 12.9592, lng: 77.6487, hours: 'Open 24/7' },
  { id: 4, name: 'Columbia Asia Hospital', type: 'Multi-specialty',   address: 'Kirloskar Business Park, Bangalore', lat: 13.0012, lng: 77.5636, hours: 'Open 24/7' },
  { id: 5, name: 'Narayana Health City',   type: 'Super-specialty',   address: '258/A Bommasandra, Bangalore', lat: 12.8201, lng: 77.6762, hours: 'Mon–Sat 7am–8pm' },
];

let _mapInitialised = false;
let _map = null;
let _selectedClinic = null;

/**
 * Lazy-initialise Google Maps and render clinic pins.
 * Safe to call multiple times — only loads once.
 */
export async function initClinicFinder() {
  renderClinicList();

  if (!MAPS_API_KEY) {
    renderMapPlaceholder();
    return;
  }

  if (_mapInitialised) return;
  _mapInitialised = true;

  await loadMapsApi();
  renderMap();
}

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
    item.innerHTML = `
      <div class="clinic-item__name">${escapeHtml(clinic.name)}</div>
      <div class="clinic-item__type">${escapeHtml(clinic.type)}</div>
      <div class="clinic-item__address">${escapeHtml(clinic.address)}</div>`;

    item.addEventListener('click', () => selectClinic(clinic.id));
    list.appendChild(item);
  });
}

function selectClinic(id) {
  _selectedClinic = id;
  document.querySelectorAll('.clinic-item').forEach(el => {
    el.setAttribute('data-selected', String(el.dataset.clinicId === String(id)));
  });

  if (_map) {
    const clinic = SAMPLE_CLINICS.find(c => c.id === id);
    if (clinic) _map.panTo({ lat: clinic.lat, lng: clinic.lng });
  }
}

function renderMapPlaceholder() {
  const container = document.getElementById('clinic-map-container');
  if (!container) return;
  container.innerHTML = `
    <div class="clinic-map-placeholder">
      <div class="clinic-map-placeholder__icon" aria-hidden="true" style="font-size:2.5rem;opacity:0.3">[ MAP ]</div>
      <div class="text-mono fw-600">Map not configured</div>
      <p>Add your MAPS_API_KEY in js/config.js to enable the interactive map.</p>
      <p style="margin-top:0.5rem;font-size:var(--text-xs)">
        GCP Console &rarr; APIs &amp; Services &rarr; Credentials &rarr; Create API Key
      </p>
    </div>`;
}

async function loadMapsApi() {
  if (window.google?.maps) return;
  return new Promise((resolve, reject) => {
    const script  = document.createElement('script');
    script.src    = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}`;
    script.async  = true;
    script.defer  = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Maps API failed to load.'));
    document.head.appendChild(script);
  });
}

function renderMap() {
  const container = document.getElementById('clinic-map-container');
  if (!container || !window.google?.maps) { renderMapPlaceholder(); return; }

  container.innerHTML = '<div id="clinic-map" class="clinic-map"></div>';
  const mapEl = document.getElementById('clinic-map');
  const centre = { lat: 12.9716, lng: 77.5946 };

  _map = new window.google.maps.Map(mapEl, {
    center: centre,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -80 }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#E3E0D9' }] },
    ],
  });

  SAMPLE_CLINICS.forEach(clinic => {
    const marker = new window.google.maps.Marker({
      position: { lat: clinic.lat, lng: clinic.lng },
      map: _map,
      title: clinic.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#C8302A',
        fillOpacity: 1,
        strokeColor: '#0A0A0A',
        strokeWeight: 2,
      },
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;max-width:200px;padding:4px">
          <strong>${clinic.name}</strong><br>
          <span style="color:#B84B00">${clinic.type}</span><br>
          ${clinic.address}<br>
          <em>${clinic.hours}</em>
        </div>`,
    });

    marker.addListener('click', () => {
      infoWindow.open(_map, marker);
      selectClinic(clinic.id);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
