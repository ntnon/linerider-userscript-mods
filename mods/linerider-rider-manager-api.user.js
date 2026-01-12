// ==UserScript==

// @name         RiderManager API
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
  const sledPoints = [0, 1, 2, 3];
  const scarfPoints = [10, 11, 12, 13, 14, 15, 16];
  const riderPoints = [4, 5, 6, 7, 8, 9]; // Body parts only
  const notScarfPoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const allPoints = [...Array(17).keys()]; // All contact points (0-16)

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
     * Gets all contact points for all riders in the scene
     * @returns {Array} Array of contact point indices with keepOnly() method
     */
    function getAllPoints() {
      const riders = getRiders();
      return createContactPointsArray(riders);
    }

    /**
     * Helper function to create contact points array with keepOnly method attached
     * @param {Array} riders - Array of rider objects
     * @returns {Array} Array of contact point indices with keepOnly() method
     */
    function createContactPointsArray(riders) {
      const allRiders = getRiders();
      const groupSize = 17;
      const contactPoints = [];

      riders.forEach((rider) => {
        const riderIndex = allRiders.indexOf(rider);
        if (riderIndex !== -1) {
          for (let j = 0; j < groupSize; j++) {
            contactPoints.push(riderIndex * groupSize + j);
          }
        }
      });

      contactPoints.keepOnly = function (points) {
        return this.filter((point) => points.includes(point % 17));
      };

      return contactPoints;
    }

    /**
     * Gets rider objects that belong to any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {Array} Array of rider objects
     */
    function getRidersByGroup(...groupNames) {
      return getRiders().filter((rider) => {
        if (!(rider.groups instanceof Set)) return false;
        return groupNames.some((groupName) => rider.groups.has(groupName));
      });
    }

    /**
     * Gets rider objects that do NOT belong to any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {Array} Array of rider objects
     */
    function getRidersNotInGroup(...groupNames) {
      return getRiders().filter((rider) => {
        if (!(rider.groups instanceof Set)) return true;
        return !groupNames.some((groupName) => rider.groups.has(groupName));
      });
    }

    /**
     * Gets all contact points for riders in any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {Array} Array of contact point indices with keepOnly() method
     */
    function getPointsByGroup(...groupNames) {
      const riders = getRidersByGroup(...groupNames);
      return createContactPointsArray(riders);
    }

    /**
     * Gets all contact points for riders NOT in any of the specified groups
     * @param {...string} groupNames - One or more group names
     * @returns {Array} Array of contact point indices with keepOnly() method
     */
    function getPointsNotInGroup(...groupNames) {
      const riders = getRidersNotInGroup(...groupNames);
      return createContactPointsArray(riders);
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
        Riders:
          - getAllRiders()
          - getRidersByGroup(...groupNames)
          - getRidersNotInGroup(...groupNames)

        Contact Points:
          - getAllPoints()
          - getPointsByGroup(...groupNames)
          - getPointsNotInGroup(...groupNames)
          `);
    }

    /**
     * Gets all riders currently in the scene
     * @returns {Array} Array of all rider objects
     */
    function getAllRiders() {
      return getRiders();
    }

    return {
      // Rider Getters
      getAllRiders,
      getRidersByGroup,
      getRidersNotInGroup,

      // Contact Point getters
      getAllPoints,
      getPointsByGroup,
      getPointsNotInGroup,

      // Utility
      addRider,
      baseRider,
      makeRider,
      repeatRider,
      clearRiders,
      help,
    };
  })();

  // Expose RiderManager object
  window.RiderManager = RiderManager;
  // Expose all functions globally
  window.getAllRiders = RiderManager.getAllRiders;
  window.getRidersByGroup = RiderManager.getRidersByGroup;
  window.getRidersNotInGroup = RiderManager.getRidersNotInGroup;
  window.getAllPoints = RiderManager.getAllPoints;
  window.getPointsByGroup = RiderManager.getPointsByGroup;
  window.getPointsNotInGroup = RiderManager.getPointsNotInGroup;
  window.addRider = RiderManager.addRider;
  window.baseRider = RiderManager.baseRider;
  window.makeRider = RiderManager.makeRider;
  window.repeatRider = RiderManager.repeatRider;
  window.clearRiders = RiderManager.clearRiders;

  console.log(
    "🚴 RiderManager loaded! All functions available globally. Type RiderManager.help() for API guide.",
  );
})();
