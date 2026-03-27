'use strict';

/**
 * Charts — Chart.js wrappers for Socky1
 * Handles roast curves, sensory radar, score bars, dashboard charts
 */
const Charts = (() => {

  const chartInstances = {};

  const ROAST_COLORS = [
    '#d4915e', '#5d9ac7', '#6db87b', '#c75d5d', '#d4b85e',
    '#9b6db8', '#5dc7b8', '#c75da5', '#8ab85d', '#5d6dc7',
  ];

  function _destroy(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function _getCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return canvas.getContext('2d');
  }

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#b8a99a', font: { size: 11 } },
      },
    },
    scales: {
      x: { ticks: { color: '#8a7b6c' }, grid: { color: 'rgba(74,64,54,0.3)' } },
      y: { ticks: { color: '#8a7b6c' }, grid: { color: 'rgba(74,64,54,0.3)' } },
    },
  };

  /**
   * Render a single roast curve (for preview)
   */
  function renderCurvePreview(canvasId, curveData) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !curveData) return;

    const timeLabels = curveData.time.map(t => CurveParser.formatTime(t));

    const datasets = [
      {
        label: 'BT (°C)',
        data: curveData.bt,
        borderColor: '#d4915e',
        backgroundColor: 'rgba(212,145,94,0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        yAxisID: 'y',
      },
    ];

    if (curveData.et.length > 0) {
      datasets.push({
        label: 'ET (°C)',
        data: curveData.et,
        borderColor: '#5d9ac7',
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [4, 2],
        yAxisID: 'y',
      });
    }

    if (curveData.ror.length > 0) {
      datasets.push({
        label: 'RoR (°C/min)',
        data: curveData.ror,
        borderColor: '#6db87b',
        borderWidth: 1.5,
        pointRadius: 0,
        yAxisID: 'y1',
      });
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: timeLabels, datasets },
      options: {
        ...defaultOptions,
        scales: {
          x: {
            ticks: { color: '#8a7b6c', maxTicksLimit: 12 },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          y: {
            position: 'left',
            title: { display: true, text: '°C', color: '#8a7b6c' },
            ticks: { color: '#8a7b6c' },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'RoR °C/min', color: '#8a7b6c' },
            ticks: { color: '#8a7b6c' },
            grid: { display: false },
          },
        },
      },
    });
  }

  /**
   * Overlay multiple roast curves (analysis view)
   */
  function renderCurvesOverlay(canvasId, entries) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !entries.length) return;

    const datasets = [];

    entries.forEach((entry, idx) => {
      const curve = entry.roast.curveData;
      if (!curve || !curve.time) return;

      const color = ROAST_COLORS[idx % ROAST_COLORS.length];
      const label = `${entry.roast.date || 'Torréfaction'} (${entry.avgTotal.toFixed(1)} pts)`;

      datasets.push({
        label: `BT — ${label}`,
        data: curve.time.map((t, i) => ({ x: t, y: curve.bt[i] })),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        showLine: true,
      });

      if (curve.ror && curve.ror.length > 0) {
        datasets.push({
          label: `RoR — ${entry.roast.date || ''}`,
          data: curve.time.map((t, i) => ({ x: t, y: curve.ror[i] })),
          borderColor: color,
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [3, 3],
          showLine: true,
          yAxisID: 'y1',
        });
      }
    });

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        ...defaultOptions,
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Temps (s)', color: '#8a7b6c' },
            ticks: {
              color: '#8a7b6c',
              callback: v => CurveParser.formatTime(v),
            },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          y: {
            position: 'left',
            title: { display: true, text: 'BT (°C)', color: '#8a7b6c' },
            ticks: { color: '#8a7b6c' },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'RoR (°C/min)', color: '#8a7b6c' },
            ticks: { color: '#8a7b6c' },
            grid: { display: false },
          },
        },
        plugins: {
          legend: {
            labels: { color: '#b8a99a', font: { size: 10 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const ds = ctx.dataset.label || '';
                return `${ds}: ${ctx.parsed.y.toFixed(1)} @ ${CurveParser.formatTime(ctx.parsed.x)}`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Sensory radar chart comparing multiple roasts
   */
  function renderSensoryRadar(canvasId, entries) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !entries.length) return;

    const labels = ['Fragrance', 'Flavor', 'Aftertaste', 'Acidité', 'Body', 'Balance', 'Overall'];
    const keys = ['fragrance', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'overall'];

    const datasets = entries.map((entry, idx) => ({
      label: entry.roast.date || `Torréfaction ${idx + 1}`,
      data: keys.map(k => entry.avgScores[k] || 0),
      borderColor: ROAST_COLORS[idx % ROAST_COLORS.length],
      backgroundColor: ROAST_COLORS[idx % ROAST_COLORS.length] + '20',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: ROAST_COLORS[idx % ROAST_COLORS.length],
    }));

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 5,
            max: 10,
            ticks: { stepSize: 1, color: '#8a7b6c', backdropColor: 'transparent' },
            grid: { color: 'rgba(74,64,54,0.3)' },
            pointLabels: { color: '#b8a99a', font: { size: 11 } },
          },
        },
        plugins: {
          legend: {
            labels: { color: '#b8a99a', font: { size: 10 } },
          },
        },
      },
    });
  }

  /**
   * Bar chart comparing total scores
   */
  function renderScoresBar(canvasId, entries) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !entries.length) return;

    const labels = entries.map((e, i) => e.roast.date || `T${i + 1}`);
    const scores = entries.map(e => e.avgTotal);
    const colors = entries.map((_, i) => ROAST_COLORS[i % ROAST_COLORS.length]);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score total',
          data: scores,
          backgroundColor: colors.map(c => c + '80'),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 4,
        }],
      },
      options: {
        ...defaultOptions,
        scales: {
          y: {
            min: Math.max(0, Math.min(...scores) - 5),
            max: 100,
            ticks: { color: '#8a7b6c' },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          x: {
            ticks: { color: '#8a7b6c' },
            grid: { display: false },
          },
        },
      },
    });
  }

  /**
   * Dashboard score trend line
   */
  function renderDashboardTrend(canvasId, cuppings) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    if (!cuppings || cuppings.length === 0) return;

    const sorted = [...cuppings].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const labels = sorted.map(c => c.date || '?');
    const scores = sorted.map(c => c.totalScore);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score',
          data: scores,
          borderColor: '#d4915e',
          backgroundColor: 'rgba(212,145,94,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#d4915e',
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        ...defaultOptions,
        scales: {
          y: {
            min: Math.max(0, Math.min(...scores) - 5),
            max: 100,
            ticks: { color: '#8a7b6c' },
            grid: { color: 'rgba(74,64,54,0.3)' },
          },
          x: {
            ticks: { color: '#8a7b6c', maxRotation: 45 },
            grid: { display: false },
          },
        },
      },
    });
  }

  return {
    renderCurvePreview,
    renderCurvesOverlay,
    renderSensoryRadar,
    renderScoresBar,
    renderDashboardTrend,
  };
})();
