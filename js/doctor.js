/**
 * @file doctor.js
 * @description Doctor dashboard — real-time appointment queue and consultation notes.
 *
 * Uses Firestore onSnapshot for zero-poll real-time updates.
 * Falls back to mock data in DEMO_MODE.
 */

import { updateAppointment, subscribeToQueue } from './firestore.js';
import { showToast, openModal, closeModal }     from './ui.js';

const URGENCY_CFG = {
  high:     { cls: 'badge--high',     label: 'High — Urgent',      icon: '‼' },
  moderate: { cls: 'badge--moderate', label: 'Moderate — See Doctor', icon: '!' },
  low:      { cls: 'badge--low',      label: 'Low — Self-care',    icon: '✓' },
};

let _doctorId = '';
let _unsubscribe = null;
let _currentApptId = null;

/**
 * Initialise the doctor queue with real-time Firestore listener.
 * @param {{doctorId: string}} opts
 */
export async function initDoctorQueue({ doctorId }) {
  _doctorId = doctorId;

  updateStats({ total: 0, high: 0, completed: 0 });

  _unsubscribe = await subscribeToQueue(doctorId, (appointments) => {
    renderQueue(appointments);
    updateStats({
      total:     appointments.length,
      high:      appointments.filter(a => a.urgency === 'high').length,
      completed: appointments.filter(a => a.status === 'completed').length,
    });
  });

  initNotesModal();
}

/** Clean up the Firestore listener when navigating away */
export function destroyDoctorQueue() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}

// ─── Queue Rendering ──────────────────────────────────────────────

function renderQueue(appointments) {
  const container = document.getElementById('queue-list');
  if (!container) return;

  if (!appointments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🩺</div>
        <div class="empty-state__title">Queue is clear</div>
        <p class="empty-state__text">No pending or confirmed appointments today.</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  appointments.forEach((appt, idx) => {
    const card = buildQueueCard(appt, idx);
    container.appendChild(card);
  });
}

/** Build a collapsible queue card element */
function buildQueueCard(appt, idx) {
  const urgencyCfg = URGENCY_CFG[appt.urgency] || null;
  const slot = appt.slot ? new Date(appt.slot) : null;
  const timeStr = slot ? slot.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' }) : 'TBD';
  const dateStr = slot ? slot.toLocaleDateString('en', { weekday:'short', month:'short', day:'numeric' }) : '';
  const cardId  = `queue-card-${appt.id}`;
  const detailId = `queue-detail-${appt.id}`;

  const card = document.createElement('div');
  card.className = 'queue-card animate-fade-in';
  card.id = cardId;
  card.dataset.urgency = appt.urgency || 'none';

  card.innerHTML = `
    <div class="queue-card__header"
         role="button" tabindex="0"
         aria-expanded="false"
         aria-controls="${detailId}"
         id="${cardId}-trigger">
      <div style="display:flex;align-items:center;justify-content:center;
                  width:40px;height:40px;background:var(--c-grey-100);
                  font-family:var(--font-mono);font-weight:700;flex-shrink:0;">
        ${idx + 1}
      </div>
      <div class="queue-card__patient">
        <div class="queue-card__patient-name">${escapeHtml(appt.patientName || 'Patient')}</div>
        <div class="queue-card__patient-meta">${dateStr} · ${timeStr}</div>
      </div>
      ${urgencyCfg ? `
        <span class="badge ${urgencyCfg.cls}" role="status" aria-label="Urgency: ${urgencyCfg.label}">
          <span aria-hidden="true">${urgencyCfg.icon}</span> ${urgencyCfg.label}
        </span>` : ''}
      <span class="queue-card__chevron" aria-hidden="true">▾</span>
    </div>

    <div class="queue-card__detail" id="${detailId}" aria-labelledby="${cardId}-trigger">
      ${appt.symptoms ? `
        <div class="triage-card__section-label">Patient's Symptoms</div>
        <div class="queue-card__symptoms-raw">"${escapeHtml(appt.symptoms)}"</div>` : ''}

      ${appt.urgency ? buildTriageDetail(appt) : `
        <p class="text-muted text-sm text-mono">No AI triage result available for this appointment.</p>`}

      <div class="queue-card__actions">
        ${appt.status !== 'completed' ? `
          <button class="btn btn--primary btn--sm" data-action="notes" data-appt-id="${appt.id}">
            ✎ Add Notes &amp; Complete
          </button>` : `
          <span class="badge badge--completed">✓ Completed</span>`}
        ${appt.notes ? `
          <div style="margin-top:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--c-grey-100);font-size:var(--text-sm);border-left:3px solid var(--c-grey-300);">
            <strong class="text-mono">Notes:</strong> ${escapeHtml(appt.notes)}
          </div>` : ''}
      </div>
    </div>`;

  // Toggle expand/collapse
  const header = card.querySelector('.queue-card__header');
  header.addEventListener('click', () => toggleCard(card));
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(card); }
  });

  // Notes button
  const notesBtn = card.querySelector('[data-action="notes"]');
  if (notesBtn) {
    notesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _currentApptId = appt.id;
      document.getElementById('notes-patient-name').textContent = appt.patientName || 'Patient';
      openModal('notes-modal-overlay', notesBtn);
    });
  }

  return card;
}

