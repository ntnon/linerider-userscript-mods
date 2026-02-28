// ==UserScript==

// @name         Multirider API
// @namespace    https://www.linerider.com/
// @author       Anton Nydal
// @description  API for advanced rider management system for Line Rider
// @version      1.1
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

/*
 * USAGE EXAMPLES:
 *
 * // Create a rider with a group
 * const rider1 = makeRider('hero', 0, 0, 0.4, 0, 0, true);
 * addRider(rider1);
 *
 * // Create multiple riders with chainable API
 * addRider(
 *   repeatRider(20, 'circle')
 *     .x((x, i) => Math.cos(i * 0.3) * 50)
 *     .y((y, i) => Math.sin(i * 0.3) * 50)
 *     .vx((vx, i) => 0.4)
 * );
 *
 * // Select riders by group and get contact points
 * const heroPoints = getRidersByGroup('hero').all();
 * const mainSled = getRidersByGroup('main').only(sled);
 * const allWithoutScarf = allRiders().exclude(scarf);
 *
 * // Use with Gravity API
 * setGravityKeyframes([
 *   [[0, 2, 0], getRidersByGroup('hero').only(body), setGravity(0, 0.5, 80)]
 * ]);
 */
(function () {
  "use strict";

  // Contact point groups
  const ContactPoints = {
    PEG: 0,
    TAIL: 1,
    NOSE: 2,
    STRING: 3,
    BUTT: 4,
    SHOULDER: 5,
    RHAND: 6,
    LHAND: 7,
    LFOOT: 8,
    RFOOT: 9,
    SCARF_0: 10,
    SCARF_1: 11,
    SCARF_2: 12,
    SCARF_3: 13,
    SCARF_4: 14,
    SCARF_5: 15,
    SCARF_6: 16,
  };
  const PointGroups = {
    all: [...Array(17).keys()],
    sled: [0, 1, 2, 3],
    body: [4, 5, 6, 7, 8, 9],
    scarf: [10, 11, 12, 13, 14, 15, 16],
    notScarf: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    peg: [0],
    tail: [1],
    nose: [2],
    string: [3],
    butt: [4],
    shoulder: [5],
    rhand: [6],
    lhand: [7],
    lfoot: [8],
    rfoot: [9],
    hands: [6, 7],
    feet: [8, 9],
  };

  // Rider creation
  function makeRider(
      groups,
      x = 0,
      y = 0,
      vx = 0,
      vy = 0,
      angle = 0,
      remountable = true,
  ) {
    const riderObj = {
      groups: Array.isArray(groups) ? groups : [groups],
      startPosition: { x, y },
      startVelocity: { x: vx, y: vy },
      startAngle: angle,
      remountable,
    };

    // Return as a selection object for immediate use
    return createSelection([riderObj]);
  }

  // Generate multiple riders
  function makeRiders(count, groups, opts = {}) {
    const riders = [];
    for (let i = 0; i < count; i++) {
      const x = typeof opts.x === 'function' ? opts.x(i, count) : (opts.x || 0);
      const y = typeof opts.y === 'function' ? opts.y(i, count) : (opts.y || 0);
      const vx = typeof opts.vx === 'function' ? opts.vx(i, count) : (opts.vx || 0);
      const vy = typeof opts.vy === 'function' ? opts.vy(i, count) : (opts.vy || 0);
      const angle = typeof opts.angle === 'function' ? opts.angle(i, count) : (opts.angle || 0);
      const remountable = typeof opts.remountable === 'function' ? opts.remountable(i, count) : (opts.remountable !== undefined ? opts.remountable : true);

      riders.push({
        groups: Array.isArray(groups) ? groups : [groups],
        startPosition: { x, y },
        startVelocity: { x: vx, y: vy },
        startAngle: angle,
        remountable,
      });
    }
    // Return as a selection object for immediate use
    return createSelection(riders);
  }

  // Add riders to scene
  function addRiders(ridersOrSelections) {
    const current = window.Selectors.getRiders();
    let toAdd = [];

    if (Array.isArray(ridersOrSelections)) {
      toAdd = ridersOrSelections.map(r => {
        if (r && r.riders && Array.isArray(r.riders)) {
          return r.riders;
        }
        return r;
      }).flat();
    } else if (ridersOrSelections && ridersOrSelections.riders) {
      toAdd = ridersOrSelections.riders;
    } else {
      toAdd = [ridersOrSelections];
    }

    window.Actions.setRiders([...current, ...toAdd]);
    window.Actions.commitTrackChanges();
  }

  // Remove all riders
  function clearRiders() {
    window.Actions.setRiders([]);
    window.Actions.commitTrackChanges();
  }

  // Select all riders
  function riders() {
    return window.Selectors.getRiders();
  }

  // Select riders by group
  function group(groupName) {
    return window.Selectors.getRiders().filter(
        (r) => r.groups && r.groups.includes(groupName),
    );
  }

  // Select a single rider by index
  function rider(index) {
    return window.Selectors.getRiders()[index];
  }

  // Create a selection object with contact point methods
  function createSelection(riders, riderIndices = null) {
    // Store rider references to track them
    const riderRefs = riders.map((r, i) => ({
      ref: r,
      fixedIndex: riderIndices ? riderIndices[i] : null
    }));

    const selection = {
      riders,
      all() {
        const result = [];
        riderRefs.forEach((riderRef) => {
          // If we have a fixed index, use it; otherwise find the rider in current scene
          let globalIndex = riderRef.fixedIndex;
          if (globalIndex === null) {
            const allRiders = window.Selectors.getRiders();
            globalIndex = allRiders.indexOf(riderRef.ref);
          }

          if (globalIndex !== -1) {
            PointGroups.all.forEach((cpIndex) => {
              result.push(globalIndex * 17 + cpIndex);
            });
          }
        });
        return result;
      },
      only(points) {
        const result = [];
        riderRefs.forEach((riderRef) => {
          let globalIndex = riderRef.fixedIndex;
          if (globalIndex === null) {
            const allRiders = window.Selectors.getRiders();
            globalIndex = allRiders.indexOf(riderRef.ref);
          }

          if (globalIndex !== -1) {
            points.forEach((cpIndex) => {
              result.push(globalIndex * 17 + cpIndex);
            });
          }
        });
        return result;
      },
      exclude(points) {
        const included = PointGroups.all.filter((p) => !points.includes(p));
        const result = [];
        riderRefs.forEach((riderRef) => {
          let globalIndex = riderRef.fixedIndex;
          if (globalIndex === null) {
            const allRiders = window.Selectors.getRiders();
            globalIndex = allRiders.indexOf(riderRef.ref);
          }

          if (globalIndex !== -1) {
            included.forEach((cpIndex) => {
              result.push(globalIndex * 17 + cpIndex);
            });
          }
        });
        return result;
      },
    };

    // Add array indexing support
    return new Proxy(selection, {
      get(target, prop) {
        if (!isNaN(prop)) {
          const idx = Number(prop);
          if (riders[idx]) {
            return createSelection([riders[idx]], [riderIndices ? riderIndices[idx] : idx]);
          }
          return undefined;
        }
        return target[prop];
      },
    });
  }

  // Override selection functions to return selection objects
  const ridersOrig = riders;
  riders = function() {
    return createSelection(ridersOrig());
  };

  const groupOrig = group;
  group = function(groupName) {
    return createSelection(groupOrig(groupName));
  };

  // Expose API
  window.multi = {
    makeRider,
    makeRiders,
    addRiders,
    clearRiders,
    riders,
    group,
    rider,
    PointGroups,
    ContactPoints,
  };
})();
