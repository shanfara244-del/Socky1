'use strict';

/**
 * Analysis — Correlation engine for Socky1
 *
 * Compares multiple roasts of the same coffee:
 * - Correlates roast parameters with cupping scores (Pearson)
 * - Auto-detects roast phases from curve data
 * - Analyzes RoR patterns (crash, flick, stall)
 * - Generates actionable conclusions with roasting knowledge
 * - Exports analysis as PDF
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
    { key: 'agtronWhole', label: 'Agtron entier', unit: '' },
    { key: 'agtronGround', label: 'Agtron moulu', unit: '' },
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

  // ===== PEARSON CORRELATION =====
  function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return { r: 0, significant: false };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }

    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denom === 0) return { r: 0, significant: false };

    const r = (n * sumXY - sumX * sumY) / denom;
    return { r, significant: Math.abs(r) > 0.5 && n >= 3 };
  }

  // ===== MAIN ANALYSIS =====
  function analyze(entries) {
    if (!entries || entries.length < 2) {
      return { correlations: [], conclusions: [], bestRoast: null, comparison: [], curveAnalyses: [] };
    }

    const correlations = _computeCorrelations(entries);
    const bestRoast = _findBestRoast(entries);
    const comparison = _buildComparison(entries);

    // Curve analysis per entry
    const curveAnalyses = entries.map(e => {
      if (!e.roast.curveData) return null;
      return CurveParser.analyzeCurve(e.roast.curveData, e.params);
    });

    const conclusions = _generateConclusions(entries, correlations, curveAnalyses);

    return { correlations, conclusions, bestRoast, comparison, curveAnalyses };
  }

  function _computeCorrelations(entries) {
    const results = [];

    for (const param of ROAST_PARAMS) {
      const paramValues = entries.map(e => {
        let val = e.params[param.key];
        if (val == null) return null;
        if (param.isTime && typeof val === 'string') val = CurveParser.parseTimeStr(val);
        return typeof val === 'number' ? val : parseFloat(val);
      });

      const validCount = paramValues.filter(v => v != null && !isNaN(v)).length;
      if (validCount < 3) continue;

      const totalScores = entries.map(e => e.avgTotal);
      const validPairs = _getValidPairs(paramValues, totalScores);

      if (validPairs.x.length >= 3) {
        const { r, significant } = pearson(validPairs.x, validPairs.y);
        results.push({
          param: param.key, paramLabel: param.label,
          target: 'Score total', targetKey: 'total',
          r: parseFloat(r.toFixed(3)), significant, n: validPairs.x.length,
        });
      }

      for (const attr of SENSORY_ATTRS) {
        const attrValues = entries.map(e => e.avgScores[attr.key] || 0);
        const validPairsAttr = _getValidPairs(paramValues, attrValues);
        if (validPairsAttr.x.length >= 3) {
          const { r, significant } = pearson(validPairsAttr.x, validPairsAttr.y);
          if (Math.abs(r) > 0.3) {
            results.push({
              param: param.key, paramLabel: param.label,
              target: attr.label, targetKey: attr.key,
              r: parseFloat(r.toFixed(3)), significant, n: validPairsAttr.x.length,
            });
          }
        }
      }
    }

    results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return results;
  }

  function _getValidPairs(x, y) {
    const vx = [], vy = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] != null && !isNaN(x[i]) && y[i] != null && !isNaN(y[i])) {
        vx.push(x[i]); vy.push(y[i]);
      }
    }
    return { x: vx, y: vy };
  }

  function _findBestRoast(entries) {
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => e.avgTotal > best.avgTotal ? e : best, entries[0]);
  }

  function _buildComparison(entries) {
    return entries.map(e => {
      const row = { date: e.roast.date || '—', totalScore: e.avgTotal.toFixed(1) };
      for (const attr of SENSORY_ATTRS) row[attr.key] = (e.avgScores[attr.key] || 0).toFixed(2);
      for (const param of ROAST_PARAMS) {
        let val = e.params[param.key];
        if (val == null) row[param.key] = '—';
        else if (param.isTime && typeof val === 'number') row[param.key] = CurveParser.formatTime(val);
        else row[param.key] = val;
      }
      return row;
    });
  }

  // ===== CONCLUSIONS ENGINE =====
  function _generateConclusions(entries, correlations, curveAnalyses) {
    const conclusions = [];
    const best = _findBestRoast(entries);
    const worst = entries.reduce((w, e) => e.avgTotal < w.avgTotal ? e : w, entries[0]);

    // Score spread
    if (best && worst && best !== worst) {
      const diff = (best.avgTotal - worst.avgTotal).toFixed(1);
      conclusions.push({
        type: 'insight',
        text: `Écart de ${diff} points entre la meilleure torréfaction (${best.roast.date}, ${best.avgTotal.toFixed(1)} pts) et la moins bonne (${worst.roast.date}, ${worst.avgTotal.toFixed(1)} pts).`,
      });
    }

    // Best roast profile
    if (best) {
      const params = [];
      if (best.params.dtr) params.push(`DTR ${best.params.dtr}%`);
      if (best.params.devTime) params.push(`dev ${best.params.devTime}`);
      if (best.params.fcTemp) params.push(`FC à ${best.params.fcTemp}°C`);
      if (best.params.dropTemp) params.push(`drop à ${best.params.dropTemp}°C`);
      if (best.params.weightLoss) params.push(`perte ${best.params.weightLoss}%`);
      if (params.length > 0) {
        conclusions.push({ type: 'positive', text: `Meilleur résultat en tasse avec : ${params.join(', ')}.` });
      }
    }

    // Strong total correlations
    const strongCorrs = correlations.filter(c => c.significant && c.targetKey === 'total');
    for (const corr of strongCorrs.slice(0, 3)) {
      const direction = corr.r > 0 ? 'augmente' : 'diminue';
      const impact = Math.abs(corr.r) > 0.7 ? 'forte' : 'modérée';
      conclusions.push({
        type: corr.r > 0 ? 'positive' : 'negative',
        text: `Corrélation ${impact} (r=${corr.r.toFixed(2)}) : quand ${corr.paramLabel} augmente, le score total ${direction}.`,
      });
    }

    // Attribute-specific correlations
    const attrCorrs = correlations.filter(c => c.significant && c.targetKey !== 'total');
    for (const corr of attrCorrs.slice(0, 5)) {
      const direction = corr.r > 0 ? 'améliore' : 'dégrade';
      conclusions.push({ type: 'insight', text: `${corr.paramLabel} ${direction} ${corr.target} (r=${corr.r.toFixed(2)}).` });
    }

    // DTR analysis with roasting knowledge
    const dtrValues = entries.map(e => e.params.dtr).filter(v => v != null);
    if (dtrValues.length >= 2) {
      const avgDtr = dtrValues.reduce((a, b) => Number(a) + Number(b), 0) / dtrValues.length;
      if (avgDtr < 15) {
        conclusions.push({ type: 'negative', text: `DTR moyen ${avgDtr.toFixed(1)}% — sous-développé. Goût herbacé, acide aigre, astringent probable. Allongez le développement post-crack.` });
      } else if (avgDtr < 18) {
        conclusions.push({ type: 'insight', text: `DTR moyen ${avgDtr.toFixed(1)}% — développement léger. Acidité vive préservée, notes florales/fruitées dominantes. Adapté aux cafés haute altitude.` });
      } else if (avgDtr >= 18 && avgDtr <= 25) {
        conclusions.push({ type: 'positive', text: `DTR moyen ${avgDtr.toFixed(1)}% — zone optimale. Bon équilibre acidité/sucrosité/body.` });
      } else if (avgDtr > 25) {
        conclusions.push({ type: 'negative', text: `DTR moyen ${avgDtr.toFixed(1)}% — développement long. Perte d'acidité et de notes d'origine, dominantes chocolat/caramel/toast.` });
      }
    }

    // Weight loss
    const wlValues = entries.map(e => e.params.weightLoss).filter(v => v != null);
    if (wlValues.length >= 2) {
      const avgWl = wlValues.reduce((a, b) => Number(a) + Number(b), 0) / wlValues.length;
      if (avgWl < 11) {
        conclusions.push({ type: 'insight', text: `Perte de poids ${avgWl.toFixed(1)}% — très claire. Vérifiez que les sucres sont développés (risque de goût céréale/herbacé).` });
      } else if (avgWl > 16) {
        conclusions.push({ type: 'negative', text: `Perte de poids ${avgWl.toFixed(1)}% — foncée. Les notes d'origine sont probablement masquées par les notes de torréfaction.` });
      }
    }

    // Agtron analysis
    const agtronEntries = entries.filter(e => e.params.agtronWhole != null && e.params.agtronGround != null);
    if (agtronEntries.length >= 1) {
      for (const e of agtronEntries) {
        const diff = e.params.agtronWhole - e.params.agtronGround;
        if (diff > 15) {
          conclusions.push({
            type: 'negative',
            text: `${e.roast.date} : écart Agtron entier/moulu de ${diff} pts — développement inégal. L'intérieur du grain est plus clair que l'extérieur (sous-développé au coeur).`,
          });
        } else if (diff <= 5 && diff >= 0) {
          conclusions.push({
            type: 'positive',
            text: `${e.roast.date} : écart Agtron entier/moulu de ${diff} pts — développement très homogène.`,
          });
        }
      }
    }

    // Total roast time
    const totalTimeValues = entries.map(e => {
      const t = e.params.totalTime;
      if (!t) return null;
      return typeof t === 'string' ? CurveParser.parseTimeStr(t) : t;
    }).filter(v => v != null);

    if (totalTimeValues.length >= 2) {
      const avgTime = totalTimeValues.reduce((a, b) => a + b, 0) / totalTimeValues.length;
      if (avgTime < 480) {
        conclusions.push({ type: 'negative', text: `Temps total moyen ${CurveParser.formatTime(avgTime)} — très rapide. Risque de scorching (brûlé en surface, sous-développé à l'intérieur).` });
      } else if (avgTime > 900) {
        conclusions.push({ type: 'negative', text: `Temps total moyen ${CurveParser.formatTime(avgTime)} — très long. Risque de baking (plat, carton, perte de vivacité).` });
      }
    }

    // Curve-specific warnings (from curveAnalyses)
    if (curveAnalyses) {
      const bestIdx = entries.indexOf(best);
      const bestAnalysis = curveAnalyses[bestIdx];
      if (bestAnalysis?.phases) {
        const p = bestAnalysis.phases;
        conclusions.push({
          type: 'positive',
          text: `Meilleure torréfaction — phases : séchage ${p.dryingPct.toFixed(0)}%, Maillard ${p.maillardPct.toFixed(0)}%, développement ${p.devPct.toFixed(0)}%.`,
        });
      }
    }

    if (conclusions.length === 0) {
      conclusions.push({ type: 'insight', text: 'Pas assez de données pour tirer des conclusions significatives. Continuez à torréfier et cupper ce café.' });
    }

    return conclusions;
  }

  // ===== RENDERING =====
  function renderResults(canvasIds, analysisData) {
    const { entries } = analysisData;
    const results = analyze(entries);

    // Charts
    Charts.renderCurvesOverlay(canvasIds.curves, entries);
    Charts.renderSensoryRadar(canvasIds.radar, entries);
    Charts.renderScoresBar(canvasIds.bars, entries);

    // Phase bars
    _renderPhases(entries, results.curveAnalyses);

    // Curve warnings
    _renderCurveWarnings(entries, results.curveAnalyses);

    // Correlations
    _renderCorrelations(results.correlations);

    // Comparison table
    _renderComparisonTable(entries, results.comparison);

    // Conclusions
    _renderConclusions(results.conclusions);

    // Bind PDF export
    const btn = document.getElementById('btn-export-pdf');
    if (btn) {
      btn.onclick = () => exportPDF(analysisData.coffee, entries, results);
    }
  }

  function _renderPhases(entries, curveAnalyses) {
    const container = document.getElementById('phases-grid');
    if (!container) return;

    const ROAST_COLORS = ['#d4915e', '#5d9ac7', '#6db87b', '#c75d5d', '#d4b85e', '#9b6db8'];
    const rows = [];

    entries.forEach((entry, idx) => {
      const analysis = curveAnalyses?.[idx];
      if (!analysis?.phases) return;

      const p = analysis.phases;
      const color = ROAST_COLORS[idx % ROAST_COLORS.length];
      const label = entry.roast.date || `T${idx + 1}`;

      rows.push(`
        <div class="phase-row">
          <span class="phase-label" style="color:${color}">${label}</span>
          <div class="phase-bar-container">
            <div class="phase-segment drying" style="width:${p.dryingPct}%">${p.dryingPct.toFixed(0)}%</div>
            <div class="phase-segment maillard" style="width:${p.maillardPct}%">${p.maillardPct.toFixed(0)}%</div>
            <div class="phase-segment development" style="width:${p.devPct}%">${p.devPct.toFixed(0)}%</div>
          </div>
          <span class="phase-score">${entry.avgTotal.toFixed(1)}</span>
        </div>
      `);
    });

    if (rows.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:1rem">Pas de courbes disponibles pour calculer les phases.</p>';
      return;
    }

    container.innerHTML = rows.join('') + `
      <div class="phase-legend">
        <span class="phase-legend-item"><span class="phase-legend-dot drying"></span> Séchage</span>
        <span class="phase-legend-item"><span class="phase-legend-dot maillard"></span> Maillard</span>
        <span class="phase-legend-item"><span class="phase-legend-dot development"></span> Développement</span>
      </div>
    `;
  }

  function _renderCurveWarnings(entries, curveAnalyses) {
    const container = document.getElementById('curve-warnings');
    const panel = document.getElementById('panel-curve-warnings');
    if (!container || !panel) return;

    const allWarnings = [];
    entries.forEach((entry, idx) => {
      const analysis = curveAnalyses?.[idx];
      if (!analysis?.warnings?.length) return;
      const label = entry.roast.date || `T${idx + 1}`;
      for (const w of analysis.warnings) {
        allWarnings.push({ ...w, text: `[${label}] ${w.text}` });
      }
    });

    if (allWarnings.length === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = '';
    container.innerHTML = allWarnings.map(w =>
      `<div class="conclusion-item ${w.type}">${w.text}</div>`
    ).join('');
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
      const strength = Math.abs(c.r) > 0.7 ? 'forte' : 'modérée';
      const direction = c.r > 0 ? 'positivement' : 'négativement';

      return `
        <div class="correlation-card">
          <div class="correlation-param">${c.paramLabel}</div>
          <div class="correlation-target">${arrow} ${c.target}</div>
          <div class="correlation-value ${colorClass}">r = ${c.r.toFixed(2)}</div>
          <div class="correlation-insight">Corrélation ${strength} — influence ${direction} (n=${c.n})</div>
        </div>
      `;
    }).join('');
  }

  function _renderComparisonTable(entries, comparison) {
    const table = document.getElementById('comparison-table');
    if (!table || comparison.length === 0) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    const paramHeaders = ROAST_PARAMS
      .filter(p => entries.some(e => e.params[p.key] != null))
      .map(p => `<th>${p.label}</th>`).join('');

    const sensoryHeaders = SENSORY_ATTRS.map(a => `<th>${a.label}</th>`).join('');

    thead.innerHTML = `<tr><th>Date</th><th>Score</th>${sensoryHeaders}${paramHeaders}</tr>`;

    const bestTotal = Math.max(...comparison.map(r => parseFloat(r.totalScore)));

    tbody.innerHTML = comparison.map(row => {
      const isBest = parseFloat(row.totalScore) === bestTotal;
      const scoreClass = isBest ? 'best-value' : '';

      const paramCells = ROAST_PARAMS
        .filter(p => entries.some(e => e.params[p.key] != null))
        .map(p => `<td>${row[p.key]}</td>`).join('');

      const sensoryCells = SENSORY_ATTRS.map(a => `<td>${row[a.key]}</td>`).join('');

      return `<tr><td>${row.date}</td><td class="${scoreClass}">${row.totalScore}</td>${sensoryCells}${paramCells}</tr>`;
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

  // ===== PDF EXPORT =====
  function exportPDF(coffee, entries, results) {
    const title = `Analyse — ${coffee?.name || 'Café'} (${coffee?.origin || ''})`;
    const date = new Date().toLocaleDateString('fr-FR');

    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1612; max-width: 900px; margin: 0 auto; padding: 2rem; font-size: 13px; }
          h1 { font-size: 1.5rem; border-bottom: 2px solid #d4915e; padding-bottom: 0.5rem; }
          h2 { font-size: 1.1rem; color: #8a7b6c; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
          table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 12px; }
          th, td { padding: 0.4rem 0.6rem; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f0eb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
          .best { color: #2d7a3e; font-weight: 600; }
          .conclusion { padding: 0.5rem 0.75rem; margin: 0.3rem 0; border-left: 3px solid #d4915e; background: #fdf8f3; border-radius: 4px; }
          .conclusion.positive { border-left-color: #2d7a3e; background: #f0f8f2; }
          .conclusion.negative { border-left-color: #c75d5d; background: #fdf2f2; }
          .conclusion.insight { border-left-color: #5d9ac7; background: #f0f5fa; }
          .phase-bar { display: flex; height: 20px; border-radius: 3px; overflow: hidden; margin: 0.3rem 0; }
          .phase-bar span { display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: white; }
          .phase-drying { background: #5d9ac7; }
          .phase-maillard { background: #d4915e; }
          .phase-dev { background: #c75d5d; }
          .correlation { display: inline-block; padding: 0.3rem 0.6rem; margin: 0.2rem; border-radius: 4px; font-size: 12px; }
          .corr-pos { background: #f0f8f2; color: #2d7a3e; }
          .corr-neg { background: #fdf2f2; color: #c75d5d; }
          .meta { color: #8a7b6c; font-size: 12px; margin-bottom: 1.5rem; }
          @media print { body { padding: 1rem; } }
        </style>
      </head>
      <body>
        <h1>Socky1 — ${title}</h1>
        <div class="meta">Rapport généré le ${date} · ${entries.length} torréfactions analysées</div>
    `;

    // Comparison table
    html += '<h2>Tableau comparatif</h2><table><thead><tr><th>Date</th><th>Score</th>';
    SENSORY_ATTRS.forEach(a => { html += `<th>${a.label}</th>`; });
    ROAST_PARAMS.filter(p => entries.some(e => e.params[p.key] != null)).forEach(p => { html += `<th>${p.label}</th>`; });
    html += '</tr></thead><tbody>';

    const bestTotal = Math.max(...results.comparison.map(r => parseFloat(r.totalScore)));
    results.comparison.forEach(row => {
      const cls = parseFloat(row.totalScore) === bestTotal ? ' class="best"' : '';
      html += `<tr><td>${row.date}</td><td${cls}>${row.totalScore}</td>`;
      SENSORY_ATTRS.forEach(a => { html += `<td>${row[a.key]}</td>`; });
      ROAST_PARAMS.filter(p => entries.some(e => e.params[p.key] != null)).forEach(p => { html += `<td>${row[p.key]}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';

    // Phases
    if (results.curveAnalyses.some(a => a?.phases)) {
      html += '<h2>Phases de torréfaction</h2>';
      entries.forEach((entry, idx) => {
        const a = results.curveAnalyses[idx];
        if (!a?.phases) return;
        const p = a.phases;
        html += `<div><strong>${entry.roast.date || 'T' + (idx + 1)}</strong> (${entry.avgTotal.toFixed(1)} pts)`;
        html += `<div class="phase-bar"><span class="phase-drying" style="width:${p.dryingPct}%">S ${p.dryingPct.toFixed(0)}%</span>`;
        html += `<span class="phase-maillard" style="width:${p.maillardPct}%">M ${p.maillardPct.toFixed(0)}%</span>`;
        html += `<span class="phase-dev" style="width:${p.devPct}%">D ${p.devPct.toFixed(0)}%</span></div></div>`;
      });
    }

    // Correlations
    const sigCorrs = results.correlations.filter(c => Math.abs(c.r) > 0.3);
    if (sigCorrs.length > 0) {
      html += '<h2>Corrélations clés</h2>';
      sigCorrs.slice(0, 10).forEach(c => {
        const cls = c.r > 0 ? 'corr-pos' : 'corr-neg';
        html += `<span class="correlation ${cls}">${c.paramLabel} → ${c.target} (r=${c.r.toFixed(2)})</span> `;
      });
    }

    // Conclusions
    html += '<h2>Conclusions</h2>';
    results.conclusions.forEach(c => {
      html += `<div class="conclusion ${c.type}">${c.text}</div>`;
    });

    html += '</body></html>';

    // Open in new window for print
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  return { analyze, renderResults, exportPDF, pearson, ROAST_PARAMS, SENSORY_ATTRS };
})();
