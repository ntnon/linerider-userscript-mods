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
 *   repeatRider('circle', 20)
 *     .x((x, i) => Math.cos(i * 0.3) * 50)
 *     .y((y, i) => Math.sin(i * 0.3) * 50)
 *     .vx((vx, i) => 0.4)
 * );
 *
 * // Select riders by group and get contact points
 * const heroPoints = getRidersByGroup('hero').all();
 * const mainSled = getRidersByGroup('main').only(sled);
 * const allWithoutScarf = getAllRiders().exclude(scarf);
 *
 * // Use with Gravity API
 * setGravityKeyframes([
 *   [[0, 2, 0], getRidersByGroup('hero').only(body), setGravity(0, 0.5, 80)]
 * ]);
 */
(function () {
  "use strict";

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

  // Predefined contact point groups
  const PointGroups = {
    all: [...Array(17).keys()], // All contact points (0-16)
    sled: [0, 1, 2, 3],
    body: [4, 5, 6, 7, 8, 9], // Body parts only
    scarf: [10, 11, 12, 13, 14, 15, 16],
    notScarf: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],

    // Individual contact points as arrays for convenience
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

  // Legacy aliases for backward compatibility
  const sledPoints = PointGroups.sled;
  const scarfPoints = PointGroups.scarf;
  const riderPoints = PointGroups.body;
  const notScarfPoints = PointGroups.notScarf;
  const allPoints = PointGroups.all;

  /**
   * RiderSelection class - wraps rider indices and provides methods to convert to contact points
   */
  class RiderSelection {
    constructor(riderIndices) {
      this.riderIndices = Array.isArray(riderIndices)
        ? riderIndices
        : [riderIndices];
      this._isRiderSelection = true; // Marker for GravityAPI to detect
    }

    /**
     * Converts rider indices to contact point indices
     * @param {Array} points - Optional array of contact point indices (0-16) to include. Defaults to all points.
     * @returns {Array} Array of global contact point indices
     */
    toContactPoints(points = allPoints) {
      const contactPoints = [];
      this.riderIndices.forEach((riderIndex) => {
        points.forEach((cpIndex) => {
          contactPoints.push(riderIndex * 17 + cpIndex);
        });
      });
      return contactPoints;
    }

    /**
     * Keeps only specified contact points for each rider
     * @param {Array} points - Contact point indices (0-16) to keep
     * @returns {Array} Array of global contact point indices
     */
    only(points) {
      if (!Array.isArray(points)) {
        throw new Error("Expected an array for 'points'");
      }
      return this.toContactPoints(points);
    }

    /**
     * Excludes specified contact points for each rider
     * @param {Array} points - Contact point indices (0-16) to exclude
     * @returns {Array} Array of global contact point indices
     */
    exclude(points) {
      if (!Array.isArray(points)) {
        throw new Error("Expected an array for 'points'");
      }
      const includedPoints = allPoints.filter((p) => !points.includes(p));
      return this.toContactPoints(includedPoints);
    }

    /**
     * Returns all contact points for the riders
     * @returns {Array} Array of global contact point indices
     */
    all() {
      return this.toContactPoints();
    }
  }

  /**
   * RiderRepeater class - Chainable builder for creating multiple riders
   * Extends Array so it can be used directly without .create()
   */
  class RiderRepeater extends Array {
    constructor(groups, count, baseRider = null) {
      super();
      this._groupName = groups;
      this._count = count;

      // Use baseRider if provided, otherwise create default riders
      const template = baseRider || makeRider(groups, 0, 0, 0, 0, 0, true);

      // Create riders immediately based on template
      for (let i = 0; i < count; i++) {
        this.push(template.copy());
      }
    }

    /**
     * Modify x position for each rider
     * @param {Function} fn - Function(x, index) => number
     * @returns {RiderRepeater} this for chaining
     */
    x(fn) {
      this.forEach((rider, i) => {
        rider.startPosition.x = fn(rider.startPosition.x, i);
      });
      return this;
    }

    /**
     * Modify y position for each rider
     * @param {Function} fn - Function(y, index) => number
     * @returns {RiderRepeater} this for chaining
     */
    y(fn) {
      this.forEach((rider, i) => {
        rider.startPosition.y = fn(rider.startPosition.y, i);
      });
      return this;
    }

    /**
     * Modify x velocity for each rider
     * @param {Function} fn - Function(vx, index) => number
     * @returns {RiderRepeater} this for chaining
     */
    vx(fn) {
      this.forEach((rider, i) => {
        rider.startVelocity.x = fn(rider.startVelocity.x, i);
      });
      return this;
    }

    /**
     * Modify y velocity for each rider
     * @param {Function} fn - Function(vy, index) => number
     * @returns {RiderRepeater} this for chaining
     */
    vy(fn) {
      this.forEach((rider, i) => {
        rider.startVelocity.y = fn(rider.startVelocity.y, i);
      });
      return this;
    }

    /**
     * Modify angle for each rider
     * @param {Function} fn - Function(angle, index) => number
     * @returns {RiderRepeater} this for chaining
     */
    angle(fn) {
      this.forEach((rider, i) => {
        rider.startAngle = fn(rider.startAngle, i);
      });
      return this;
    }

    /**
     * Modify remountable for each rider
     * @param {Function} fn - Function(remountable, index) => boolean
     * @returns {RiderRepeater} this for chaining
     */
    remountable(fn) {
      this.forEach((rider, i) => {
        rider.remountable = fn(rider.remountable, i);
      });
      return this;
    }

    /**
     * Modify groups for each rider
     * @param {Function} fn - Function(groups, index) => Set
     * @returns {RiderRepeater} this for chaining
     */
    group(fn) {
      this.forEach((rider, i) => {
        rider.groups = fn(rider.groups, i);
      });
      return this;
    }

    /**
     * Helper: Arrange riders in a circle
     * @param {number} radius - Circle radius
     * @returns {RiderRepeater} this for chaining
     */
    circle(radius) {
      return this.x(
        (x, i) => Math.cos((i / this._count) * Math.PI * 2) * radius,
      ).y((y, i) => Math.sin((i / this._count) * Math.PI * 2) * radius);
    }

    /**
     * Helper: Arrange riders in a grid
     * @param {number} cols - Number of columns
     *L @param {number} spacing - Spacing between riders
     * @returns {RiderRepeater} this for chaining
     */
    grid(cols, spacing) {
      return this.x((x, i) => (i % cols) * spacing).y(
        (y, i) => Math.floor(i / cols) * spacing,
      );
    }

    /**
     * Helper: Arrange riders in a line
     * @param {number} spacing - Spacing between riders
     * @param {string} direction - 'horizontal' or 'vertical'
     * @returns {RiderRepeater} this for chaining
     */
    line(spacing, direction = "horizontal") {
      if (direction === "horizontal") {
        return this.x((x, i) => i * spacing);
      } else {
        return this.y((y, i) => i * spacing);
      }
    }
  }

  const MultiRiderAPI = (() => {
    /**
     * Gets all riders currently in the scene
     * @returns {Array} Array of rider objects
     */
    function getRiders() {
      return window.Selectors.getRiders();
    }

    /**
     * Sets the riders in the scene, replacing all existing riders
     * @param {Object|Array} newRiders - Single rider or array of riders to set
     */
    function setRiders(newRiders) {
      const ridersArr = Array.isArray(newRiders) ? newRiders : [newRiders];
      window.Actions.setRiders(ridersArr);
      window.Actions.commitTrackChanges();
    }

    /**
     * Adds one or more riders to the scene
     * @param {Object|Array} riders - Single rider or array of riders
     */
    function addRider(riders) {
      const toAdd = Array.isArray(riders) ? riders : [riders];
      const current = getRiders();
      setRiders([...current, ...toAdd]);
    }

    /**
     * Removes all riders from the scene
     */
    function clearRiders() {
      setRiders([]);
    }

    /**
     * Creates a new rider with specified groups and properties
     * @param {string|Array|Set} groups - Group name(s) for the rider
     * @param {number} startPosX - Starting X position (default: 0)
     * @param {number} startPosY - Starting Y position (default: 0)
     * @param {number} startVelX - Starting X velocity (default: 0)
     * @param {number} startVelY - Starting Y velocity (default: 0)
     * @param {number} startAngle - Starting angle in degrees (default: 0)
     * @param {boolean} remountable - Whether rider can remount (default: true)
     * @returns {Object} Rider object with copy() method
     */
    function makeRider(
      groups,
      startPosX = 0,
      startPosY = 0,
      startVelX = 0,
      startVelY = 0,
      startAngle = 0,
      remountable = true,
    ) {
      if (!groups) groups = [];
      const groupSet =
        groups instanceof Set
          ? new Set(groups)
          : new Set(Array.isArray(groups) ? groups : [groups]);
      return {
        groups: groupSet,
        startPosition: { x: startPosX, y: startPosY },
        startVelocity: { x: startVelX, y: startVelY },
        startAngle: startAngle,
        remountable: remountable,
        copy() {
          return makeRider(
            new Set(this.groups),
            this.startPosition.x,
            this.startPosition.y,
            this.startVelocity.x,
            this.startVelocity.y,
            this.startAngle,
            this.remountable,
          );
        },
      };
    }

    /**
     * Creates multiple riders with chainable modifiers
     * @param {string|Array|Set} groups - Group name(s) for the riders
     * @param {number} count - Number of riders to create
     * @param {Object} baseRider - Optional base rider to copy from
     * @returns {RiderRepeater} Chainable array of riders
     */
    function repeatRider(groups, count, baseRider = null) {
      return new RiderRepeater(groups, count, baseRider);
    }

    /**
     * Gets all rider indices in the scene
     * @returns {RiderSelection} RiderSelection object with rider indices
     */
    function getAllRiderIndices() {
      const riders = getRiders();
      const indices = riders.map((_, index) => index);
      return new RiderSelection(indices);
    }

    /**
     * Helper function to get rider indices from rider objects
     * @param {Array} riders - Array of rider objects
     * @returns {Array} Array of rider indices
     */
    function getRiderIndices(riders) {
      const allRiders = getRiders();
      return riders
        .map((rider) => allRiders.indexOf(rider))
        .filter((idx) => idx !== -1);
    }

    /**
     * Gets rider indices that belong to any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {RiderSelection} RiderSelection object with matching rider indices
     */
    function getRidersByGroup(...groupNames) {
      const riders = getRiders();
      const matchingIndices = [];
      riders.forEach((rider, index) => {
        if (!(rider.groups instanceof Set)) return;
        if (groupNames.some((groupName) => rider.groups.has(groupName))) {
          matchingIndices.push(index);
        }
      });
      return new RiderSelection(matchingIndices);
    }

    /**
     * Gets rider indices that do NOT belong to any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {RiderSelection} RiderSelection object with non-matching rider indices
     */
    function getRidersNotInGroup(...groupNames) {
      const riders = getRiders();
      const matchingIndices = [];
      riders.forEach((rider, index) => {
        if (!(rider.groups instanceof Set)) {
          matchingIndices.push(index);
          return;
        }
        if (!groupNames.some((groupName) => rider.groups.has(groupName))) {
          matchingIndices.push(index);
        }
      });
      return new RiderSelection(matchingIndices);
    }

    /**
     * Displays the complete MultiRider API guide in the console
     */
    function help() {
      console.log(`
=== MULTIRIDER API GUIDE ===

CREATING RIDERS:
  makeRider(groups, x, y, velX, velY, angle, remountable)
    - groups: string, array, or Set (e.g., 'hero' or ['main', 'group2'])
    - x, y: starting position (default: 0, 0)
    - velX, velY: starting velocity (default: 0, 0)
    - angle: starting angle in degrees (default: 0)
    - remountable: boolean (default: true)
    Example: makeRider('hero', 0, 0, 0.4, 0, 0, true)

  repeatRider(groups, count, baseRider)
    - Creates multiple riders with chainable modifiers
    - groups: Group name(s) for the riders
    - count: Number of riders to create
    - baseRider: Optional rider template (default: rider at origin)
    - Returns array that IS the riders (no .create() needed!)

    Chainable methods:
      .x(fn)      - Modify x position: (x, index) => number
      .y(fn)      - Modify y position: (y, index) => number
      .vx(fn)     - Modify x velocity: (vx, index) => number
      .vy(fn)     - Modify y velocity: (vy, index) => number
      .angle(fn)  - Modify angle: (angle, index) => number
      .group(fn)  - Modify groups: (groups, index) => Set

    Helper methods:
      .circle(radius)           - Arrange in circle
      .grid(cols, spacing)      - Arrange in grid
      .line(spacing, direction) - Arrange in line

    Examples:
      // Simple line
      repeatRider('line', 10).x((x, i) => i * 10)

      // Circle pattern
      repeatRider('circle', 20)
        .x((x, i) => Math.cos(i * 0.3) * 50)
        .y((y, i) => Math.sin(i * 0.3) * 50)

      // With base rider
      const base = makeRider('hero', 0, 0, 0.4, 0);
      repeatRider('clones', 5, base).x((x, i) => i * 10)

      // Grid with velocity
      repeatRider('grid', 25).grid(5, 10).vx((vx, i) => 0.4)

MANAGING RIDERS:
  addRider(rider)         - Add one or more riders (single object or array)
  clearRiders()           - Remove all riders from scene
  setRiders(riders)       - Replace all riders with new set (advanced)

SELECTING RIDERS (returns RiderSelection):
  getAllRiders()                    - All riders in scene
  getRidersByGroup(...groupNames)   - Riders in any of the groups
  getRidersNotInGroup(...groupNames) - Riders NOT in any of the groups

RIDERSELECTION METHODS:
  .all()              - Get all 17 contact points for selected riders
  .only(pointGroup)   - Get only specific contact points
  .exclude(pointGroup) - Get all except specific contact points

PREDEFINED POINT GROUPS:
  Regions: all, sled, body, scarf, notScarf
  Individual: peg, tail, nose, string, butt, shoulder
              rhand, lhand, rfoot, lfoot, hands, feet

COMPLETE EXAMPLES:
  // Create and add a single rider
  addRider(makeRider('hero', 0, 0, 0.4, 0, 0, true));

  // Create multiple riders with chainable API
  addRider(repeatRider('circle', 20).circle(50).vx((vx, i) => 0.4));

  // Complex pattern
  addRider(
    repeatRider('spiral', 30)
      .x((x, i) => Math.cos(i * 0.3) * (i * 2))
      .y((y, i) => Math.sin(i * 0.3) * (i * 2))
      .vx((vx, i) => 0.4)
  );

  // Select specific riders and contact points
  getAllRiders().only(sled)              // All riders, sled only
  getRidersByGroup('hero').all()         // Hero group, all points
  getRidersByGroup('main').exclude(scarf) // Main group without scarf
  getRidersNotInGroup('enemy').only(body) // Non-enemy riders, body only

  // Use with Gravity API (if installed)
  setGravityKeyframes([
    [[0, 2, 0], getRidersByGroup('hero').only(body), setGravity(0, 0.5, 80)]
  ]);
      `);
    }

    return {
      // Rider Getters (return RiderSelection objects)
      getAllRiders: getAllRiderIndices,
      getRidersByGroup,
      getRidersNotInGroup,

      // Utility
      setRiders,
      addRider,
      makeRider,
      repeatRider,
      clearRiders,
      help,

      // Classes
      RiderSelection,
      RiderRepeater,

      // Point Groups
      PointGroups,
    };
  })();

  // Expose MultiRiderAPI object
  window.MultiRiderAPI = MultiRiderAPI;

  // Expose PointGroups globally for easy access
  window.PointGroups = MultiRiderAPI.PointGroups;
  // Expose all functions globally
  window.getAllRiders = MultiRiderAPI.getAllRiders;
  window.getRidersByGroup = MultiRiderAPI.getRidersByGroup;
  window.getRidersNotInGroup = MultiRiderAPI.getRidersNotInGroup;
  window.addRider = MultiRiderAPI.addRider;
  window.makeRider = MultiRiderAPI.makeRider;
  window.repeatRider = MultiRiderAPI.repeatRider;
  window.setRiders = MultiRiderAPI.setRiders;
  window.clearRiders = MultiRiderAPI.clearRiders;
  window.RiderSelection = MultiRiderAPI.RiderSelection;
  window.RiderRepeater = MultiRiderAPI.RiderRepeater;

  // Expose individual point groups globally for convenience
  const {
    all,
    sled,
    body,
    scarf,
    notScarf,
    peg,
    tail,
    nose,
    string,
    butt,
    shoulder,
    rhand,
    lhand,
    lfoot,
    rfoot,
    hands,
    feet,
  } = MultiRiderAPI.PointGroups;
  window.all = all;
  window.sled = sled;
  window.body = body;
  window.scarf = scarf;
  window.notScarf = notScarf;
  window.peg = peg;
  window.tail = tail;
  window.nose = nose;
  window.string = string;
  window.butt = butt;
  window.shoulder = shoulder;
  window.rhand = rhand;
  window.lhand = lhand;
  window.lfoot = lfoot;
  window.rfoot = rfoot;
  window.hands = hands;
  window.feet = feet;

  console.log(
    "🚴 Multirider API loaded! All functions available globally. Type MultiRiderAPI.help() for API guide.",
  );
})();
