/**
 * @file auth.js
 * @description Firebase Authentication module with role-based route guards.
 *
 * Handles: login, signup (with role), logout, auth state observation,
 * and page-level access control. Falls back to localStorage demo mode
 * when Firebase is not configured.
 *
 * Usage (page-level):
 *   import { requireAuth } from './auth.js';
 *   const user = await requireAuth('patient'); // redirects if wrong role
 */

import { DEMO_MODE, FB_SDK_VERSION, firebaseConfig } from './config.js';

// ─── Firebase imports (CDN ES modules) ───────────────────────────
let _auth = null;
let _db   = null;
let _firebaseApp = null;

/** Lazily initialise Firebase only when not in demo mode */
async function getFirebase() {
  if (DEMO_MODE) return { auth: null, db: null };
  if (_auth) return { auth: _auth, db: _db };

  const base = `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}`;
  const { initializeApp }    = await import(`${base}/firebase-app.js`);
  const { getAuth }          = await import(`${base}/firebase-auth.js`);
  const { getFirestore }     = await import(`${base}/firebase-firestore.js`);

  _firebaseApp = initializeApp(firebaseConfig);
  _auth = getAuth(_firebaseApp);
  _db   = getFirestore(_firebaseApp);
  return { auth: _auth, db: _db };
}

// ─── Demo / mock data ─────────────────────────────────────────────
const DEMO_USERS = {
  'patient@demo.com': {
    uid: 'demo-patient-001', name: 'Arjun Sharma', email: 'patient@demo.com',
    role: 'patient', phone: '+91-9876543210', dob: '1992-04-15',
  },
  'doctor@demo.com': {
    uid: 'demo-doctor-001', name: 'Dr. Priya Mehta', email: 'doctor@demo.com',
    role: 'doctor', phone: '+91-9123456789', specialty: 'General Medicine',
  },
};

const DEMO_STORAGE_KEY = 'vaidyaai_demo_user';

// ─── Public API ───────────────────────────────────────────────────

/**
 * Log in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid: string, name: string, role: string}>}
 */
export async function login(email, password) {
  // Demo credentials always work — even with real Firebase configured.
  const demoUser = DEMO_USERS[email.toLowerCase()];
  if (demoUser) {
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
    return demoUser;
  }

  if (DEMO_MODE) {
    throw new Error('Invalid email or password. Demo: patient@demo.com / doctor@demo.com (any 6+ char password)');
  }

  const { auth, db } = await getFirebase();
  const { signInWithEmailAndPassword, getIdToken } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-auth.js`
  );
  const { doc, getDoc } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-firestore.js`
  );

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  if (!snap.exists()) throw new Error('User profile not found. Please contact support.');
  return { uid: cred.user.uid, ...snap.data() };
}

/**
 * Create a new account and write the user profile to Firestore.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {'patient'|'doctor'} role
 * @returns {Promise<{uid: string, name: string, role: string}>}
 */
export async function signup(name, email, password, role) {
  if (!['patient', 'doctor'].includes(role)) throw new Error('Invalid role selected.');

  if (DEMO_MODE) {
    const user = { uid: `demo-${role}-${Date.now()}`, name, email, role, phone: '', dob: '' };
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  const { auth, db } = await getFirebase();
  const { createUserWithEmailAndPassword } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-auth.js`
  );
  const { doc, setDoc, serverTimestamp } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-firestore.js`
  );

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const userData = { name, email, role, phone: '', createdAt: serverTimestamp() };
  if (role === 'patient') userData.dob = '';
  await setDoc(doc(db, 'users', cred.user.uid), userData);
  return { uid: cred.user.uid, ...userData };
}

/**
 * Sign out the current user.
 * @returns {Promise<void>}
 */
export async function logout() {
  // Always clear demo session
  const isDemoSession = !!sessionStorage.getItem(DEMO_STORAGE_KEY);
  sessionStorage.removeItem(DEMO_STORAGE_KEY);
  if (DEMO_MODE || isDemoSession) {
    window.location.href = '/index.html';
    return;
  }
  const { auth } = await getFirebase();
  const { signOut } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-auth.js`
  );
  await signOut(auth);
  window.location.href = '/index.html';
}

/**
 * Get the currently authenticated user profile.
 * Returns null if not authenticated.
 * @returns {Promise<{uid:string,name:string,role:string}|null>}
 */
export async function getCurrentUser() {
  // Check for demo session first — works even with real Firebase configured.
  const demoRaw = sessionStorage.getItem(DEMO_STORAGE_KEY);
  if (demoRaw) {
    try { return JSON.parse(demoRaw); } catch { /* fall through */ }
  }

  if (DEMO_MODE) return null;

  const { auth, db } = await getFirebase();
  return new Promise((resolve) => {
    // Use a one-time observer
    import(`https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-auth.js`)
      .then(({ onAuthStateChanged }) => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
          unsub();
          if (!firebaseUser) { resolve(null); return; }
          try {
            const { doc, getDoc } = await import(
              `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-firestore.js`
            );
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            resolve(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null);
          } catch {
            resolve(null);
          }
        });
      });
  });
}

/**
 * Get the Firebase ID token for the current user (for API calls).
 * Returns 'demo-token' in DEMO_MODE.
 * @returns {Promise<string>}
 */
export async function getIdToken() {
  // Demo sessions always return mock token
  if (DEMO_MODE || sessionStorage.getItem(DEMO_STORAGE_KEY)) return 'demo-token-vaidyaai';
  const { auth } = await getFirebase();
  if (!auth.currentUser) throw new Error('Not authenticated');
  const { getIdToken: fbGetIdToken } = await import(
    `https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-auth.js`
  );
  return fbGetIdToken(auth.currentUser, /* forceRefresh */ false);
}

/**
 * Page-level route guard. Redirects to login if:
 * - user is not authenticated, OR
 * - user's role does not match requiredRole
 *
 * @param {'patient'|'doctor'} requiredRole
 * @returns {Promise<{uid:string,name:string,role:string}>} the authenticated user
 */
export async function requireAuth(requiredRole) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.replace('/index.html');
    throw new Error('Not authenticated');
  }
  if (requiredRole && user.role !== requiredRole) {
    const redirect = user.role === 'doctor' ? '/doctor.html' : '/patient.html';
    window.location.replace(redirect);
    throw new Error(`Role mismatch: expected ${requiredRole}, got ${user.role}`);
  }
  return user;
}
