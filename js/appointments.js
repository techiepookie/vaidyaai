/**
 * @file appointments.js
 * @description Appointment booking wizard and list renderer for the patient dashboard.
 *
 * Handles:
 *  - Rendering the upcoming/past appointments list
 *  - Booking wizard: doctor select → slot pick → confirm
 *  - Cloud Run /slots and /book-appointment calls (or mock equivalents)
 */

import { getIdToken } from './auth.js';
import { CLOUD_RUN_BASE_URL, DEMO_MODE } from './config.js';
import { getDoctors, getAppointments, saveMockAppointment, MOCK_DOCTORS } from './firestore.js';
import { showToast } from './ui.js';

// ─── State ───────────────────────────────────────────────────────
let _userId = '';
let _selectedDoctorId = '';
let _selectedSlot = '';
let _lastTriageId = null;

const STATUS_CFG = {
  pending:   { cls: 'badge--pending',   label: 'Pending' },
  confirmed: { cls: 'badge--confirmed', label: 'Confirmed' },
  completed: { cls: 'badge--completed', label: 'Completed' },
};

/**
 * Initialise appointment list + booking wizard.
 * @param {{userId: string, lastTriageId?: string}} opts
 */
export async function initAppointments({ userId, lastTriageId }) {
  _userId       = userId;
  _lastTriageId = lastTriageId || null;

  await renderAppointmentList();
  initBookingWizard();
}

// ─── Appointment List ─────────────────────────────────────────────

async function renderAppointmentList() {
  const container = document.getElementById('appt-list');
  if (!container) return;

  container.innerHTML = '<p class="text-muted text-sm text-mono" style="padding:1rem">Loading…</p>';

  const appointments = await getAppointments(_userId, 'patient');

  if (!appointments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon" aria-hidden="true" style="font-size:2rem;opacity:0.35;font-family:var(--font-mono)">[ ]</div>
        <div class="empty-state__title">No appointments yet</div>
        <p class="empty-state__text">Book your first appointment using the form below.</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  const ul = document.createElement('div');
  ul.className = 'appt-list';

  appointments.forEach(appt => {
    const slot = new Date(appt.slot);
    const cfg  = STATUS_CFG[appt.status] || STATUS_CFG.pending;
    const el   = document.createElement('div');
    el.className = 'appt-card animate-fade-in';
    el.innerHTML = `
      <div class="appt-card__date">
        <span class="appt-card__date-day">${slot.getDate()}</span>
        <span class="appt-card__date-mon">${slot.toLocaleString('en', {month:'short'})}</span>
      </div>
      <div class="appt-card__info">
        <div class="appt-card__name">${escapeHtml(appt.doctorName || 'Doctor')}</div>
        <div class="appt-card__meta">
          ${escapeHtml(appt.specialty || '')} &middot;
          ${slot.toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit'})}
        </div>
        ${appt.notes ? `<div class="appt-card__notes" style="margin-top:6px;font-size:var(--text-xs);color:var(--c-grey-500);font-family:var(--font-mono);border-left:3px solid var(--c-grey-300);padding-left:8px">${escapeHtml(appt.notes)}</div>` : ''}
      </div>
      <span class="badge ${cfg.cls}">${cfg.label}</span>`;
    ul.appendChild(el);
  });

  container.appendChild(ul);
}

// ─── Booking Wizard ───────────────────────────────────────────────

function initBookingWizard() {
  const doctorSelect = document.getElementById('booking-doctor');
  const slotsSection = document.getElementById('booking-slots-section');
  const confirmBtn   = document.getElementById('booking-confirm');
  const form         = document.getElementById('booking-form');

  if (!doctorSelect) return;

  // Populate doctor list
  populateDoctorSelect(doctorSelect);

  doctorSelect.addEventListener('change', async () => {
    _selectedDoctorId = doctorSelect.value;
    _selectedSlot = '';
    if (!_selectedDoctorId) { slotsSection.classList.add('hidden'); return; }
    await loadSlots(_selectedDoctorId);
    slotsSection.classList.remove('hidden');
    if (confirmBtn) confirmBtn.disabled = true;
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!_selectedDoctorId || !_selectedSlot) return;
      await confirmBooking(confirmBtn);
    });
  }
}

