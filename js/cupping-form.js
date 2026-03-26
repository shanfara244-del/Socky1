'use strict';

/**
 * CuppingForm — SCA Cupping Protocol scoring logic
 *
 * Score ranges (SCA standard):
 * - Fragrance/Aroma, Flavor, Aftertaste, Acidity, Body, Balance, Overall: 6.00–10.00 (0.25 steps)
 * - Uniformity, Clean Cup, Sweetness: 0–10 (2 points per cup, 5 cups)
 * - Defects: Taint (x2 per cup) + Fault (x4 per cup), subtracted from total
 * - Total: max 100
 *
 * Quality scale:
 *  90–100: Outstanding (Specialty - Grand Cru)
 *  85–89.99: Excellent (Specialty)
 *  80–84.99: Very Good (Specialty threshold)
 *  < 80: Below Specialty Grade
 */
const CuppingForm = (() => {

  const SLIDER_ATTRIBUTES = ['fragrance', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'overall'];
  const CUP_ATTRIBUTES = ['uniformity', 'cleanCup', 'sweetness'];
  const CUP_ATTR_IDS = { uniformity: 'uniformity', cleanCup: 'clean_cup', sweetness: 'sweetness' };

  function init() {
    _bindSliders();
    _bindCupChecks();
    _bindDefects();
    updateTotal();
  }

  function _bindSliders() {
    for (const attr of SLIDER_ATTRIBUTES) {
      const slider = document.getElementById(`score-${attr}`);
      const output = document.getElementById(`val-${attr}`);
      if (!slider || !output) continue;

      slider.addEventListener('input', () => {
        output.textContent = parseFloat(slider.value).toFixed(2);
        updateTotal();
      });

      // Set initial display
      output.textContent = parseFloat(slider.value).toFixed(2);
    }
  }

  function _bindCupChecks() {
    const checks = document.querySelectorAll('.cup-check input[type="checkbox"]');
    checks.forEach(cb => {
      cb.addEventListener('change', () => {
        const attr = cb.dataset.attr;
        _updateCupScore(attr);
        updateTotal();
      });
    });
  }

  function _updateCupScore(attr) {
    const checks = document.querySelectorAll(`input[data-attr="${attr}"]`);
    let score = 0;
    checks.forEach(cb => { if (cb.checked) score += 2; });
    const output = document.getElementById(`val-${attr}`);
    if (output) output.textContent = score;
  }

  function _bindDefects() {
    const taintInput = document.getElementById('defect-taint-count');
    const faultInput = document.getElementById('defect-fault-count');
    const output = document.getElementById('val-defects');

    const update = () => {
      const taint = (parseInt(taintInput?.value) || 0) * 2;
      const fault = (parseInt(faultInput?.value) || 0) * 4;
      if (output) output.textContent = taint + fault;
      updateTotal();
    };

    taintInput?.addEventListener('input', update);
    faultInput?.addEventListener('input', update);
  }

  function getScores() {
    const scores = {};

    for (const attr of SLIDER_ATTRIBUTES) {
      const slider = document.getElementById(`score-${attr}`);
      scores[attr] = slider ? parseFloat(slider.value) : 6;
    }

    for (const attr of CUP_ATTRIBUTES) {
      const htmlId = CUP_ATTR_IDS[attr];
      const checks = document.querySelectorAll(`input[data-attr="${htmlId}"]`);
      let val = 0;
      checks.forEach(cb => { if (cb.checked) val += 2; });
      scores[attr] = val;
    }

    const taint = (parseInt(document.getElementById('defect-taint-count')?.value) || 0) * 2;
    const fault = (parseInt(document.getElementById('defect-fault-count')?.value) || 0) * 4;
    scores.defects = taint + fault;

    return scores;
  }

  function calculateTotal(scores) {
    let total = 0;
    for (const attr of SLIDER_ATTRIBUTES) {
      total += scores[attr] || 0;
    }
    for (const attr of CUP_ATTRIBUTES) {
      total += scores[attr] || 0;
    }
    total -= scores.defects || 0;
    return Math.max(0, parseFloat(total.toFixed(2)));
  }

  function updateTotal() {
    const scores = getScores();
    const total = calculateTotal(scores);

    const totalEl = document.getElementById('cupping-total-score');
    const qualityEl = document.getElementById('cupping-quality-label');

    if (totalEl) totalEl.textContent = total.toFixed(2);
    if (qualityEl) qualityEl.textContent = getQualityLabel(total);
  }

  function getQualityLabel(score) {
    if (score >= 90) return 'Outstanding — Grand Cru';
    if (score >= 85) return 'Excellent — Specialty';
    if (score >= 80) return 'Very Good — Specialty';
    if (score >= 70) return 'Good — Pas specialty';
    return 'Below Standard';
  }

  function getDescriptors() {
    const descriptors = {};
    for (const attr of SLIDER_ATTRIBUTES) {
      const input = document.getElementById(`desc-${attr}`);
      if (input && input.value.trim()) {
        descriptors[attr] = input.value.trim().split(/[,;]+/).map(d => d.trim()).filter(Boolean);
      }
    }

    // Acidity qualifiers
    const acidityQuals = [];
    if (document.getElementById('acidity-bright')?.checked) acidityQuals.push('vive');
    if (document.getElementById('acidity-crisp')?.checked) acidityQuals.push('nette');
    if (document.getElementById('acidity-flat')?.checked) acidityQuals.push('plate');
    if (document.getElementById('acidity-sour')?.checked) acidityQuals.push('aigre');
    if (acidityQuals.length > 0) descriptors.acidityQuality = acidityQuals;

    // Body qualifiers
    const bodyQuals = [];
    if (document.getElementById('body-light')?.checked) bodyQuals.push('léger');
    if (document.getElementById('body-medium')?.checked) bodyQuals.push('moyen');
    if (document.getElementById('body-full')?.checked) bodyQuals.push('plein');
    if (document.getElementById('body-creamy')?.checked) bodyQuals.push('crémeux');
    if (bodyQuals.length > 0) descriptors.bodyQuality = bodyQuals;

    // Defect type
    const defectType = document.getElementById('defect-type')?.value;
    if (defectType) descriptors.defectType = defectType;

    return descriptors;
  }

  function setScores(scores, descriptors) {
    if (!scores) return;

    for (const attr of SLIDER_ATTRIBUTES) {
      const slider = document.getElementById(`score-${attr}`);
      const output = document.getElementById(`val-${attr}`);
      if (slider && scores[attr] != null) {
        slider.value = scores[attr];
        if (output) output.textContent = parseFloat(scores[attr]).toFixed(2);
      }
    }

    for (const attr of CUP_ATTRIBUTES) {
      const htmlId = CUP_ATTR_IDS[attr];
      const checks = document.querySelectorAll(`input[data-attr="${htmlId}"]`);
      const cupCount = Math.floor((scores[attr] || 10) / 2);
      checks.forEach((cb, i) => { cb.checked = i < cupCount; });
      _updateCupScore(htmlId);
    }

    const defects = scores.defects || 0;
    const taintInput = document.getElementById('defect-taint-count');
    const faultInput = document.getElementById('defect-fault-count');
    // Best effort: assign to taint first
    if (taintInput) taintInput.value = Math.floor(defects / 2);
    if (faultInput) faultInput.value = 0;

    // Descriptors
    if (descriptors) {
      for (const attr of SLIDER_ATTRIBUTES) {
        const input = document.getElementById(`desc-${attr}`);
        if (input && descriptors[attr]) {
          input.value = Array.isArray(descriptors[attr]) ? descriptors[attr].join(', ') : descriptors[attr];
        }
      }

      // Restore acidity qualifiers
      const acidityMap = { vive: 'acidity-bright', nette: 'acidity-crisp', plate: 'acidity-flat', aigre: 'acidity-sour' };
      if (descriptors.acidityQuality) {
        for (const q of descriptors.acidityQuality) {
          const el = document.getElementById(acidityMap[q]);
          if (el) el.checked = true;
        }
      }

      // Restore body qualifiers
      const bodyMap = { 'léger': 'body-light', moyen: 'body-medium', plein: 'body-full', 'crémeux': 'body-creamy' };
      if (descriptors.bodyQuality) {
        for (const q of descriptors.bodyQuality) {
          const el = document.getElementById(bodyMap[q]);
          if (el) el.checked = true;
        }
      }

      // Restore defect type
      if (descriptors.defectType) {
        const defectEl = document.getElementById('defect-type');
        if (defectEl) defectEl.value = descriptors.defectType;
      }
    }

    updateTotal();
  }

  function reset() {
    for (const attr of SLIDER_ATTRIBUTES) {
      const slider = document.getElementById(`score-${attr}`);
      if (slider) slider.value = 6;
    }

    const checks = document.querySelectorAll('.cup-check input[type="checkbox"]');
    checks.forEach(cb => { cb.checked = true; });

    document.querySelectorAll('.descriptor-input').forEach(i => { i.value = ''; });
    document.querySelectorAll('.form-row-inline input[type="checkbox"]').forEach(cb => { cb.checked = false; });

    const taintInput = document.getElementById('defect-taint-count');
    const faultInput = document.getElementById('defect-fault-count');
    if (taintInput) taintInput.value = 0;
    if (faultInput) faultInput.value = 0;

    const defectType = document.getElementById('defect-type');
    if (defectType) defectType.value = '';

    const notesEl = document.getElementById('cupping-notes');
    if (notesEl) notesEl.value = '';

    updateTotal();
  }

  return { init, getScores, calculateTotal, updateTotal, getQualityLabel, getDescriptors, setScores, reset };
})();
