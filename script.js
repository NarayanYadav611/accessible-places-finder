import { db } from './firebase.js';
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, query, orderBy, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Collection name
const COLLECTION_NAME = 'accessible_places';

// Elements
const requestForm = document.getElementById('requestForm');
const requestsList = document.getElementById('requestsList');
const filterChips = document.getElementById('filterChips');

let placesCache = []; // store fetched docs for client-side filtering
let activeFilters = new Set();

// Demo data used when Firestore is empty or unavailable
const DEMO_PLACES = [
    {
        id: 'demo-1',
        data: {
            placeName: 'Green Leaf Cafeteria',
            placeType: 'Public Area',
            address: 'Building A, Campus Lane',
            notes: 'Wide doorway, ramp at main entrance. Staff friendly and helpful.',
            features: ['wheelchair','restroom','step_free'],
            confirmations: 4,
            demo: true,
            createdAt: { toDate: () => new Date('2025-09-10') }
        }
    },
    {
        id: 'demo-2',
        data: {
            placeName: 'Main Library — North Wing',
            placeType: 'Office',
            address: 'Library Road, North Wing',
            notes: 'Elevator available to all floors. Some narrow aisles near periodicals.',
            features: ['lift','wheelchair','parking'],
            confirmations: 6,
            demo: true,
            createdAt: { toDate: () => new Date('2025-08-21') }
        }
    },
    {
        id: 'demo-3',
        data: {
            placeName: 'Chemistry Building — Restroom',
            placeType: 'Washroom',
            address: 'Science Block, 1st Floor',
            notes: 'Accessible stall present, but door swing is tight. Needs wider space.',
            features: ['restroom'],
            confirmations: 1,
            demo: true,
            createdAt: { toDate: () => new Date('2025-10-03') }
        }
    },
    {
        id: 'demo-4',
        data: {
            placeName: 'Lecture Hall 3',
            placeType: 'Classroom',
            address: 'Academic Block, Hall 3',
            notes: 'Step-free entry available via side entrance. No designated parking.',
            features: ['step_free'],
            confirmations: 2,
            demo: true,
            createdAt: { toDate: () => new Date('2025-07-15') }
        }
    }
];

// Form submission (new schema: features array, notes, confirmations)
requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const placeName = document.getElementById('placeName').value.trim();
    const placeType = document.getElementById('placeType').value;
    const address = document.getElementById('address').value.trim();
    const notes = document.getElementById('notes').value.trim();

    // gather features
    const featureNodes = Array.from(document.querySelectorAll('input[name="feature"]:checked'));
    const features = featureNodes.map(n => n.value);

    if (!placeName || !placeType || !address) {
        alert('Please fill required fields.');
        return;
    }

    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            placeName,
            placeType,
            address,
            notes: notes || '',
            features: features,
            confirmations: 0,
            createdAt: serverTimestamp()
        });

        requestForm.reset();
        showSuccessMessage('Thanks — your accessibility info helps others');
        loadRequests();

    } catch (error) {
        console.error('Error adding place:', error);
        alert('Failed to add place. Please try again.');
    }
});

// Wire up filter chips
filterChips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const feature = btn.dataset.feature;
    if (activeFilters.has(feature)) {
        activeFilters.delete(feature);
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed','false');
    } else {
        activeFilters.add(feature);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed','true');
    }
    renderRequests();
});

// Load all requests
async function loadRequests() {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Use demo data when Firestore has no entries
            placesCache = DEMO_PLACES.slice();
            renderRequests();
            return;
        }

        placesCache = [];
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            placesCache.push({ id: docSnapshot.id, data });
        });

        renderRequests();

    } catch (error) {
        console.error('Error loading places:', error);
        // If Firestore is unavailable, fall back to demo data
        placesCache = DEMO_PLACES.slice();
        renderRequests();
    }
}

// Render places from cache with active filters
function renderRequests() {
    if (!placesCache.length) {
        requestsList.innerHTML = '<div class="empty-state"><p>No accessible places yet. Be the first to add helpful details!</p></div>';
        return;
    }

    const filtered = placesCache.filter(item => {
        const features = item.data.features || [];
        // item must include every active filter
        for (const f of activeFilters) {
            if (!features.includes(f)) return false;
        }
        return true;
    });

    if (!filtered.length) {
        requestsList.innerHTML = '<div class="empty-state"><p>No places match selected filters.</p></div>';
        return;
    }

    requestsList.innerHTML = '';
    filtered.forEach(item => {
        const card = createRequestCard(item.id, item.data);
        requestsList.appendChild(card);
    });
}

