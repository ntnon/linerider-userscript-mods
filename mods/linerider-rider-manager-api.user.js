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
    // CRITICAL: Each rider MUST have exactly 17 contact points in sequence.
    // Rider identification depends on finding contact points in continuous
    // blocks of 17 points per rider (rider index = contactPoint ÷ 17).
    function getRiders() {
      return Selectors.getRiders();
    }

    function setRiders(newRiders) {
      const ridersArr = Array.isArray(newRiders) ? newRiders : [newRiders];
      Actions.setRiders(ridersArr);
      Actions.commitTrackChanges();
    }

    function addRider(riderOrArrayOrConfig) {
      let toAdd = [];

      // Check if it's a repeat configuration object
      if (
        riderOrArrayOrConfig &&
        typeof riderOrArrayOrConfig === "object" &&
        riderOrArrayOrConfig.base &&
        riderOrArrayOrConfig.repeat
      ) {
        const config = riderOrArrayOrConfig;
        const baseRider = config.base;
        const count = config.repeat;
        const modifiers = config.modifiers || {};

        // Generate repeated riders
        for (let i = 0; i < count; i++) {
          const props = {
            startPosition: modifiers.startPosition
              ? modifiers.startPosition(baseRider.startPosition, i)
              : { ...baseRider.startPosition },
            startVelocity: modifiers.startVelocity
              ? modifiers.startVelocity(baseRider.startVelocity, i)
              : { ...baseRider.startVelocity },
            startAngle: modifiers.startAngle
              ? modifiers.startAngle(baseRider.startAngle, i)
              : baseRider.startAngle,
            ...Object.fromEntries(
              Object.entries(baseRider).filter(
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

          let thisGroups = new Set(baseRider.groups);
          if (modifiers.groups) {
            thisGroups = modifiers.groups(new Set(thisGroups), i);
          }

          toAdd.push(RiderManager.makeRider(thisGroups, props));
        }
      } else {
        // Original behavior for single rider or array
        toAdd = Array.isArray(riderOrArrayOrConfig)
          ? riderOrArrayOrConfig
          : [riderOrArrayOrConfig];
      }

      const current = RiderManager.getRiders();
      RiderManager.setRiders([...current, ...toAdd]);
    }

    function clearRiders() {
      RiderManager.setRiders([]);
    }

    function getContactPoints(groupName = null) {
      const allRiders = RiderManager.getRiders();
      const groupSize = 17;
      const contactPoints = [];

      allRiders.forEach((rider, i) => {
        if (
          groupName === null ||
          RiderManager.getGroup(groupName).includes(rider)
        ) {
          for (let j = 0; j < groupSize; j++) {
            contactPoints.push(i * groupSize + j);
          }
        }
      });

      return contactPoints;
    }

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
          return RiderManager.makeRider(new Set(this.groups), {
            startPosition: { ...this.startPosition },
            startVelocity: { ...this.startVelocity },
            startAngle: this.startAngle,
            ...props,
          });
        },
        ...props,
      };
    }

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
        result.push(RiderManager.makeRider(thisGroups, props));
      }
      return result;
    }

    function addToGroup(groupName, ridersToAdd) {
      const toAdd = Array.isArray(ridersToAdd) ? ridersToAdd : [ridersToAdd];
      toAdd.forEach((rider) => {
        rider.groups =
          rider.groups instanceof Set
            ? rider.groups
            : new Set(rider.groups ? rider.groups : []);
        rider.groups.add(groupName);
      });
    }

    function removeFromGroup(groupName, ridersToRemove) {
      const toRemove = Array.isArray(ridersToRemove)
        ? ridersToRemove
        : [ridersToRemove];
      toRemove.forEach((rider) => {
        if (rider.groups instanceof Set) {
          rider.groups.delete(groupName);
        }
      });
    }

    function getGroup(groupName) {
      return RiderManager.getRiders().filter(
        (rider) => rider.groups instanceof Set && rider.groups.has(groupName),
      );
    }

    function allGroups() {
      const groupMap = {};
      RiderManager.getRiders().forEach((rider) => {
        if (rider.groups instanceof Set) {
          for (const group of rider.groups) {
            if (!groupMap[group]) groupMap[group] = [];
            groupMap[group].push(rider);
          }
        }
      });
      return groupMap;
    }

    // Helper function to create contact points array with keepOnly method attached
    function createContactPointsArray(riders) {
      const allRiders = RiderManager.getRiders();
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

      // Attach keepOnly method to the array
      contactPoints.keepOnly = function (points) {
        return this.filter((point) => points.includes(point));
      };

      return contactPoints;
    }

    // New getter functions
    function getByGroup(groupName) {
      const riders = RiderManager.getRiders().filter(
        (rider) => rider.groups instanceof Set && rider.groups.has(groupName),
      );
      return createContactPointsArray(riders);
    }

    function getByGroups(groupNames) {
      const groupArray = Array.isArray(groupNames) ? groupNames : [groupNames];
      const riders = RiderManager.getRiders().filter(
        (rider) =>
          rider.groups instanceof Set &&
          groupArray.some((group) => rider.groups.has(group)),
      );
      return createContactPointsArray(riders);
    }

    function getRiderAt(index) {
      const riders = RiderManager.getRiders();
      if (index < 0 || index >= riders.length) {
        return createContactPointsArray([]);
      }
      return createContactPointsArray([riders[index]]);
    }

    function getRidersInRange(start, end) {
      const riders = RiderManager.getRiders();
      const sliced = riders.slice(start, end);
      return createContactPointsArray(sliced);
    }

    function getRandomRiders(n) {
      const riders = [...RiderManager.getRiders()]; // Copy to avoid mutation
      const shuffled = riders.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, n);
      return createContactPointsArray(selected);
    }

    function getRidersNotInGroup(groupName) {
      const riders = RiderManager.getRiders().filter(
        (rider) =>
          !(rider.groups instanceof Set && rider.groups.has(groupName)),
      );
      return createContactPointsArray(riders);
    }

    // Group-based functions - simplified API
    function addRiderGroup(groupName, baseRider, count = 1, modifiers = {}) {
      const riders = [];

      for (let i = 0; i < count; i++) {
        const props = {
          startPosition: modifiers.startPosition
            ? modifiers.startPosition(baseRider.startPosition, i)
            : { ...baseRider.startPosition },
          startVelocity: modifiers.startVelocity
            ? modifiers.startVelocity(baseRider.startVelocity, i)
            : { ...baseRider.startVelocity },
          startAngle: modifiers.startAngle
            ? modifiers.startAngle(baseRider.startAngle, i)
            : baseRider.startAngle,
          ...Object.fromEntries(
            Object.entries(baseRider).filter(
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

        let thisGroups = new Set(baseRider.groups);
        thisGroups.add(groupName);
        if (modifiers.groups) {
          thisGroups = modifiers.groups(new Set(thisGroups), i);
        }

        riders.push(RiderManager.makeRider(thisGroups, props));
      }

      const current = RiderManager.getRiders();
      RiderManager.setRiders([...current, ...riders]);
      return riders;
    }

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

    function help() {
      console.log(`
🚴 RIDER MANAGER API GUIDE 🚴
═══════════════════════════════

🔗 FUNCTION ACCESS METHODS:
All* functions can be called in three ways:
• Direct:           makeRider(), addGroup(), getByGroup()
• Window object:    window.makeRider(), window.addGroup()
• RiderManager:     RiderManager.help(), RiderManager.addGroup()
* help() can only be called on the RiderManager object

📋 COMPLETE FUNCTION LIST:

🎯 GROUP MANAGEMENT (Primary API)
• addGroup(groupName, baseRider, count, modifiers)
  Create and add a group of riders to the scene
  Example: addGroup("squadron", baseRider({startPosition: {x:0, y:0}}), 5, {
    startPosition: (pos, i) => ({x: pos.x + i*30, y: pos.y})
  })

• baseRider(props)
  Create base rider template without group assignment
  Example: baseRider({startPosition: {x:100, y:200}, startAngle: 45})

📍 CONTACT POINT GETTERS (Return arrays with keepOnly method)
• getByGroup(groupName)           - All contact points for a group
• getByGroups([group1, group2])   - All contact points for multiple groups
• getRiderAt(index)               - All contact points for rider at index
• getRidersInRange(start, end)    - All contact points for riders in range
• getRandomRiders(n)              - All contact points for n random riders
• getRidersNotInGroup(groupName)  - All contact points for riders NOT in group

📋 BASIC RIDER MANAGEMENT
• clearRiders()                   - Remove all riders from scene
• getRiders()                     - Get array of all rider objects
• setRiders(riders)               - Set riders array directly
• addRider(rider|config)          - Add single rider or repeat config
• makeRider(groups, props)        - Create a single rider with groups

🔍 GROUP QUERIES (Return rider objects, not contact points)
• getGroup(groupName)             - Get rider objects in specific group
• allGroups()                     - Get all groups as {groupName: [riders]}
• addToGroup(groupName, riders)   - Add existing riders to group
• removeFromGroup(groupName, riders) - Remove riders from group

🎪 CONTACT POINT FILTERING
• array.keepOnly(points)          - Filter array to only specified points
  Example: getRiderAt(0).keepOnly(sledPoints)

📊 LEGACY FUNCTIONS (Still available)
• getContactPoints(groupName)     - Get contact points for group (old method)
• repeatRider(rider, count, groups, modifiers) - Repeat single rider

📊 PREDEFINED CONTACT POINT ARRAYS
• ContactPoints = {PEG: 0, TAIL: 1, ...} - Named contact point constants
• sledPoints = [0,1,2,3]          - Sled contact points
• scarfPoints = [10,11,12,13,14,15,16] - Scarf contact points
• riderPoints = [4,5,6,7,8,9]     - Body contact points only
• notScarfPoints = [0,1,2,3,4,5,6,7,8,9] - All non-scarf points
• allPoints = [0,1,2,3...16]      - All 17 contact points

💡 EXAMPLE WORKFLOWS:

1. Create a formation:
   addGroup("fighters", baseRider({startPosition: {x:0, y:0}}), 4, {
     startPosition: (pos, i) => ({x: pos.x + i*50, y: pos.y})
   });

2. Get sled points for formation:
   const sledContactPoints = getByGroup("fighters").keepOnly(sledPoints);

3. Get first rider's scarf points:
   const firstRiderScarf = getRiderAt(0).keepOnly(scarfPoints);

4. Get all body points from multiple groups:
   const bodyPoints = getByGroups(["group1", "group2"]).keepOnly(riderPoints);

5. Call with different methods:
   makeRider()                    // Direct call
   window.makeRider()             // Window object
   RiderManager.makeRider()       // RiderManager object

⚠️  CRITICAL: Each rider has exactly 17 contact points in sequence!
    Rider identification: riderIndex = contactPoint ÷ 17

Type RiderManager.help() anytime to see this complete guide!
      `);
    }

    // Make functions globally available without any prefix
    // unsafeWindow.help = help;
    unsafeWindow.makeRider = makeRider;
    unsafeWindow.repeatRider = repeatRider;
    unsafeWindow.getRiders = getRiders;
    unsafeWindow.setRiders = setRiders;
    unsafeWindow.addRider = addRider;
    unsafeWindow.addToGroup = addToGroup;
    unsafeWindow.removeFromGroup = removeFromGroup;
    unsafeWindow.getGroup = getGroup;
    unsafeWindow.allGroups = allGroups;
    unsafeWindow.getContactPoints = getContactPoints;
    unsafeWindow.clearRiders = clearRiders;
    unsafeWindow.getByGroup = getByGroup;
    unsafeWindow.getByGroups = getByGroups;
    unsafeWindow.getRiderAt = getRiderAt;
    unsafeWindow.getRidersInRange = getRidersInRange;
    unsafeWindow.getRandomRiders = getRandomRiders;
    unsafeWindow.getRidersNotInGroup = getRidersNotInGroup;
    unsafeWindow.addRiderGroup = addRiderGroup;
    unsafeWindow.baseRider = baseRider;

    // Also make contact point arrays globally available
    unsafeWindow.ContactPoints = ContactPoints;
    unsafeWindow.sledPoints = sledPoints;
    unsafeWindow.scarfPoints = scarfPoints;
    unsafeWindow.riderPoints = riderPoints;
    unsafeWindow.notScarfPoints = notScarfPoints;
    unsafeWindow.allPoints = allPoints;

    // window.help = help;
    window.makeRider = makeRider;
    window.repeatRider = repeatRider;
    window.getRiders = getRiders;
    window.setRiders = setRiders;
    window.addRider = addRider;
    window.addToGroup = addToGroup;
    window.removeFromGroup = removeFromGroup;
    window.getGroup = getGroup;
    window.allGroups = allGroups;
    window.getContactPoints = getContactPoints;
    window.clearRiders = clearRiders;
    window.getByGroup = getByGroup;
    window.getByGroups = getByGroups;
    window.getRiderAt = getRiderAt;
    window.getRidersInRange = getRidersInRange;
    window.getRandomRiders = getRandomRiders;
    window.getRidersNotInGroup = getRidersNotInGroup;
    window.addRiderGroup = addRiderGroup;
    window.baseRider = baseRider;
    window.ContactPoints = ContactPoints;
    window.sledPoints = sledPoints;
    window.scarfPoints = scarfPoints;
    window.riderPoints = riderPoints;
    window.notScarfPoints = notScarfPoints;
    window.allPoints = allPoints;

    return {
      getRiders,
      setRiders,
      addRider,
      addToGroup,
      removeFromGroup,
      getGroup,
      allGroups,
      makeRider,
      repeatRider,
      getContactPoints,
      clearRiders,
      getByGroup,
      getByGroups,
      getRiderAt,
      getRidersInRange,
      getRandomRiders,
      getRidersNotInGroup,
      addRiderGroup,
      baseRider,
    };

    // Show help on startup
    console.log(
      "🚴 RiderManager loaded! Type window.RiderManager.help() for API guide.",
    );
  })();
})();