async function populateDoctorSelect(select) {
  const doctors = await getDoctors();
  select.innerHTML = '<option value="">— Select a doctor —</option>';
  doctors.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.uid;
    const exp  = d.experience ? ` · ${d.experience}` : '';
    const hosp = d.hospital   ? ` @ ${d.hospital}` : '';
    opt.textContent = `${d.name} — ${d.specialty || 'General'}${exp}${hosp}`;
    select.appendChild(opt);
  });
}

async function loadSlots(doctorId) {
  const slotGrid = document.getElementById('slot-grid');
  if (!slotGrid) return;
  slotGrid.innerHTML = '<p class="text-muted text-sm text-mono">Loading slots…</p>';

  let slots = [];
  try {
    const useMock = !CLOUD_RUN_BASE_URL || sessionStorage.getItem('vaidyaai_demo_user');
    if (useMock) {
      slots = generateDemoSlots();
    } else {
      const token = await getIdToken();
      const res = await fetch(`${CLOUD_RUN_BASE_URL}/slots?doctorId=${encodeURIComponent(doctorId)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      slots = data.slots || [];
    }
  } catch {
    slotGrid.innerHTML = '<p class="text-muted text-sm text-mono">Could not load slots.</p>';
    return;
  }

  if (!slots.length) {
    slotGrid.innerHTML = '<p class="text-muted text-sm text-mono">No available slots this week.</p>';
    return;
  }

  const confirmBtn = document.getElementById('booking-confirm');
  slotGrid.innerHTML = '';
  slotGrid.className = 'slot-grid';

  slots.slice(0, 12).forEach(slotStr => {
    const d = new Date(slotStr);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn';
    btn.textContent = `${d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})} ${d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}`;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      slotGrid.querySelectorAll('.slot-btn').forEach(b => b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed', 'true');
      _selectedSlot = slotStr;
      if (confirmBtn) confirmBtn.disabled = false;
    });
    slotGrid.appendChild(btn);
  });
}

function generateDemoSlots() {
  const slots = [];
  const now = new Date();
  for (let d = 1; d <= 5; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    if (date.getDay() === 0) continue;
    [9, 10, 11, 14, 15, 16].forEach(h => {
      const s = new Date(date);
      s.setHours(h, 0, 0, 0);
      slots.push(s.toISOString());
    });
  }
  return slots;
}

async function confirmBooking(btn) {
  if (btn) { btn.setAttribute('data-loading','true'); btn.disabled = true; }

  const doctor = MOCK_DOCTORS.find(d => d.uid === _selectedDoctorId) ||
                 { name: 'Selected Doctor', specialty: 'General' };

  try {
    const useMock = !CLOUD_RUN_BASE_URL || sessionStorage.getItem('vaidyaai_demo_user');
    if (useMock) {
      await new Promise(r => setTimeout(r, 800));
      saveMockAppointment({
        patientId: _userId, doctorId: _selectedDoctorId,
        doctorName: doctor.name, specialty: doctor.specialty,
        slot: _selectedSlot, triageId: _lastTriageId,
        patientName: 'Demo Patient',
      });
    } else {
      const token = await getIdToken();
      const res = await fetch(`${CLOUD_RUN_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ doctorId: _selectedDoctorId, slot: _selectedSlot, triageId: _lastTriageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed.');
    }

    showToast('Appointment confirmed!', 'success');
    _selectedDoctorId = ''; _selectedSlot = '';
    await renderAppointmentList();

    // Reset form
    const form = document.getElementById('booking-form');
    if (form) form.reset();
    const slots = document.getElementById('booking-slots-section');
    if (slots) slots.classList.add('hidden');

  } catch (err) {
    showToast(err.message || 'Booking failed. Please try again.', 'error');
  } finally {
    if (btn) { btn.removeAttribute('data-loading'); btn.disabled = false; }
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
