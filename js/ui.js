/**
 * @file ui.js
 * @description Shared UI utilities: toast notifications, tab switching, modal management.
 * Imported by multiple page modules.
 */

// ─── Toast Notifications ──────────────────────────────────────────

let _toastContainer = null;

function getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.getElementById('toast-container');
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    _toastContainer.className = 'toast-container';
    _toastContainer.setAttribute('aria-live', 'polite');
    _toastContainer.setAttribute('aria-atomic', 'false');
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span aria-hidden="true">${icons[type] || ''}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ─── Tab Switcher ─────────────────────────────────────────────────

/**
 * Initialise tab navigation.
 * @param {string} navId - ID of the tab nav element
 * @param {string} panelSelector - CSS selector for all tab panels
 */
export function initTabs(navId, panelSelector) {
  const nav    = document.getElementById(navId) || document;
  const panels = [...document.querySelectorAll(panelSelector)];
  if (!panels.length) return;

  const buttons = [...(nav === document ? document : nav).querySelectorAll('[data-tab]')];
  if (!buttons.length) return;

  function activateTab(tabId) {
    buttons.forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.setAttribute('data-active', String(panel.id === tabId));
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      const idx = buttons.indexOf(btn);
      if (e.key === 'ArrowRight') { e.preventDefault(); buttons[(idx + 1) % buttons.length].click(); buttons[(idx + 1) % buttons.length].focus(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); buttons[(idx - 1 + buttons.length) % buttons.length].click(); buttons[(idx - 1 + buttons.length) % buttons.length].focus(); }
    });
  });

  // Activate first tab by default
  if (buttons[0]) activateTab(buttons[0].dataset.tab);
}

// ─── Modal Manager ────────────────────────────────────────────────

let _focusableQuery = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
let _modalTrigger = null;

/**
 * Open a modal overlay and trap focus inside it.
 * @param {string} overlayId - ID of the modal overlay element
 * @param {HTMLElement} triggerEl - element that triggered the modal (focus returns here on close)
 */
export function openModal(overlayId, triggerEl) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  _modalTrigger = triggerEl || document.activeElement;
  overlay.setAttribute('data-open', 'true');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const focusable = overlay.querySelectorAll(_focusableQuery);
  if (focusable.length) focusable[0].focus();

  overlay.addEventListener('keydown', trapFocus);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlayId); });
}

/**
 * Close a modal overlay and return focus to the trigger element.
 * @param {string} overlayId
 */
export function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.setAttribute('data-open', 'false');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  overlay.removeEventListener('keydown', trapFocus);
  if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
}

function trapFocus(e) {
  if (e.key !== 'Tab' && e.key !== 'Escape') return;
  if (e.key === 'Escape') {
    const overlay = e.currentTarget;
    closeModal(overlay.id);
    return;
  }
  const focusable = [...e.currentTarget.querySelectorAll(_focusableQuery)];
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  if (!e.shiftKey && document.activeElement === last)  { e.preventDefault(); first.focus(); }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
