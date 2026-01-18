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

  const RiderManager = (() => {
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
     * @param {Object} props - Rider properties (startPosition, startVelocity, startAngle, etc.)
     * @returns {Object} Rider object with copy() method
     */
    function makeRider(groups, props = {}) {
      if (!groups)
        throw new Error(
          "Rider must have a group. Either 'group' or ['group1', 'group2']",
        );
      const groupSet =
        groups instanceof Set
          ? new Set(groups)
          : new Set(Array.isArray(groups) ? groups : [groups]);
      return {
        groups: groupSet,
        startPosition: props.startPosition || { x: 0, y: 0 },
        startVelocity: props.startVelocity || { x: 0, y: 0 },
        startAngle: props.startAngle || 0,
        copy() {
          return makeRider(new Set(this.groups), {
            startPosition: { ...this.startPosition },
            startVelocity: { ...this.startVelocity },
            startAngle: this.startAngle,
            ...props,
          });
        },
        ...props,
      };
    }

    /**
     * Creates multiple copies of a rider with optional modifiers
     * @param {Object} rider - Base rider to repeat
     * @param {number} count - Number of copies to create
     * @param {string|Array|Set} groups - Group name(s) for the repeated riders
     * @param {Object} modifiers - Optional modifiers for startPosition, startVelocity, startAngle, groups
     * @returns {Array} Array of rider objects
     */
    function repeatRider(rider, count, groups, modifiers = {}) {
      if (!groups) throw new Error("Rider must have a group (string or array)");
      const groupSet =
        groups instanceof Set
          ? new Set(groups)
          : new Set(Array.isArray(groups) ? groups : [groups]);
      const result = [];
      for (let i = 0; i < count; i++) {
        const props = {
          startPosition: modifiers.startPosition
            ? modifiers.startPosition(rider.startPosition, i)
            : { ...rider.startPosition },
          startVelocity: modifiers.startVelocity
            ? modifiers.startVelocity(rider.startVelocity, i)
            : { ...rider.startVelocity },
          startAngle: modifiers.startAngle
            ? modifiers.startAngle(rider.startAngle, i)
            : rider.startAngle,
          ...Object.fromEntries(
            Object.entries(rider).filter(
              ([k]) =>
                ![
                  "groups",
                  "startPosition",
                  "startVelocity",
                  "startAngle",
                  "copy",
                ].includes(k),
            ),
          ),
        };
        let thisGroups = new Set(groupSet);
        if (modifiers.groups) {
          thisGroups = modifiers.groups(new Set(thisGroups), i);
        }
        result.push(makeRider(thisGroups, props));
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
     * Creates a base rider template with default properties
     * @param {Object} props - Rider properties (startPosition, startVelocity, startAngle, etc.)
     * @returns {Object} Base rider object with help method
     */
    function baseRider(props = {}) {
      return {
        help,
        startPosition: props.startPosition || { x: 0, y: 0 },
        startVelocity: props.startVelocity || { x: 0, y: 0 },
        startAngle: props.startAngle || 0,
        remountable: true,
        ...props,
      };
    }

    /**
     * Displays the complete RiderManager API guide in the console
     */
    function help() {
      console.log(`
        Riders (return RiderSelection objects):
          - getAllRiders() - returns RiderSelection with all riders
          - getRidersByGroup(...groupNames) - returns RiderSelection with matching riders
          - getRidersNotInGroup(...groupNames) - returns RiderSelection with non-matching riders

        RiderSelection methods:
          - .all() - get all contact points
          - .only([0,1,2]) or .only(sled) - get only specific contact points
          - .exclude([10,11,12]) or .exclude(scarf) - exclude specific contact points
          - .toContactPoints([0,1,2]) - convert to contact point array

        Predefined Point Groups:
          - all, sled, body, scarf, notScarf
          - peg, tail, nose, string, butt, shoulder
          - rhand, lhand, rfoot, lfoot, hands, feet

        Examples:
          getAllRiders().only(sled) // All riders, sled points only
          getRidersByGroup('main').exclude(scarf) // Main group without scarf
          getAllRiders().only(body) // All riders, body only
          getRidersByGroup('hero').only(hands) // Hero group, hands only
          `);
    }

    return {
      // Rider Getters (return RiderSelection objects)
      getAllRiders: getAllRiderIndices,
      getRidersByGroup,
      getRidersNotInGroup,

      // Utility
      addRider,
      baseRider,
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

  // Expose RiderManager object
  window.RiderManager = RiderManager;

  // Expose PointGroups globally for easy access
  window.PointGroups = RiderManager.PointGroups;
  // Expose all functions globally
  window.getAllRiders = RiderManager.getAllRiders;
  window.getRidersByGroup = RiderManager.getRidersByGroup;
  window.getRidersNotInGroup = RiderManager.getRidersNotInGroup;
  window.addRider = RiderManager.addRider;
  window.baseRider = RiderManager.baseRider;
  window.makeRider = RiderManager.makeRider;
  window.repeatRider = RiderManager.repeatRider;
  window.clearRiders = RiderManager.clearRiders;
  window.RiderSelection = RiderManager.RiderSelection;

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
  } = RiderManager.PointGroups;
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
    "🚴 Multirider API loaded! All functions available globally. Type RiderManager.help() for API guide.",
  );
})();