// Create request card element
function createRequestCard(id, data) {
    const card = document.createElement('div');
    card.className = 'request-card';

    const timestamp = data.createdAt && data.createdAt.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'Recently';
    const confirmations = data.confirmations || 0;

    // Confidence calculation (features + confirmations)
    const fCount = (data.features || []).length;
    const points = fCount * 1 + confirmations * 0.8;
    let confidenceLabel = 'Needs verification';
    let confidenceClass = 'confidence-low';
    if (points >= 4) { confidenceLabel = 'High confidence'; confidenceClass = 'confidence-high'; }
    else if (points >= 2) { confidenceLabel = 'Moderate confidence'; confidenceClass = 'confidence-medium'; }

    // Compute a friendly numeric score for display
    const rawScore = Math.min(5, 1 + confirmations * 0.8 + fCount * 0.2);
    const score = Math.round(rawScore * 10) / 10;

    // Feature icons
    const featureMap = {
        wheelchair: '♿',
        restroom: '🚻',
        lift: '🛗',
        step_free: '🚪',
        parking: '🅿️'
    };

    const features = (data.features || []).map(f => `<span title="${f}">${featureMap[f] || ''} <small style="font-weight:700; color:#2f6b6a;">${f.replace('_',' ')}</small></span>`).join(' ');

    const notes = data.notes ? escapeHtml(data.notes) : '';

    const demoBadge = data.demo ? '<span style="font-size:12px; color:#7a8b86; margin-left:8px;">(demo)</span>' : '';
    card.innerHTML = `
        <div class="request-header">
            <h3 class="request-title">${escapeHtml(data.placeName)} ${demoBadge} <span class="place-type-badge">${escapeHtml(data.placeType || '')}</span></h3>
            <span class="status-badge">Accessibility Available</span>
        </div>
        <div class="request-info">
            <div class="info-row"><span class="info-label">Location:</span> ${escapeHtml(data.address || '')}</div>
            <div class="accessibility-features"><strong>♿ Accessibility Notes:</strong><br>${notes || '<em>No additional notes</em>'}</div>
            <div class="feature-icons">${features}</div>
            <div class="info-row" style="margin-top:10px; display:flex; gap:12px; align-items:center;"><div class="confidence-badge ${confidenceClass}">${confidenceLabel}</div><div><strong>Score:</strong> ⭐ ${score}/5 — <small>${confirmations} confirmed</small></div></div>
        </div>
        <div class="request-meta">
            <span>📅 Added: ${timestamp}</span>
        </div>
        <div class="request-actions">
            <button class="small-btn" data-action="view" data-address="${escapeHtml(data.address || '')}">View on Map</button>
            <button class="primary-btn" data-action="confirm" data-id="${id}">Confirm Accessibility</button>
            <button class="small-btn" data-action="report" data-id="${id}">Report Issue</button>
        </div>
    `;

    // view on map
    card.querySelector('[data-action="view"]').addEventListener('click', (e) => {
        const address = e.currentTarget.dataset.address || '';
        const url = `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    });

    // confirm
    card.querySelector('[data-action="confirm"]').addEventListener('click', async (e) => {
        const docId = e.currentTarget.dataset.id;
        await confirmInfo(docId);
    });

    // report
    const reportBtn = card.querySelector('[data-action="report"]');
    if (reportBtn) {
        reportBtn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            // lightweight report flow: open mailto or show prompt
            const confirmReport = confirm('Report an issue for this place? This will flag it for review.');
            if (confirmReport) {
                // a simple implementation: increment a "reports" field (best-effort)
                (async () => {
                    try {
                        // If demo entry, update local cache only
                        const local = placesCache.find(p => p.id === id);
                        if (local && local.data && local.data.demo) {
                            local.data.reports = (local.data.reports || 0) + 1;
                            showSuccessMessage('Thanks — the issue was reported (demo)');
                            renderRequests();
                            return;
                        }

                        const docRef = doc(db, COLLECTION_NAME, id);
                        await updateDoc(docRef, { reports: increment(1) });
                        showSuccessMessage('Thanks — the issue was reported for review');
                        loadRequests();
                    } catch (err) {
                        console.error('Report failed', err);
                        alert('Failed to report. Try again later.');
                    }
                })();
            }
        });
    }

    return card;
}

// Confirm info (increment confirmations)
async function confirmInfo(docId) {
    try {
        // If this is a demo item (not stored in Firestore), update local cache only
        const local = placesCache.find(p => p.id === docId);
        if (local && local.data && local.data.demo) {
            local.data.confirmations = (local.data.confirmations || 0) + 1;
            showSuccessMessage('Thanks — your confirmation is recorded (demo)');
            renderRequests();
            return;
        }

        const docRef = doc(db, COLLECTION_NAME, docId);
        await updateDoc(docRef, { confirmations: increment(1) });
        showSuccessMessage('Thanks — your confirmation is recorded');
        loadRequests();
    } catch (error) {
        console.error('Error confirming info:', error);
        alert('Failed to confirm. Please try again.');
    }
}

// Show success message
function showSuccessMessage(message) {
    let successDiv = document.querySelector('.success-message');

    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        const formSection = document.querySelector('.form-section');
        formSection.insertBefore(successDiv, formSection.querySelector('h2').nextSibling);
    }

    successDiv.textContent = message;
    successDiv.classList.add('show');

    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Initialize on page load
loadRequests();
