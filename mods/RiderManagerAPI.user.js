(() => {
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
    function addGroup(groupName, baseRider, count = 1, modifiers = {}) {
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
        startPosition: props.startPosition || { x: 0, y: 0 },
        startVelocity: props.startVelocity || { x: 0, y: 0 },
        startAngle: props.startAngle || 0,
        remountable: true,
        ...props,
      };
    }

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
    window.addGroup = addGroup;
    window.baseRider = baseRider;

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
      addGroup,
      baseRider,
    };
  })();
  clearRiders();
  addRider(makeRider("default", { startPosition: { x: 0, y: 15 } }));
  addRider(
    repeatRider(makeRider("default"), 12, "group1", {
      startPosition: (pos, i) => ({ x: -i * 20, y: -i * 20 }),
    }),
  );
  console.log(getRiders());
  addRider(makeRider("default", { startPosition: { x: -10, y: 15 } }));
  console.log(getRiders());
  console.log("Group 1: ", getGroup("group1"));
  console.log("Default: ", getGroup("default"));

  // Demonstration of extended addRider with repeat configuration
  console.log("\n=== Extended addRider Examples ===");

  // Add repeated riders with position modification
  addRider({
    base: makeRider("formation", { startPosition: { x: 100, y: 100 } }),
    repeat: 4,
    modifiers: {
      startPosition: (pos, i) => ({ x: pos.x + i * 30, y: pos.y + i * 10 }),
    },
  });
  console.log("Formation group:", getGroup("formation"));

  // Add repeated riders with multiple modifiers
  addRider({
    base: makeRider("convoy", {
      startPosition: { x: 0, y: 200 },
      startVelocity: { x: 10, y: 0 },
      startAngle: 45,
    }),
    repeat: 3,
    modifiers: {
      startPosition: (pos, i) => ({ x: pos.x - i * 40, y: pos.y }),
      startVelocity: (vel, i) => ({ x: vel.x + i * 2, y: vel.y }),
      startAngle: (angle, i) => angle + i * 15,
      groups: (groups, i) => new Set([...groups, `convoy_${i}`]),
    },
  });
  console.log("Convoy group:", getGroup("convoy"));

  // Demonstrate new getter functions with keepOnly
  console.log("\n=== New Getter Functions Examples ===");
  console.log("Formation contact points (all):", getByGroup("formation"));
  console.log(
    "Formation contact points (sled only):",
    getByGroup("formation").keepOnly(sledPoints),
  );
  console.log(
    "Multiple groups contact points:",
    getByGroups(["formation", "convoy"]).keepOnly(riderPoints),
  );
  console.log("First rider contact points:", getRiderAt(0));
  console.log("First rider scarf points:", getRiderAt(0).keepOnly(scarfPoints));
  console.log(
    "Random 2 riders contact points:",
    getRandomRiders(2).keepOnly(notScarfPoints),
  );

  // Demonstration of new group-based functions
  console.log("\n=== Group-based Functions Examples ===");

  // Create a simple group (single rider)
  addGroup("squadron", baseRider({ startPosition: { x: 0, y: 300 } }));
  console.log("Squadron group:", getGroup("squadron"));

  // Create a group with multiple repeated riders
  addGroup(
    "formation_line",
    baseRider({ startPosition: { x: 0, y: 400 } }),
    5,
    {
      startPosition: (pos, i) => ({ x: pos.x + i * 25, y: pos.y }),
      startAngle: y(angle, i) => i * 10,
    },
  );
  console.log("Formation line group:", getGroup("formation_line"));

  // Create a convoy formation
  addGroup(
    "convoy",
    baseRider({
      startPosition: { x: 0, y: 500 },
      startVelocity: { x: 10, y: 0 },
    }),
    4,
    {
      startPosition: (pos, i) => ({ x: pos.x - i * 40, y: pos.y }),
      startVelocity: (vel, i) => ({ x: vel.x + i * 2, y: vel.y }),
    },
  );
  console.log("Convoy group:", getGroup("convoy"));

  // Use the new groups with getter functions
  console.log("Squadron contact points:", getByGroup("squadron"));
  console.log(
    "Formation line sled points:",
    getByGroup("formation_line").keepOnly(sledPoints),
  );

})();

