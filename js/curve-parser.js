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

  return { parse, formatTime, parseTimeStr };
})();
