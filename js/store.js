'use strict';

/**
 * Store — LocalStorage persistence layer for Socky1
 * Data model: coffees, roasts, cuppings
 */
const Store = (() => {
  const KEYS = {
    coffees: 'socky1_coffees',
    roasts: 'socky1_roasts',
    cuppings: 'socky1_cuppings',
  };

  function _load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function _save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ===== COFFEES =====
  function getCoffees() {
    return _load(KEYS.coffees);
  }

  function getCoffee(id) {
    return getCoffees().find(c => c.id === id) || null;
  }

  function saveCoffee(data) {
    const coffees = getCoffees();
    if (data.id) {
      const idx = coffees.findIndex(c => c.id === data.id);
      if (idx !== -1) {
        coffees[idx] = { ...coffees[idx], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      data.id = _generateId();
      data.createdAt = new Date().toISOString();
      coffees.push(data);
    }
    _save(KEYS.coffees, coffees);
    return data;
  }

  function deleteCoffee(id) {
    const coffees = getCoffees().filter(c => c.id !== id);
    _save(KEYS.coffees, coffees);
    // Cascade: delete roasts and their cuppings
    const roasts = getRoasts().filter(r => r.coffeeId === id);
    roasts.forEach(r => deleteRoast(r.id));
  }

  // ===== ROASTS =====
  function getRoasts() {
    return _load(KEYS.roasts);
  }

  function getRoast(id) {
    return getRoasts().find(r => r.id === id) || null;
  }

  function getRoastsForCoffee(coffeeId) {
    return getRoasts().filter(r => r.coffeeId === coffeeId);
  }

  function saveRoast(data) {
    const roasts = getRoasts();
    if (data.id) {
      const idx = roasts.findIndex(r => r.id === data.id);
      if (idx !== -1) {
        roasts[idx] = { ...roasts[idx], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      data.id = _generateId();
      data.createdAt = new Date().toISOString();
      roasts.push(data);
    }
    _save(KEYS.roasts, roasts);
    return data;
  }

  function deleteRoast(id) {
    const roasts = getRoasts().filter(r => r.id !== id);
    _save(KEYS.roasts, roasts);
    // Cascade: delete cuppings
    const cuppings = getCuppings().filter(c => c.roastId !== id);
    _save(KEYS.cuppings, cuppings);
  }

  // ===== CUPPINGS =====
  function getCuppings() {
    return _load(KEYS.cuppings);
  }

  function getCupping(id) {
    return getCuppings().find(c => c.id === id) || null;
  }

  function getCuppingsForRoast(roastId) {
    return getCuppings().filter(c => c.roastId === roastId);
  }

  function saveCupping(data) {
    const cuppings = getCuppings();
    if (data.id) {
      const idx = cuppings.findIndex(c => c.id === data.id);
      if (idx !== -1) {
        cuppings[idx] = { ...cuppings[idx], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      data.id = _generateId();
      data.createdAt = new Date().toISOString();
      cuppings.push(data);
    }
    _save(KEYS.cuppings, cuppings);
    return data;
  }

  function deleteCupping(id) {
    const cuppings = getCuppings().filter(c => c.id !== id);
    _save(KEYS.cuppings, cuppings);
  }

  // ===== STATS =====
  function getStats() {
    const coffees = getCoffees();
    const roasts = getRoasts();
    const cuppings = getCuppings();
    const scores = cuppings.map(c => c.totalScore).filter(s => s > 0);
    return {
      coffees: coffees.length,
      roasts: roasts.length,
      cuppings: cuppings.length,
      avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null,
    };
  }

  // ===== ANALYSIS HELPERS =====
  function getAnalysisData(coffeeId) {
    const coffee = getCoffee(coffeeId);
    if (!coffee) return null;

    const roasts = getRoastsForCoffee(coffeeId);
    const entries = [];

    for (const roast of roasts) {
      const cuppings = getCuppingsForRoast(roast.id);
      if (cuppings.length === 0) continue;

      // Average cupping scores if multiple cuppings for same roast
      const avgScores = {};
      const scoreKeys = [
        'fragrance', 'flavor', 'aftertaste', 'acidity', 'body',
        'balance', 'uniformity', 'cleanCup', 'sweetness', 'overall'
      ];

      for (const key of scoreKeys) {
        const vals = cuppings.map(c => c.scores?.[key]).filter(v => v != null);
        avgScores[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }

      const totalScores = cuppings.map(c => c.totalScore).filter(v => v > 0);
      const avgTotal = totalScores.length > 0
        ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length
        : 0;

      entries.push({
        roast,
        cuppings,
        avgScores,
        avgTotal,
        params: {
          chargeTemp: roast.chargeTemp,
          turningPoint: roast.turningPoint,
          fcTime: roast.fcTime,
          fcTemp: roast.fcTemp,
          dropTime: roast.dropTime,
          dropTemp: roast.dropTemp,
          devTime: roast.devTime,
          dtr: roast.dtr,
          weightLoss: roast.weightLoss,
          totalTime: roast.totalTime,
        },
      });
    }

    return { coffee, entries };
  }

  // ===== EXPORT =====
  function exportAll() {
    return {
      coffees: getCoffees(),
      roasts: getRoasts(),
      cuppings: getCuppings(),
      exportedAt: new Date().toISOString(),
    };
  }

  function importAll(data) {
    if (data.coffees) _save(KEYS.coffees, data.coffees);
    if (data.roasts) _save(KEYS.roasts, data.roasts);
    if (data.cuppings) _save(KEYS.cuppings, data.cuppings);
  }

  return {
    getCoffees, getCoffee, saveCoffee, deleteCoffee,
    getRoasts, getRoast, getRoastsForCoffee, saveRoast, deleteRoast,
    getCuppings, getCupping, getCuppingsForRoast, saveCupping, deleteCupping,
    getStats, getAnalysisData,
    exportAll, importAll,
  };
})();
