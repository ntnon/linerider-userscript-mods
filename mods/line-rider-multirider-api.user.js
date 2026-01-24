// ==UserScript==

// @name         Multirider API
// @namespace    https://www.linerider.com/
// @author       Anton Nydal
// @description  API for advanced rider management system for Line Rider
// @version      1.0
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
 * // Create multiple riders at different positions
 * const base = makeRider('main', 0, 0);
 * const riders = repeatRider(base, 5, 'clones', (pos, i) => ({ x: pos.x + i * 10, y: pos.y }));
 * addRider(riders);
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
     * Creates multiple copies of a rider with optional modifiers
     * @param {string|Array|Set} groups - Group name(s) for the repeated riders
     * @param {Object} rider - Base rider to repeat
     * @param {number} count - Number of copies to create
     * @param {Function|null} positionModifier - Function(pos, index) to modify startPosition (optional)
     * @param {Function|null} velocityModifier - Function(vel, index) to modify startVelocity (optional)
     * @param {Function|null} angleModifier - Function(angle, index) to modify startAngle (optional)
     * @param {Function|null} groupModifier - Function(groups, index) to modify groups (optional)
     * @returns {Array} Array of rider objects
     */
    function repeatRider(
      groups,
      rider,
      count,
      positionModifier = null,
      velocityModifier = null,
      angleModifier = null,
      groupModifier = null,
    ) {
      if (!groups) throw new Error("Rider must have a group (string or array)");
      const groupSet =
        groups instanceof Set
          ? new Set(groups)
          : new Set(Array.isArray(groups) ? groups : [groups]);
      const result = [];
      for (let i = 0; i < count; i++) {
        const pos = positionModifier
          ? positionModifier(rider.startPosition, i)
          : rider.startPosition;
        const vel = velocityModifier
          ? velocityModifier(rider.startVelocity, i)
          : rider.startVelocity;
        const angle = angleModifier
          ? angleModifier(rider.startAngle, i)
          : rider.startAngle;
        let thisGroups = new Set(groupSet);
        if (groupModifier) {
          thisGroups = groupModifier(new Set(thisGroups), i);
        }

        result.push(
          makeRider(
            thisGroups,
            pos.x,
            pos.y,
            vel.x,
            vel.y,
            angle,
            rider.remountable !== undefined ? rider.remountable : true,
          ),
        );
      }
      return result;
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
    Example: makeRider()

  repeatRider(groups, rider, count, posMod, velMod, angleMod, groupMod)
    - Creates multiple copies of a rider with optional modifiers
    - rider: A rider object created with makeRider()
    - count: Number of copies to create
    - groups: Group name(s) for the repeated riders
    - Modifiers are optional functions: (value, index) => newValue
    Example: repeatRider(makeRider('_', 0, 0), 5, 'clones', (pos, i) => ({x: pos.x + i*10, y: pos.y}))

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
  const hero = makeRider('hero', 0, 0, 0.4, 0, 0, true);
  addRider(hero);
  // Alternatively:
  addRider(makeRider('hero', 0, 0, 0.4, 0, 0, true))

  // Create multiple riders at different positions
  const template = makeRider('_', 0, 0);
  const clones = repeatRider(template, 5, 'clones', (pos, i) => ({x: pos.x + i*10, y: pos.y}));
  addRider(clones);

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
