'use strict';

/**
 * App — Main controller for Socky1
 * Handles routing, view management, form bindings, and UI orchestration
 */
const App = (() => {

  // ===== ROUTING =====
  function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    showView(hash);
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const view = document.getElementById(`view-${viewId}`);
    const link = document.querySelector(`.nav-link[data-view="${viewId}"]`);

    if (view) view.classList.add('active');
    if (link) link.classList.add('active');

    // Refresh view data
    switch (viewId) {
      case 'dashboard': refreshDashboard(); break;
      case 'coffees': refreshCoffeesList(); break;
      case 'roasts': refreshRoastsList(); break;
      case 'cupping': refreshCuppingsList(); break;
      case 'analysis': refreshAnalysisDropdown(); break;
    }
  }

  // ===== DASHBOARD =====
  function refreshDashboard() {
    const stats = Store.getStats();
    document.getElementById('stat-coffees').textContent = stats.coffees;
    document.getElementById('stat-roasts').textContent = stats.roasts;
    document.getElementById('stat-cuppings').textContent = stats.cuppings;
    document.getElementById('stat-avg-score').textContent = stats.avgScore || '—';

    // Recent cuppings
    const cuppings = Store.getCuppings().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
    const container = document.getElementById('recent-cuppings-list');

    if (cuppings.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun cupping enregistré. Commencez par ajouter un café, importer une courbe, puis cupper.</p>';
    } else {
      container.innerHTML = cuppings.map(c => {
        const roast = Store.getRoast(c.roastId);
        const coffee = roast ? Store.getCoffee(roast.coffeeId) : null;
        return `<div class="card" style="margin-bottom:0.5rem;padding:0.75rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${coffee?.name || 'Café inconnu'}</strong>
              <span class="card-subtitle" style="margin:0"> — ${c.date || '?'}</span>
            </div>
            <span class="card-score" style="font-size:1.3rem">${c.totalScore?.toFixed(1) || '—'}</span>
          </div>
        </div>`;
      }).join('');
    }

    // Score trend
    Charts.renderDashboardTrend('dashboard-score-chart', cuppings);
  }

  // ===== COFFEES =====
  function refreshCoffeesList() {
    const coffees = Store.getCoffees();
    const container = document.getElementById('coffees-list');

    if (coffees.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun café enregistré.</p>';
      return;
    }

    container.innerHTML = coffees.map(c => {
      const roastCount = Store.getRoastsForCoffee(c.id).length;
      return `<div class="card">
        <div class="card-title">${_esc(c.name)}</div>
        <div class="card-subtitle">${_esc(c.origin || '')}</div>
        <div class="card-meta">
          ${c.variety ? `<span class="card-tag">${_esc(c.variety)}</span>` : ''}
          ${c.process ? `<span class="card-tag">${_esc(_processLabel(c.process))}</span>` : ''}
          ${c.altitude ? `<span class="card-tag">${c.altitude}m</span>` : ''}
          <span class="card-tag accent">${roastCount} torréfaction${roastCount !== 1 ? 's' : ''}</span>
        </div>
        ${c.producer ? `<div style="font-size:0.8rem;color:var(--text-muted)">${_esc(c.producer)}</div>` : ''}
        <div class="card-actions">
          <button class="btn btn-sm btn-secondary" onclick="App.editCoffee('${c.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteCoffee('${c.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join('');
  }

  function openCoffeeModal(coffeeId) {
    const modal = document.getElementById('modal-coffee');
    const form = document.getElementById('form-coffee');
    const title = document.getElementById('modal-coffee-title');

    form.reset();
    document.getElementById('coffee-id').value = '';

    if (coffeeId) {
      const coffee = Store.getCoffee(coffeeId);
      if (coffee) {
        title.textContent = 'Modifier le café';
        document.getElementById('coffee-id').value = coffee.id;
        document.getElementById('coffee-name').value = coffee.name || '';
        document.getElementById('coffee-origin').value = coffee.origin || '';
        document.getElementById('coffee-variety').value = coffee.variety || '';
        document.getElementById('coffee-process').value = coffee.process || '';
        document.getElementById('coffee-altitude').value = coffee.altitude || '';
        document.getElementById('coffee-producer').value = coffee.producer || '';
        document.getElementById('coffee-notes').value = coffee.notes || '';
      }
    } else {
      title.textContent = 'Nouveau café';
    }

    modal.classList.remove('hidden');
  }

  function saveCoffeeForm() {
    const data = {
      id: document.getElementById('coffee-id').value || undefined,
      name: document.getElementById('coffee-name').value.trim(),
      origin: document.getElementById('coffee-origin').value.trim(),
      variety: document.getElementById('coffee-variety').value.trim(),
      process: document.getElementById('coffee-process').value,
      altitude: document.getElementById('coffee-altitude').value ? parseInt(document.getElementById('coffee-altitude').value) : null,
      producer: document.getElementById('coffee-producer').value.trim(),
      notes: document.getElementById('coffee-notes').value.trim(),
    };

    if (!data.name || !data.origin) {
      alert('Veuillez remplir le nom et l\'origine du café.');
      return;
    }

    Store.saveCoffee(data);
    document.getElementById('modal-coffee').classList.add('hidden');
    refreshCoffeesList();
  }

  function editCoffee(id) { openCoffeeModal(id); }

  function deleteCoffee(id) {
    const coffee = Store.getCoffee(id);
    if (!coffee) return;
    if (!confirm(`Supprimer "${coffee.name}" et toutes ses torréfactions/cuppings ?`)) return;
    Store.deleteCoffee(id);
    refreshCoffeesList();
  }

  // ===== ROASTS =====
  let pendingCurveData = null;

  function refreshRoastsList() {
    const roasts = Store.getRoasts();
    const container = document.getElementById('roasts-list');

    if (roasts.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune torréfaction enregistrée.</p>';
      return;
    }

    container.innerHTML = roasts.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => {
      const coffee = Store.getCoffee(r.coffeeId);
      const cuppings = Store.getCuppingsForRoast(r.id);
      const avgScore = cuppings.length > 0
        ? (cuppings.reduce((s, c) => s + (c.totalScore || 0), 0) / cuppings.length).toFixed(1)
        : null;

      const params = [];
      if (r.dtr) params.push(`DTR ${r.dtr}%`);
      if (r.fcTime) params.push(`FC ${r.fcTime}`);
      if (r.dropTemp) params.push(`Drop ${r.dropTemp}°C`);
      if (r.totalTime) params.push(r.totalTime);

      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div class="card-title">${_esc(coffee?.name || 'Café inconnu')}</div>
            <div class="card-subtitle">${r.date || '—'}${r.degree ? ` · ${_esc(r.degree)}` : ''}</div>
          </div>
          ${avgScore ? `<span class="card-score">${avgScore}</span>` : '<span class="card-score" style="color:var(--text-muted);font-size:1rem">Non cuppé</span>'}
        </div>
        <div class="card-meta">
          ${params.map(p => `<span class="card-tag">${_esc(p)}</span>`).join('')}
          ${r.curveData ? '<span class="card-tag accent">Courbe</span>' : ''}
          ${r.agtronWhole ? `<span class="card-tag">Agtron ${r.agtronWhole}/${r.agtronGround || '?'}</span>` : ''}
          <span class="card-tag">${cuppings.length} cupping${cuppings.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="App.cuppRoast('${r.id}')">Cupper</button>
          <button class="btn btn-sm btn-secondary" onclick="App.editRoast('${r.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteRoast('${r.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join('');
  }

  function openRoastModal(roastId) {
    const modal = document.getElementById('modal-roast');
    const form = document.getElementById('form-roast');

    form.reset();
    document.getElementById('roast-id').value = '';
    pendingCurveData = null;
    document.getElementById('curve-preview').classList.add('hidden');

    // Populate coffee dropdown
    _populateCoffeeDropdown('roast-coffee');

    if (roastId) {
      const roast = Store.getRoast(roastId);
      if (roast) {
        document.getElementById('modal-roast-title').textContent = 'Modifier la torréfaction';
        document.getElementById('roast-id').value = roast.id;
        document.getElementById('roast-coffee').value = roast.coffeeId || '';
        document.getElementById('roast-date').value = roast.date || '';
        document.getElementById('roast-batch-size').value = _valOrEmpty(roast.batchSize);
        document.getElementById('roast-degree').value = roast.degree || '';
        document.getElementById('roast-charge-temp').value = _valOrEmpty(roast.chargeTemp);
        document.getElementById('roast-turning-point').value = _valOrEmpty(roast.turningPoint);
        document.getElementById('roast-fc-time').value = _valOrEmpty(roast.fcTime);
        document.getElementById('roast-fc-temp').value = _valOrEmpty(roast.fcTemp);
        document.getElementById('roast-drop-time').value = _valOrEmpty(roast.dropTime);
        document.getElementById('roast-drop-temp').value = _valOrEmpty(roast.dropTemp);
        document.getElementById('roast-dev-time').value = _valOrEmpty(roast.devTime);
        document.getElementById('roast-dtr').value = _valOrEmpty(roast.dtr);
        document.getElementById('roast-weight-loss').value = _valOrEmpty(roast.weightLoss);
        document.getElementById('roast-total-time').value = _valOrEmpty(roast.totalTime);
        document.getElementById('roast-agtron-whole').value = _valOrEmpty(roast.agtronWhole);
        document.getElementById('roast-agtron-ground').value = _valOrEmpty(roast.agtronGround);
        document.getElementById('roast-notes').value = roast.notes || '';

        if (roast.curveData) {
          pendingCurveData = roast.curveData;
          document.getElementById('curve-preview').classList.remove('hidden');
          Charts.renderCurvePreview('curve-preview-chart', roast.curveData);
          document.getElementById('curve-preview-info').textContent =
            `${roast.curveData.bt.length} points · BT ${Math.min(...roast.curveData.bt).toFixed(0)}–${Math.max(...roast.curveData.bt).toFixed(0)}°C`;
        }
      }
    } else {
      document.getElementById('modal-roast-title').textContent = 'Nouvelle torréfaction';
      document.getElementById('roast-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
  }

  function saveRoastForm() {
    const data = {
      id: document.getElementById('roast-id').value || undefined,
      coffeeId: document.getElementById('roast-coffee').value,
      date: document.getElementById('roast-date').value,
      batchSize: _numOrNull(document.getElementById('roast-batch-size').value),
      degree: document.getElementById('roast-degree').value,
      chargeTemp: _numOrNull(document.getElementById('roast-charge-temp').value),
      turningPoint: _numOrNull(document.getElementById('roast-turning-point').value),
      fcTime: document.getElementById('roast-fc-time').value.trim() || null,
      fcTemp: _numOrNull(document.getElementById('roast-fc-temp').value),
      dropTime: document.getElementById('roast-drop-time').value.trim() || null,
      dropTemp: _numOrNull(document.getElementById('roast-drop-temp').value),
      devTime: document.getElementById('roast-dev-time').value.trim() || null,
      dtr: _numOrNull(document.getElementById('roast-dtr').value),
      weightLoss: _numOrNull(document.getElementById('roast-weight-loss').value),
      totalTime: document.getElementById('roast-total-time').value.trim() || null,
      agtronWhole: _numOrNull(document.getElementById('roast-agtron-whole').value),
      agtronGround: _numOrNull(document.getElementById('roast-agtron-ground').value),
      notes: document.getElementById('roast-notes').value.trim(),
      curveData: pendingCurveData,
    };

    if (!data.coffeeId || !data.date) {
      alert('Veuillez sélectionner un café et une date.');
      return;
    }

    // Auto-calculate DTR if we have FC time and total/drop time
    if (!data.dtr && data.fcTime && (data.totalTime || data.dropTime)) {
      const fcSec = CurveParser.parseTimeStr(data.fcTime);
      const totalSec = CurveParser.parseTimeStr(data.totalTime || data.dropTime);
      if (fcSec && totalSec && totalSec > fcSec) {
        data.dtr = parseFloat((((totalSec - fcSec) / totalSec) * 100).toFixed(1));
      }
    }

    // Auto-calculate dev time
    if (!data.devTime && data.fcTime && (data.totalTime || data.dropTime)) {
      const fcSec = CurveParser.parseTimeStr(data.fcTime);
      const totalSec = CurveParser.parseTimeStr(data.totalTime || data.dropTime);
      if (fcSec && totalSec && totalSec > fcSec) {
        data.devTime = CurveParser.formatTime(totalSec - fcSec);
      }
    }

    Store.saveRoast(data);
    document.getElementById('modal-roast').classList.add('hidden');
    refreshRoastsList();
  }

  function editRoast(id) { openRoastModal(id); }

  function deleteRoast(id) {
    const roast = Store.getRoast(id);
    if (!roast) return;
    if (!confirm('Supprimer cette torréfaction et ses cuppings associés ?')) return;
    Store.deleteRoast(id);
    refreshRoastsList();
  }

  function _loadCurveData(text) {
    const result = CurveParser.parseAuto(text);

    if (result.errors.length > 0 && result.bt.length === 0) {
      alert('Erreur de parsing: ' + result.errors.join(', '));
      return;
    }

    pendingCurveData = result;

    const preview = document.getElementById('curve-preview');
    preview.classList.remove('hidden');
    Charts.renderCurvePreview('curve-preview-chart', result);

    const info = document.getElementById('curve-preview-info');
    const btMin = Math.min(...result.bt).toFixed(0);
    const btMax = Math.max(...result.bt).toFixed(0);
    const source = result.meta?.source === 'cropster-json' ? ' · Cropster JSON' : '';
    info.textContent = `${result.bt.length} points · BT ${btMin}–${btMax}°C · Durée ${CurveParser.formatTime(result.time[result.time.length - 1])}${source}`;

    if (result.gas && result.gas.some(v => v > 0)) {
      info.textContent += ' · Gas';
    }

    if (result.errors.length > 0) {
      info.textContent += ` · ⚠ ${result.errors.join(', ')}`;
    }

    // Auto-fill roast params from curve if empty
    _autoFillFromCurve(result);
  }

  function _autoFillFromCurve(result) {
    if (!result || result.bt.length === 0) return;

    const chargeEl = document.getElementById('roast-charge-temp');
    const totalTimeEl = document.getElementById('roast-total-time');

    // Charge temp = first BT value (if not already filled)
    if (chargeEl && !chargeEl.value && result.bt[0] > 50) {
      chargeEl.value = result.bt[0].toFixed(1);
    }

    // Total time from curve duration
    if (totalTimeEl && !totalTimeEl.value && result.time.length > 0) {
      totalTimeEl.value = CurveParser.formatTime(result.time[result.time.length - 1]);
    }

    // Drop temp = last BT value
    const dropTempEl = document.getElementById('roast-drop-temp');
    if (dropTempEl && !dropTempEl.value) {
      dropTempEl.value = result.bt[result.bt.length - 1].toFixed(1);
    }

    // Turning point: lowest BT in first 30%
    const tpEl = document.getElementById('roast-turning-point');
    if (tpEl && !tpEl.value) {
      const searchEnd = Math.floor(result.bt.length * 0.3);
      let tpVal = result.bt[0];
      for (let i = 1; i < searchEnd; i++) {
        if (result.bt[i] < tpVal) tpVal = result.bt[i];
      }
      if (tpVal < result.bt[0]) {
        tpEl.value = tpVal.toFixed(1);
      }
    }

    // Auto-fill from Cropster measures (bookmarklet export)
    if (result.meta?.measures) {
      const m = result.meta.measures;
      if (m.chargeTemperature && chargeEl && !chargeEl.value) {
        chargeEl.value = m.chargeTemperature.value;
      }
      if (m.endTemperature) {
        const dropEl = document.getElementById('roast-drop-temp');
        if (dropEl && !dropEl.value) dropEl.value = m.endTemperature.value;
      }
    }

    // Auto-fill date from meta
    if (result.meta?.date) {
      const dateEl = document.getElementById('roast-date');
      if (dateEl && !dateEl.value) dateEl.value = result.meta.date;
    }
  }

  function handleCurveFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => _loadCurveData(e.target.result);
    reader.readAsText(file);
  }

  function handleCurvePaste() {
    const textarea = document.getElementById('roast-curve-paste');
    const text = textarea?.value?.trim();
    if (!text) {
      alert('Collez le JSON Cropster dans le champ ci-dessus.');
      return;
    }
    _loadCurveData(text);
    textarea.value = '';
  }

  // ===== CUPPING =====
  function refreshCuppingsList() {
    const cuppings = Store.getCuppings();
    const container = document.getElementById('cuppings-list');

    if (cuppings.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun cupping enregistré.</p>';
      return;
    }

    container.innerHTML = cuppings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(c => {
      const roast = Store.getRoast(c.roastId);
      const coffee = roast ? Store.getCoffee(roast.coffeeId) : null;
      const quality = CuppingForm.getQualityLabel(c.totalScore || 0);

      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div class="card-title">${_esc(coffee?.name || 'Café inconnu')}</div>
            <div class="card-subtitle">${c.date || '—'}${c.cupper ? ` · ${_esc(c.cupper)}` : ''}</div>
          </div>
          <div style="text-align:right">
            <span class="card-score">${c.totalScore?.toFixed(1) || '—'}</span>
            <div style="font-size:0.7rem;color:var(--text-muted)">${quality}</div>
          </div>
        </div>
        ${c.notes ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.5rem">${_esc(c.notes.length > 120 ? c.notes.slice(0, 120) + '...' : c.notes)}</div>` : ''}
        <div class="card-actions">
          <button class="btn btn-sm btn-secondary" onclick="App.editCupping('${c.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteCupping('${c.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join('');
  }

  function openCuppingModal(roastId, cuppingId) {
    const modal = document.getElementById('modal-cupping');

    CuppingForm.reset();
    document.getElementById('cupping-id').value = '';

    // Populate roast dropdown
    _populateRoastDropdown('cupping-roast');

    if (cuppingId) {
      const cupping = Store.getCupping(cuppingId);
      if (cupping) {
        document.getElementById('cupping-id').value = cupping.id;
        document.getElementById('cupping-roast').value = cupping.roastId || '';
        document.getElementById('cupping-date').value = cupping.date || '';
        document.getElementById('cupping-cupper').value = cupping.cupper || '';
        document.getElementById('cupping-notes').value = cupping.notes || '';
        CuppingForm.setScores(cupping.scores, cupping.descriptors);
      }
    } else {
      document.getElementById('cupping-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('cupping-cupper').value = '';
      if (roastId) {
        document.getElementById('cupping-roast').value = roastId;
      }
    }

    CuppingForm.updateTotal();
    modal.classList.remove('hidden');
  }

  function saveCuppingForm() {
    const scores = CuppingForm.getScores();
    const totalScore = CuppingForm.calculateTotal(scores);
    const descriptors = CuppingForm.getDescriptors();

    const data = {
      id: document.getElementById('cupping-id').value || undefined,
      roastId: document.getElementById('cupping-roast').value,
      date: document.getElementById('cupping-date').value,
      cupper: document.getElementById('cupping-cupper').value.trim(),
      scores,
      totalScore,
      descriptors,
      notes: document.getElementById('cupping-notes').value.trim(),
    };

    if (!data.roastId) {
      alert('Veuillez sélectionner une torréfaction.');
      return;
    }

    Store.saveCupping(data);
    document.getElementById('modal-cupping').classList.add('hidden');
    refreshCuppingsList();
  }

  function cuppRoast(roastId) {
    window.location.hash = 'cupping';
    setTimeout(() => openCuppingModal(roastId), 100);
  }

  function editCupping(id) { openCuppingModal(null, id); }

  function deleteCupping(id) {
    if (!confirm('Supprimer ce cupping ?')) return;
    Store.deleteCupping(id);
    refreshCuppingsList();
  }

  // ===== ANALYSIS =====
  function refreshAnalysisDropdown() {
    const select = document.getElementById('analysis-coffee');
    const coffees = Store.getCoffees();

    const opts = ['<option value="">— Sélectionner un café —</option>'];
    coffees.forEach(c => {
      const roastCount = Store.getRoastsForCoffee(c.id).length;
      opts.push(`<option value="${c.id}">${_esc(c.name)} (${roastCount} torréfactions)</option>`);
    });
    select.innerHTML = opts.join('');
  }

  function runAnalysis(coffeeId) {
    const emptyEl = document.getElementById('analysis-empty');
    const resultsEl = document.getElementById('analysis-results');

    if (!coffeeId) {
      emptyEl.classList.remove('hidden');
      resultsEl.classList.add('hidden');
      return;
    }

    const analysisData = Store.getAnalysisData(coffeeId);

    if (!analysisData || analysisData.entries.length < 2) {
      emptyEl.innerHTML = '<p>Il faut au moins 2 torréfactions <strong>cuppées</strong> de ce café pour lancer une analyse.</p>';
      emptyEl.classList.remove('hidden');
      resultsEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');

    Analysis.renderResults({
      curves: 'chart-curves-overlay',
      radar: 'chart-sensory-radar',
      bars: 'chart-scores-bar',
    }, analysisData);
  }

  // ===== HELPERS =====
  function _numOrNull(val) {
    const str = typeof val === 'string' ? val.trim() : String(val ?? '');
    if (str === '') return null;
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  function _valOrEmpty(val) {
    return val != null ? val : '';
  }

  function _initBookmarklet() {
    const link = document.getElementById('bookmarklet-link');
    if (!link) return;

    // Inline bookmarklet — minified version of cropster-bookmarklet.js
    const bookmarklet = `javascript:(function(){'use strict';if(!window.location.hostname.includes('cropster.com')){alert("Socky1: Ouvrez cette page sur Cropster d'abord.");return}let p=null;const u=window.location.pathname;const m=u.match(/\\/apps\\/roast\\/details\\/([a-zA-Z0-9]+)/)||u.match(/processings\\/([a-zA-Z0-9]+)/);if(m)p=m[1];if(!p){const h=window.location.hash;const hm=h.match(/\\/apps\\/roast\\/details\\/([a-zA-Z0-9]+)/)||h.match(/processings\\/([a-zA-Z0-9]+)/);if(hm)p=hm[1]}if(!p){p=prompt("Socky1: ID du roast?");if(!p)return}const b='https://c-sar.cropster.com/api/v2',h={Accept:'application/vnd.api+json;charset=UTF-8'};const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:system-ui';o.innerHTML='<div style="background:%23231e19;color:%23f0e6dc;padding:2rem 3rem;border-radius:12px;text-align:center;border:2px solid %23d4915e"><h2 style="color:%23d4915e;margin:0 0 .5rem">Socky1</h2><p id=socky1-s>Chargement...</p></div>';document.body.appendChild(o);const s=document.getElementById('socky1-s');Promise.all([fetch(b+'/processingCurves?filter[processingCurves][processing]='+p,{headers:h,credentials:'include'}).then(r=>r.json()).catch(()=>null),fetch(b+'/processingMeasures?filter[processingMeasures][processing]='+p,{headers:h,credentials:'include'}).then(r=>r.json()).catch(()=>null),fetch(b+'/processings/'+p,{headers:h,credentials:'include'}).then(r=>r.json()).catch(()=>null)]).then(([c,me,pr])=>{if(!c||!c.data||!c.data.length){alert('Socky1: Aucune courbe.');o.remove();return}const e={socky1Export:true,version:1,exportedAt:new Date().toISOString(),processingId:p,curves:c,measures:me,processing:pr};let f='socky1_'+p;if(pr&&pr.data&&pr.data.attributes&&pr.data.attributes.startDate)f='socky1_'+pr.data.attributes.startDate.split('T')[0]+'_'+p;const bl=new Blob([JSON.stringify(e)],{type:'application/json'}),ul=URL.createObjectURL(bl),a=document.createElement('a');a.href=ul;a.download=f+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(ul);const n=c.data.find(x=>x.attributes&&x.attributes.name==='beanTemperature');s.textContent='Fichier téléchargé! '+(n?n.attributes.values.length+' points BT':'');setTimeout(()=>o.remove(),2500)}).catch(x=>{alert('Socky1: Erreur - '+x.message);o.remove()})})()`;

    link.href = bookmarklet;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Glissez ce bouton dans votre barre de favoris.\nNe cliquez pas dessus ici — il doit être utilisé depuis Cropster.');
    });
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function _processLabel(process) {
    const labels = {
      washed: 'Lavé',
      natural: 'Nature',
      honey: 'Honey',
      anaerobic: 'Anaérobie',
      other: 'Autre',
    };
    return labels[process] || process;
  }

  function _populateCoffeeDropdown(selectId) {
    const select = document.getElementById(selectId);
    const coffees = Store.getCoffees();
    const opts = ['<option value="">— Sélectionner un café —</option>'];
    coffees.forEach(c => {
      opts.push(`<option value="${c.id}">${_esc(c.name)} — ${_esc(c.origin || '')}</option>`);
    });
    select.innerHTML = opts.join('');
  }

  function _populateRoastDropdown(selectId) {
    const select = document.getElementById(selectId);
    const roasts = Store.getRoasts();
    const opts = ['<option value="">— Sélectionner —</option>'];
    roasts.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(r => {
      const coffee = Store.getCoffee(r.coffeeId);
      opts.push(`<option value="${r.id}">${_esc(coffee?.name || '?')} — ${r.date || '?'}${r.degree ? ` (${r.degree})` : ''}</option>`);
    });
    select.innerHTML = opts.join('');
  }

  // ===== INIT =====
  function init() {
    // Router
    initRouter();

    // Coffee form
    document.getElementById('btn-add-coffee').addEventListener('click', () => openCoffeeModal());
    document.getElementById('btn-close-coffee').addEventListener('click', () => document.getElementById('modal-coffee').classList.add('hidden'));
    document.getElementById('btn-cancel-coffee').addEventListener('click', () => document.getElementById('modal-coffee').classList.add('hidden'));
    document.getElementById('form-coffee').addEventListener('submit', (e) => { e.preventDefault(); saveCoffeeForm(); });

    // Roast form
    document.getElementById('btn-add-roast').addEventListener('click', () => openRoastModal());
    document.getElementById('btn-close-roast').addEventListener('click', () => document.getElementById('modal-roast').classList.add('hidden'));
    document.getElementById('btn-cancel-roast').addEventListener('click', () => document.getElementById('modal-roast').classList.add('hidden'));
    document.getElementById('form-roast').addEventListener('submit', (e) => { e.preventDefault(); saveRoastForm(); });
    document.getElementById('roast-curve-file').addEventListener('change', handleCurveFileUpload);
    document.getElementById('btn-parse-paste').addEventListener('click', handleCurvePaste);

    // Bookmarklet help
    document.getElementById('btn-bookmarklet-help').addEventListener('click', () => {
      document.getElementById('bookmarklet-help').classList.toggle('hidden');
    });
    _initBookmarklet();

    // Cupping form
    document.getElementById('btn-new-cupping').addEventListener('click', () => openCuppingModal());
    document.getElementById('btn-close-cupping').addEventListener('click', () => document.getElementById('modal-cupping').classList.add('hidden'));
    document.getElementById('btn-cancel-cupping').addEventListener('click', () => document.getElementById('modal-cupping').classList.add('hidden'));
    document.getElementById('form-cupping').addEventListener('submit', (e) => { e.preventDefault(); saveCuppingForm(); });

    // Init cupping form scoring
    CuppingForm.init();

    // Analysis
    document.getElementById('analysis-coffee').addEventListener('change', (e) => runAnalysis(e.target.value));

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

  // Public API (for onclick handlers)
  return {
    editCoffee, deleteCoffee,
    editRoast, deleteRoast, cuppRoast,
    editCupping, deleteCupping,
  };
})();
