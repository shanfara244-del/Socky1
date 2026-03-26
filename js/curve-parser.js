'use strict';

/**
 * CurveParser — Parse Cropster CSV exports into structured roast curve data
 *
 * Cropster CSV typical structure:
 * - Header rows with metadata (batch, date, etc.)
 * - Data columns: Time, BT (Bean Temp), ET (Env Temp), optionally RoR, drum speed, etc.
 * - Time can be in seconds or mm:ss format
 * - Temperatures in °C or °F
 *
 * This parser is flexible: it tries to detect columns by header names.
 */
const CurveParser = (() => {

  // Known column name patterns (case-insensitive)
  const PATTERNS = {
    time: /^(time|zeit|tiempo|temps)$/i,
    bt: /^(bt|bean\s*temp|bean|grain)/i,
    et: /^(et|env\s*temp|environment|drum\s*temp|inlet)/i,
    ror: /^(ror|rate\s*of\s*rise|bt\s*ror|delta)/i,
  };

  /**
   * Parse a CSV string into curve data
   * @param {string} csvText - Raw CSV content
   * @returns {object} { time[], bt[], et[], ror[], meta, errors[] }
   */
  function parse(csvText) {
    const errors = [];
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 3) {
      return { time: [], bt: [], et: [], ror: [], meta: {}, errors: ['Fichier trop court'] };
    }

    // Detect delimiter
    const delimiter = _detectDelimiter(lines);

    // Find the header row (the one with column names)
    let headerIdx = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const cells = _splitLine(lines[i], delimiter);
      const map = _matchColumns(cells);
      if (map.time !== -1 && map.bt !== -1) {
        headerIdx = i;
        colMap = map;
        break;
      }
    }

    if (headerIdx === -1) {
      // Fallback: assume first numeric column is time, second is BT, third is ET
      headerIdx = _findFirstNumericRow(lines, delimiter);
      if (headerIdx === -1) {
        return { time: [], bt: [], et: [], ror: [], meta: {}, errors: ['Impossible de détecter les colonnes'] };
      }
      colMap = { time: 0, bt: 1, et: 2, ror: 3 };
      // Adjust: data starts at headerIdx, no actual header
      headerIdx = headerIdx - 1;
    }

    // Extract metadata from rows before header
    const meta = _extractMeta(lines.slice(0, headerIdx), delimiter);

    // Parse data rows
    const time = [];
    const bt = [];
    const et = [];
    const ror = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = _splitLine(lines[i], delimiter);
      if (cells.length < 2) continue;

      const t = _parseTime(cells[colMap.time]);
      const bTemp = _parseNum(cells[colMap.bt]);

      if (t == null || bTemp == null) continue;

      time.push(t);
      bt.push(bTemp);

      if (colMap.et !== -1) {
        et.push(_parseNum(cells[colMap.et]) || 0);
      }

      if (colMap.ror !== -1) {
        ror.push(_parseNum(cells[colMap.ror]) || 0);
      }
    }

    // Calculate RoR if not provided (BT derivative per 30s window)
    if (ror.length === 0 && bt.length > 2) {
      for (let i = 0; i < bt.length; i++) {
        if (i === 0) {
          ror.push(0);
        } else {
          const dt = time[i] - time[i - 1];
          if (dt > 0) {
            ror.push(((bt[i] - bt[i - 1]) / dt) * 60); // °C/min
          } else {
            ror.push(0);
          }
        }
      }
    }

    if (time.length < 3) {
      errors.push('Trop peu de points de données');
    }

    return { time, bt, et, ror, meta, errors };
  }

  function _detectDelimiter(lines) {
    const sample = lines.slice(0, 5).join('\n');
    const commas = (sample.match(/,/g) || []).length;
    const semis = (sample.match(/;/g) || []).length;
    const tabs = (sample.match(/\t/g) || []).length;
    if (tabs >= commas && tabs >= semis) return '\t';
    if (semis > commas) return ';';
    return ',';
  }

  function _splitLine(line, delimiter) {
    // Handle quoted fields
    const cells = [];
    let current = '';
    let inQuote = false;

    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === delimiter && !inQuote) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function _matchColumns(cells) {
    const map = { time: -1, bt: -1, et: -1, ror: -1 };
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i].replace(/['"]/g, '').trim();
      for (const [key, pattern] of Object.entries(PATTERNS)) {
        if (pattern.test(cell) && map[key] === -1) {
          map[key] = i;
        }
      }
    }
    return map;
  }

  function _findFirstNumericRow(lines, delimiter) {
    for (let i = 0; i < lines.length; i++) {
      const cells = _splitLine(lines[i], delimiter);
      if (cells.length >= 2 && _parseNum(cells[0]) != null && _parseNum(cells[1]) != null) {
        return i;
      }
    }
    return -1;
  }

  function _parseTime(val) {
    if (val == null) return null;
    val = val.replace(/['"]/g, '').trim();

    // mm:ss format
    const mmss = val.match(/^(\d+):(\d{1,2})$/);
    if (mmss) {
      return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
    }

    // Pure number = seconds
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num)) return num;

    return null;
  }

  function _parseNum(val) {
    if (val == null || val === '') return null;
    val = val.replace(/['"]/g, '').trim().replace(',', '.');
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }

  function _extractMeta(headerLines, delimiter) {
    const meta = {};
    for (const line of headerLines) {
      const cells = _splitLine(line, delimiter);
      if (cells.length >= 2) {
        const key = cells[0].toLowerCase().trim();
        const val = cells[1].trim();
        if (key && val) {
          if (key.includes('batch') || key.includes('lot')) meta.batch = val;
          if (key.includes('date')) meta.date = val;
          if (key.includes('machine') || key.includes('roaster')) meta.machine = val;
          if (key.includes('bean') || key.includes('coffee') || key.includes('café')) meta.coffee = val;
        }
      }
    }
    return meta;
  }

  /**
   * Format seconds into mm:ss
   */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Parse mm:ss string to seconds
   */
  function parseTimeStr(str) {
    if (!str) return null;
    const match = str.match(/^(\d+):(\d{1,2})$/);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Analyze a parsed curve: detect phases, events, RoR patterns
   * @param {object} curveData - Output from parse()
   * @param {object} roastParams - { fcTime, fcTemp, dropTime, dropTemp, chargeTemp, turningPoint }
   * @returns {object} { phases, rorPatterns, events, warnings }
   */
  function analyzeCurve(curveData, roastParams) {
    if (!curveData || !curveData.bt || curveData.bt.length < 10) {
      return { phases: null, rorPatterns: [], events: {}, warnings: [] };
    }

    const { time, bt, ror } = curveData;
    const warnings = [];
    const events = _detectEvents(time, bt, roastParams);
    const phases = _computePhases(time, bt, events);
    const rorPatterns = _analyzeRoR(time, ror, events);

    // Phase ratio warnings
    if (phases) {
      if (phases.dryingPct > 55) {
        warnings.push({ type: 'negative', text: `Phase de séchage très longue (${phases.dryingPct.toFixed(0)}%). Risque de roast baked — les réactions de Maillard sont compressées.` });
      }
      if (phases.devPct < 15) {
        warnings.push({ type: 'negative', text: `DTR très court (${phases.devPct.toFixed(0)}%). Probablement sous-développé — goût herbacé, acide aigre, astringent.` });
      } else if (phases.devPct > 28) {
        warnings.push({ type: 'negative', text: `DTR très long (${phases.devPct.toFixed(0)}%). Risque de perte de complexité aromatique et de notes d'origine.` });
      }
      if (phases.maillardPct < 20) {
        warnings.push({ type: 'insight', text: `Phase de Maillard courte (${phases.maillardPct.toFixed(0)}%). Moins de développement de sucres caramélisés.` });
      }
    }

    // RoR pattern warnings
    for (const pattern of rorPatterns) {
      if (pattern.type === 'crash') {
        warnings.push({ type: 'negative', text: `RoR crash détecté à ${formatTime(pattern.time)} (chute de ${pattern.magnitude.toFixed(1)}°C/min). Risque de goût baked — plat, pain, carton.` });
      } else if (pattern.type === 'flick') {
        warnings.push({ type: 'negative', text: `RoR flick détecté à ${formatTime(pattern.time)} (rebond de +${pattern.magnitude.toFixed(1)}°C/min). Réduire la chaleur plus tôt avant le first crack.` });
      } else if (pattern.type === 'stall') {
        warnings.push({ type: 'negative', text: `RoR plateau détecté à ${formatTime(pattern.time)} (stagnation pendant ${pattern.duration.toFixed(0)}s). Risque de baking — les réactions enzymatiques ralentissent.` });
      }
    }

    return { phases, rorPatterns, events, warnings };
  }

  function _detectEvents(time, bt, params) {
    const events = {};
    const totalTime = time[time.length - 1];

    // Turning point: lowest BT in first 30% of roast
    const searchEnd = Math.floor(bt.length * 0.3);
    let tpIdx = 0;
    for (let i = 1; i < searchEnd; i++) {
      if (bt[i] < bt[tpIdx]) tpIdx = i;
    }
    events.turningPoint = { time: time[tpIdx], temp: bt[tpIdx], idx: tpIdx };

    // Drying end / yellowing: ~150°C (adjustable)
    const dryingTemp = 150;
    for (let i = tpIdx; i < bt.length; i++) {
      if (bt[i] >= dryingTemp) {
        events.dryingEnd = { time: time[i], temp: bt[i], idx: i };
        break;
      }
    }

    // First crack from params or detect from curve (~195°C)
    if (params?.fcTime) {
      const fcSec = parseTimeStr(params.fcTime);
      if (fcSec != null) {
        // Find closest time index
        let fcIdx = 0;
        for (let i = 0; i < time.length; i++) {
          if (Math.abs(time[i] - fcSec) < Math.abs(time[fcIdx] - fcSec)) fcIdx = i;
        }
        events.firstCrack = { time: fcSec, temp: params.fcTemp || bt[fcIdx], idx: fcIdx };
      }
    }

    if (!events.firstCrack) {
      // Estimate: first time BT crosses 195°C
      for (let i = 0; i < bt.length; i++) {
        if (bt[i] >= 195) {
          events.firstCrack = { time: time[i], temp: bt[i], idx: i };
          break;
        }
      }
    }

    // Drop = last data point (or from params)
    if (params?.dropTime) {
      const dropSec = parseTimeStr(params.dropTime);
      if (dropSec != null) {
        events.drop = { time: dropSec, temp: params.dropTemp || bt[bt.length - 1] };
      }
    }
    if (!events.drop) {
      events.drop = { time: totalTime, temp: bt[bt.length - 1] };
    }

    return events;
  }

  function _computePhases(time, bt, events) {
    const totalTime = events.drop?.time || time[time.length - 1];
    if (totalTime <= 0) return null;

    const tpTime = events.turningPoint?.time || 0;
    const dryEndTime = events.dryingEnd?.time || null;
    const fcTime = events.firstCrack?.time || null;

    if (!dryEndTime || !fcTime) return null;

    const dryingDuration = dryEndTime - tpTime;
    const maillardDuration = fcTime - dryEndTime;
    const devDuration = totalTime - fcTime;

    return {
      drying: { start: tpTime, end: dryEndTime, duration: dryingDuration },
      maillard: { start: dryEndTime, end: fcTime, duration: maillardDuration },
      development: { start: fcTime, end: totalTime, duration: devDuration },
      dryingPct: (dryingDuration / totalTime) * 100,
      maillardPct: (maillardDuration / totalTime) * 100,
      devPct: (devDuration / totalTime) * 100,
      totalTime,
    };
  }

  function _analyzeRoR(time, ror, events) {
    if (!ror || ror.length < 20) return [];

    const patterns = [];
    const fcTime = events.firstCrack?.time || Infinity;

    // Smooth RoR with 5-point moving average for analysis
    const smoothed = [];
    const window = 5;
    for (let i = 0; i < ror.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(ror.length, i + Math.ceil(window / 2));
      let sum = 0;
      for (let j = start; j < end; j++) sum += ror[j];
      smoothed.push(sum / (end - start));
    }

    // Skip early phase (before turning point stabilizes)
    const startIdx = events.turningPoint ? events.turningPoint.idx + 5 : 10;

    for (let i = startIdx + 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      const t = time[i];

      // Crash: RoR drops > 3°C/min in a short span
      if (prev - curr > 3 && t > 60) {
        patterns.push({
          type: 'crash',
          time: t,
          idx: i,
          magnitude: prev - curr,
        });
      }

      // Flick: RoR increases after declining (especially near FC)
      if (curr > prev && prev < smoothed[Math.max(0, i - 2)] && curr - prev > 1.5 && t > 120) {
        patterns.push({
          type: 'flick',
          time: t,
          idx: i,
          magnitude: curr - prev,
        });
      }

      // Stall: RoR nearly flat (< 0.5°C/min change) for extended period
      if (Math.abs(curr - prev) < 0.3 && Math.abs(next - curr) < 0.3 && curr > 0 && curr < 4) {
        // Check if this is a prolonged stall
        let stallEnd = i;
        while (stallEnd < smoothed.length - 1 && Math.abs(smoothed[stallEnd + 1] - smoothed[stallEnd]) < 0.5) {
          stallEnd++;
        }
        const stallDuration = time[stallEnd] - time[i];
        if (stallDuration > 30) {
          patterns.push({
            type: 'stall',
            time: t,
            idx: i,
            duration: stallDuration,
            magnitude: curr,
          });
          i = stallEnd; // Skip past stall
        }
      }
    }

    // Deduplicate nearby patterns of same type
    const deduped = [];
    for (const p of patterns) {
      const last = deduped[deduped.length - 1];
      if (last && last.type === p.type && Math.abs(last.time - p.time) < 30) continue;
      deduped.push(p);
    }

    return deduped;
  }

  return { parse, formatTime, parseTimeStr, analyzeCurve };
})();
