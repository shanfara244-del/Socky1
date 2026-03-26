'use strict';

/**
 * Analysis — Correlation engine for Socky1
 *
 * Compares multiple roasts of the same coffee:
 * - Correlates roast parameters (DTR, charge temp, FC time, etc.) with cupping scores
 * - Generates actionable conclusions in French
 * - Identifies best/worst roasts per attribute
 */
const Analysis = (() => {

  const ROAST_PARAMS = [
    { key: 'chargeTemp', label: 'Charge (°C)', unit: '°C' },
    { key: 'turningPoint', label: 'Turning Point (°C)', unit: '°C' },
    { key: 'fcTime', label: 'Temps 1er Crack', unit: 's', isTime: true },
    { key: 'fcTemp', label: 'Temp 1er Crack (°C)', unit: '°C' },
    { key: 'dropTime', label: 'Temps Drop', unit: 's', isTime: true },
    { key: 'dropTemp', label: 'Temp Drop (°C)', unit: '°C' },
    { key: 'devTime', label: 'Développement', unit: 's', isTime: true },
    { key: 'dtr', label: 'DTR', unit: '%' },
    { key: 'weightLoss', label: 'Perte de poids', unit: '%' },
    { key: 'totalTime', label: 'Temps total', unit: 's', isTime: true },
  ];

  const SENSORY_ATTRS = [
    { key: 'fragrance', label: 'Fragrance/Arôme' },
    { key: 'flavor', label: 'Flavor' },
    { key: 'aftertaste', label: 'Aftertaste' },
    { key: 'acidity', label: 'Acidité' },
    { key: 'body', label: 'Body' },
    { key: 'balance', label: 'Balance' },
    { key: 'overall', label: 'Overall' },
  ];

  /**
   * Compute Pearson correlation between two arrays
   */
  function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return { r: 0, significant: false };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denom === 0) return { r: 0, significant: false };

    const r = (n * sumXY - sumX * sumY) / denom;
    // Simple significance: |r| > 0.5 and n >= 3
    return { r, significant: Math.abs(r) > 0.5 && n >= 3 };
  }

  /**
   * Run full correlation analysis
   * @param {Array} entries - from Store.getAnalysisData().entries
   * @returns {object} { correlations, conclusions, bestRoast, comparison }
   */
  function analyze(entries) {
    if (!entries || entries.length < 2) {
      return { correlations: [], conclusions: [], bestRoast: null, comparison: [] };
    }

    const correlations = _computeCorrelations(entries);
    const conclusions = _generateConclusions(entries, correlations);
    const bestRoast = _findBestRoast(entries);
    const comparison = _buildComparison(entries);

    return { correlations, conclusions, bestRoast, comparison };
  }

  function _computeCorrelations(entries) {
    const results = [];

    for (const param of ROAST_PARAMS) {
      const paramValues = entries.map(e => {
        let val = e.params[param.key];
        if (val == null) return null;
        if (param.isTime && typeof val === 'string') {
          val = CurveParser.parseTimeStr(val);
        }
        return typeof val === 'number' ? val : parseFloat(val);
      });

      // Skip if not enough valid values
      const validCount = paramValues.filter(v => v != null && !isNaN(v)).length;
      if (validCount < 3) continue;

      // Correlate with total score
      const totalScores = entries.map(e => e.avgTotal);
      const validPairs = _getValidPairs(paramValues, totalScores);

      if (validPairs.x.length >= 3) {
        const { r, significant } = pearson(validPairs.x, validPairs.y);
        results.push({
          param: param.key,
          paramLabel: param.label,
          target: 'Score total',
          targetKey: 'total',
          r: parseFloat(r.toFixed(3)),
          significant,
          n: validPairs.x.length,
        });
      }

      // Correlate with individual sensory attributes
      for (const attr of SENSORY_ATTRS) {
        const attrValues = entries.map(e => e.avgScores[attr.key] || 0);
        const validPairsAttr = _getValidPairs(paramValues, attrValues);

        if (validPairsAttr.x.length >= 3) {
          const { r, significant } = pearson(validPairsAttr.x, validPairsAttr.y);
          if (Math.abs(r) > 0.3) { // Only keep notable correlations
            results.push({
              param: param.key,
              paramLabel: param.label,
              target: attr.label,
              targetKey: attr.key,
              r: parseFloat(r.toFixed(3)),
              significant,
              n: validPairsAttr.x.length,
            });
          }
        }
      }
    }

    // Sort by absolute correlation strength
    results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return results;
  }

  function _getValidPairs(x, y) {
    const validX = [], validY = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] != null && !isNaN(x[i]) && y[i] != null && !isNaN(y[i])) {
        validX.push(x[i]);
        validY.push(y[i]);
      }
    }
    return { x: validX, y: validY };
  }

  function _findBestRoast(entries) {
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => e.avgTotal > best.avgTotal ? e : best, entries[0]);
  }

  function _buildComparison(entries) {
    return entries.map(e => {
      const row = {
        date: e.roast.date || '—',
        totalScore: e.avgTotal.toFixed(1),
      };

      for (const attr of SENSORY_ATTRS) {
        row[attr.key] = (e.avgScores[attr.key] || 0).toFixed(2);
      }

      for (const param of ROAST_PARAMS) {
        let val = e.params[param.key];
        if (val == null) {
          row[param.key] = '—';
        } else if (param.isTime && typeof val === 'number') {
          row[param.key] = CurveParser.formatTime(val);
        } else {
          row[param.key] = val;
        }
      }

      return row;
    });
  }

  function _generateConclusions(entries, correlations) {
    const conclusions = [];
    const best = _findBestRoast(entries);
    const worst = entries.reduce((w, e) => e.avgTotal < w.avgTotal ? e : w, entries[0]);

    if (best && worst && best !== worst) {
      const diff = (best.avgTotal - worst.avgTotal).toFixed(1);
      conclusions.push({
        type: 'insight',
        text: `Écart de ${diff} points entre la meilleure torréfaction (${best.roast.date}, ${best.avgTotal.toFixed(1)} pts) et la moins bonne (${worst.roast.date}, ${worst.avgTotal.toFixed(1)} pts).`,
      });
    }

    // Best roast parameters
    if (best) {
      const params = [];
      if (best.params.dtr) params.push(`DTR ${best.params.dtr}%`);
      if (best.params.devTime) params.push(`dev ${best.params.devTime}`);
      if (best.params.fcTemp) params.push(`FC à ${best.params.fcTemp}°C`);
      if (best.params.dropTemp) params.push(`drop à ${best.params.dropTemp}°C`);

      if (params.length > 0) {
        conclusions.push({
          type: 'positive',
          text: `Meilleur résultat en tasse avec : ${params.join(', ')}.`,
        });
      }
    }

    // Strong correlations
    const strongCorrs = correlations.filter(c => c.significant && c.targetKey === 'total');
    for (const corr of strongCorrs.slice(0, 3)) {
      const direction = corr.r > 0 ? 'augmente' : 'diminue';
      const impact = Math.abs(corr.r) > 0.7 ? 'forte' : 'modérée';
      conclusions.push({
        type: corr.r > 0 ? 'positive' : 'negative',
        text: `Corrélation ${impact} (r=${corr.r.toFixed(2)}) : quand ${corr.paramLabel} augmente, le score total ${direction}.`,
      });
    }

    // Attribute-specific insights
    const attrCorrs = correlations.filter(c => c.significant && c.targetKey !== 'total');
    for (const corr of attrCorrs.slice(0, 5)) {
      const direction = corr.r > 0 ? 'améliore' : 'dégrade';
      conclusions.push({
        type: 'insight',
        text: `${corr.paramLabel} ${direction} ${corr.target} (r=${corr.r.toFixed(2)}).`,
      });
    }

    // DTR-specific analysis (key roasting parameter)
    const dtrValues = entries.map(e => e.params.dtr).filter(v => v != null);
    if (dtrValues.length >= 2) {
      const avgDtr = dtrValues.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / dtrValues.length;
      if (avgDtr < 15) {
        conclusions.push({
          type: 'negative',
          text: `DTR moyen de ${avgDtr.toFixed(1)}% — possiblement sous-développé. Essayez d'allonger la phase de développement.`,
        });
      } else if (avgDtr > 25) {
        conclusions.push({
          type: 'negative',
          text: `DTR moyen de ${avgDtr.toFixed(1)}% — risque de perte de complexité aromatique. Essayez de raccourcir le développement.`,
        });
      }
    }

    // Weight loss analysis
    const wlValues = entries.map(e => e.params.weightLoss).filter(v => v != null);
    if (wlValues.length >= 2) {
      const avgWl = wlValues.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / wlValues.length;
      if (avgWl < 11) {
        conclusions.push({
          type: 'insight',
          text: `Perte de poids moyenne de ${avgWl.toFixed(1)}% — torréfaction très claire. Vérifiez le développement des sucres.`,
        });
      } else if (avgWl > 16) {
        conclusions.push({
          type: 'insight',
          text: `Perte de poids moyenne de ${avgWl.toFixed(1)}% — torréfaction foncée. Risque de perte d'acidité et de notes d'origine.`,
        });
      }
    }

    if (conclusions.length === 0) {
      conclusions.push({
        type: 'insight',
        text: 'Pas assez de données pour tirer des conclusions significatives. Continuez à torréfier et cupper ce café pour enrichir l\'analyse.',
      });
    }

    return conclusions;
  }

  /**
   * Render analysis results into the DOM
   */
  function renderResults(canvasIds, analysisData) {
    const { entries } = analysisData;
    const results = analyze(entries);

    // Charts
    Charts.renderCurvesOverlay(canvasIds.curves, entries);
    Charts.renderSensoryRadar(canvasIds.radar, entries);
    Charts.renderScoresBar(canvasIds.bars, entries);

    // Correlations grid
    _renderCorrelations(results.correlations);

    // Comparison table
    _renderComparisonTable(entries, results.comparison);

    // Conclusions
    _renderConclusions(results.conclusions);
  }

  function _renderCorrelations(correlations) {
    const container = document.getElementById('correlations-grid');
    if (!container) return;

    const significant = correlations.filter(c => Math.abs(c.r) > 0.3);

    if (significant.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:1rem">Pas assez de données pour calculer des corrélations fiables.</p>';
      return;
    }

    container.innerHTML = significant.slice(0, 8).map(c => {
      const colorClass = c.r > 0.3 ? 'positive' : c.r < -0.3 ? 'negative' : 'neutral';
      const arrow = c.r > 0 ? '&uarr;' : '&darr;';
      const insight = _getCorrelationInsight(c);

      return `
        <div class="correlation-card">
          <div class="correlation-param">${c.paramLabel}</div>
          <div class="correlation-target">${arrow} ${c.target}</div>
          <div class="correlation-value ${colorClass}">r = ${c.r.toFixed(2)}</div>
          ${insight ? `<div class="correlation-insight">${insight}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function _getCorrelationInsight(c) {
    const strength = Math.abs(c.r) > 0.7 ? 'forte' : 'modérée';
    const direction = c.r > 0 ? 'positivement' : 'négativement';
    return `Corrélation ${strength} — influence ${direction} (n=${c.n})`;
  }

  function _renderComparisonTable(entries, comparison) {
    const table = document.getElementById('comparison-table');
    if (!table || comparison.length === 0) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Headers
    const paramHeaders = ROAST_PARAMS
      .filter(p => entries.some(e => e.params[p.key] != null))
      .map(p => `<th>${p.label}</th>`).join('');

    const sensoryHeaders = SENSORY_ATTRS.map(a => `<th>${a.label}</th>`).join('');

    thead.innerHTML = `<tr><th>Date</th><th>Score</th>${sensoryHeaders}${paramHeaders}</tr>`;

    // Find best values for highlighting
    const bestTotal = Math.max(...comparison.map(r => parseFloat(r.totalScore)));

    tbody.innerHTML = comparison.map(row => {
      const isBest = parseFloat(row.totalScore) === bestTotal;
      const scoreClass = isBest ? 'best-value' : '';

      const paramCells = ROAST_PARAMS
        .filter(p => entries.some(e => e.params[p.key] != null))
        .map(p => `<td>${row[p.key]}</td>`).join('');

      const sensoryCells = SENSORY_ATTRS.map(a => `<td>${row[a.key]}</td>`).join('');

      return `<tr>
        <td>${row.date}</td>
        <td class="${scoreClass}">${row.totalScore}</td>
        ${sensoryCells}${paramCells}
      </tr>`;
    }).join('');
  }

  function _renderConclusions(conclusions) {
    const container = document.getElementById('analysis-conclusions');
    if (!container) return;

    if (conclusions.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune conclusion à tirer pour le moment.</p>';
      return;
    }

    container.innerHTML = conclusions.map(c =>
      `<div class="conclusion-item ${c.type}">${c.text}</div>`
    ).join('');
  }

  return { analyze, renderResults, pearson, ROAST_PARAMS, SENSORY_ATTRS };
})();
