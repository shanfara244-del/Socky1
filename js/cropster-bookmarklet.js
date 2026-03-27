/**
 * Socky1 — Cropster Bookmarklet
 *
 * Usage:
 * 1. Create a new bookmark in your browser
 * 2. Set the URL to the content of bookmarklet.min.js (or the minified version below)
 * 3. Navigate to a roast page in Cropster (c-sar.cropster.com)
 * 4. Click the bookmark
 * 5. It will download a .json file with all curve data
 * 6. Import that file in Socky1 → Torréfactions → Nouvelle torréfaction → Importer fichier
 */

// This is the readable version. The actual bookmarklet is the minified one-liner.

(function() {
  'use strict';

  // Detect if we're on Cropster
  if (!window.location.hostname.includes('cropster.com')) {
    alert('Socky1: Ouvrez cette page sur Cropster (c-sar.cropster.com) d\'abord.');
    return;
  }

  // Extract processing ID from URL
  // Cropster URLs: /apps/roast/details/AKPdE8 or /roasting/processings/3qdqOX
  let processingId = null;

  // Try URL path — multiple known patterns
  const pathMatch = window.location.pathname.match(/\/apps\/roast\/details\/([a-zA-Z0-9]+)/)
    || window.location.pathname.match(/processings\/([a-zA-Z0-9]+)/);
  if (pathMatch) {
    processingId = pathMatch[1];
  }

  // Try hash
  if (!processingId) {
    const hashMatch = window.location.hash.match(/\/apps\/roast\/details\/([a-zA-Z0-9]+)/)
      || window.location.hash.match(/processings\/([a-zA-Z0-9]+)/);
    if (hashMatch) processingId = hashMatch[1];
  }

  // Fallback: ask user
  if (!processingId) {
    processingId = prompt('Socky1: ID du roast Cropster introuvable dans l\'URL.\nEntrez l\'ID manuellement (ex: 3qdqOX):');
    if (!processingId) return;
  }

  const baseUrl = 'https://c-sar.cropster.com/api/v2';
  const headers = {
    'Accept': 'application/vnd.api+json;charset=UTF-8',
  };

  // Show progress
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:system-ui;';
  overlay.innerHTML = '<div style="background:#231e19;color:#f0e6dc;padding:2rem 3rem;border-radius:12px;text-align:center;border:2px solid #d4915e;"><h2 style="color:#d4915e;margin:0 0 0.5rem">Socky1</h2><p id="socky1-status">Chargement des courbes...</p></div>';
  document.body.appendChild(overlay);
  const statusEl = document.getElementById('socky1-status');

  function updateStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  // Fetch all data in parallel
  Promise.all([
    fetch(`${baseUrl}/processingCurves?filter[processingCurves][processing]=${processingId}`, { headers, credentials: 'include' })
      .then(r => r.json()).catch(() => null),
    fetch(`${baseUrl}/processingMeasures?filter[processingMeasures][processing]=${processingId}`, { headers, credentials: 'include' })
      .then(r => r.json()).catch(() => null),
    fetch(`${baseUrl}/processings/${processingId}`, { headers, credentials: 'include' })
      .then(r => r.json()).catch(() => null),
    fetch(`${baseUrl}/processingComments?filter[processingComments][processing]=${processingId}`, { headers, credentials: 'include' })
      .then(r => r.json()).catch(() => null),
  ]).then(([curves, measures, processing, comments]) => {
    updateStatus('Préparation du fichier...');

    if (!curves || !curves.data || curves.data.length === 0) {
      alert('Socky1: Aucune courbe trouvée pour ce roast. Vérifiez que vous êtes sur la bonne page.');
      overlay.remove();
      return;
    }

    // Build Socky1-compatible export
    const exportData = {
      socky1Export: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      processingId: processingId,
      curves: curves,
      measures: measures,
      processing: processing,
      comments: comments,
    };

    // Extract roast date and batch info for filename
    let filename = `socky1_${processingId}`;
    if (processing?.data?.attributes) {
      const attrs = processing.data.attributes;
      if (attrs.startDate) {
        const date = new Date(attrs.startDate).toISOString().split('T')[0];
        filename = `socky1_${date}_${processingId}`;
      }
    }

    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Count curves
    const curveNames = curves.data.map(c => c.attributes?.name).filter(Boolean);
    const btPoints = curves.data.find(c => c.attributes?.name === 'beanTemperature')?.attributes?.values?.length || 0;

    updateStatus(`Téléchargé ! ${curveNames.length} courbes, ${btPoints} points BT.\nImportez le fichier dans Socky1.`);

    setTimeout(() => overlay.remove(), 3000);

  }).catch(err => {
    alert('Socky1: Erreur lors du chargement — ' + err.message);
    overlay.remove();
  });

})();
