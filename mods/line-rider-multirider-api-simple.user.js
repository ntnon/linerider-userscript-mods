// ==UserScript==

// @name         Multirider API
// @namespace    https://www.linerider.com/
// @author       Anton Nydal
// @description  Simple API for rider management
// @version      2.0
// @icon         https://www.linerider.com/favicon.ico

// @match        https://www.linerider.com/*
// @match        https://*.official-linerider.com/*
// @match        http://localhost:*/*
// @match        https://*.surge.sh/*

// @downloadURL  _
// @updateURL    _
// @homepageURL  _
// @supportURL   _
// @grant        none

// ==/UserScript==

(function () {
  "use strict";

  const PointGroups = {
    all: [...Array(17).keys()],
    sled: [0, 1, 2, 3],
    body: [4, 5, 6, 7, 8, 9],
    scarf: [10, 11, 12, 13, 14, 15, 16],
    notScarf: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    hands: [6, 7],
    feet: [8, 9],
  };

  // Get contact point indices for riders
  function getContactPoints(riderIndices, points = PointGroups.all) {
    const result = [];
    riderIndices.forEach(idx => {
      points.forEach(cp => {
        result.push(idx * 17 + cp);
      });
    });
    return result;
  }

  // Create a selection that wraps rider indices
  function createSelection(riderIndices) {
    return {
      indices: riderIndices,
      all() { return getContactPoints(riderIndices); },
      only(points) { return getContactPoints(riderIndices, points); },
      exclude(points) {
        const included = PointGroups.all.filter(p => !points.includes(p));
        return getContactPoints(riderIndices, included);
      },
    };
  }

  // Create rider object
  function makeRider(groups, x = 0, y = 0, vx = 0, vy = 0, angle = 0, remountable = true) {
    return {
      groups: Array.isArray(groups) ? groups : [groups],
      startPosition: { x, y },
      startVelocity: { x: vx, y: vy },
      startAngle: angle,
      remountable,
    };
  }

  // Create rider and return as selection (for immediate use)
  function makeRiderSelection(groups, x = 0, y = 0, vx = 0, vy = 0, angle = 0, remountable = true) {
    const rider = makeRider(groups, x, y, vx, vy, angle, remountable);
    // Will resolve to actual index when needed
    return {
      _rider: rider,
      all() {
        const idx = window.Selectors.getRiders().indexOf(this._rider);
        return idx !== -1 ? getContactPoints([idx]) : [];
      },
      only(points) {
        const idx = window.Selectors.getRiders().indexOf(this._rider);
        return idx !== -1 ? getContactPoints([idx], points) : [];
      },
      exclude(points) {
        const idx = window.Selectors.getRiders().indexOf(this._rider);
        if (idx === -1) return [];
        const included = PointGroups.all.filter(p => !points.includes(p));
        return getContactPoints([idx], included);
      },
    };
  }

  // Create multiple riders with dynamic parameters
  function makeRiders(count, groups, opts = {}) {
    const riders = [];
    for (let i = 0; i < count; i++) {
      const x = typeof opts.x === 'function' ? opts.x(i, count) : (opts.x || 0);
      const y = typeof opts.y === 'function' ? opts.y(i, count) : (opts.y || 0);
      const vx = typeof opts.vx === 'function' ? opts.vx(i, count) : (opts.vx || 0);
      const vy = typeof opts.vy === 'function' ? opts.vy(i, count) : (opts.vy || 0);
      const angle = typeof opts.angle === 'function' ? opts.angle(i, count) : (opts.angle || 0);
      const remountable = typeof opts.remountable === 'function' ? opts.remountable(i, count) : (opts.remountable !== undefined ? opts.remountable : true);

      riders.push(makeRider(groups, x, y, vx, vy, angle, remountable));
    }
    return riders;
  }

  // Add riders to scene
  function addRiders(riders) {
    const current = window.Selectors.getRiders();
    const toAdd = Array.isArray(riders) ? riders : [riders];
    window.Actions.setRiders([...current, ...toAdd]);
    window.Actions.commitTrackChanges();
  }

  // Clear all riders
  function clearRiders() {
    window.Actions.setRiders([]);
    window.Actions.commitTrackChanges();
  }

  // Get all riders as selection
  function allRiders() {
    const riders = window.Selectors.getRiders();
    return createSelection(riders.map((_, i) => i));
  }

  // Get riders by group
  function byGroup(groupName) {
    const riders = window.Selectors.getRiders();
    const indices = riders
      .map((r, i) => r.groups && r.groups.includes(groupName) ? i : -1)
      .filter(i => i !== -1);
    return createSelection(indices);
  }

  // Get riders by indices
  function byIndices(indices) {
    return createSelection(indices);
  }

  // Expose API
  window.multi = {
    makeRider,
    makeRiderSelection,
    makeRiders,
    addRiders,
    clearRiders,
    allRiders,
    byGroup,
    byIndices,
    PointGroups,
  };

  // Expose PointGroups globally
  Object.assign(window, PointGroups);
})();