function buildTriageDetail(appt) {
  const cfg = URGENCY_CFG[appt.urgency];
  const conditions = (appt.conditions || []).map(c => `<span class="condition-tag">${escapeHtml(c)}</span>`).join('');
  return `
    <div class="triage-card ${appt.urgency ? `triage-card--${appt.urgency}` : ''}" style="margin-bottom:var(--sp-4)">
      <div class="triage-card__header">
        <span class="triage-card__title">Gemini AI Pre-Assessment</span>
        ${cfg ? `<span class="badge ${cfg.cls}"><span aria-hidden="true">${cfg.icon}</span> ${cfg.label}</span>` : ''}
      </div>
      ${appt.conditions?.length ? `
        <div class="triage-card__section">
          <div class="triage-card__section-label">Possible Conditions</div>
          <div class="triage-card__conditions">${conditions}</div>
        </div>` : ''}
      ${appt.advice ? `
        <div class="triage-card__section">
          <div class="triage-card__section-label">Recommended Action</div>
          <p class="triage-card__advice">${escapeHtml(appt.advice)}</p>
        </div>` : ''}
    </div>`;
}

function toggleCard(card) {
  const isExpanded = card.dataset.expanded === 'true';
  card.dataset.expanded = String(!isExpanded);
  const trigger = card.querySelector('.queue-card__header');
  if (trigger) trigger.setAttribute('aria-expanded', String(!isExpanded));
}

// ─── Stats ────────────────────────────────────────────────────────

function updateStats({ total, high, completed }) {
  setText('stat-total', total);
  setText('stat-urgent', high);
  setText('stat-completed', completed);
  const today = new Date().toLocaleDateString('en', { weekday:'long', month:'long', day:'numeric' });
  setText('queue-date', today);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Notes Modal ──────────────────────────────────────────────────

function initNotesModal() {
  const closeBtn  = document.getElementById('notes-modal-close');
  const cancelBtn = document.getElementById('notes-cancel');
  const saveBtn   = document.getElementById('notes-save');

  if (closeBtn)  closeBtn.addEventListener('click',  () => closeModal('notes-modal-overlay'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('notes-modal-overlay'));

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const textarea = document.getElementById('notes-textarea');
      const notes    = textarea?.value.trim() || '';
      saveBtn.setAttribute('data-loading', 'true');
      saveBtn.disabled = true;

      try {
        await updateAppointment(_currentApptId, { status: 'completed', notes });
        closeModal('notes-modal-overlay');
        showToast('Consultation notes saved.', 'success');
        if (textarea) textarea.value = '';
      } catch {
        showToast('Failed to save notes. Please try again.', 'error');
      } finally {
        saveBtn.removeAttribute('data-loading');
        saveBtn.disabled = false;
      }
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
