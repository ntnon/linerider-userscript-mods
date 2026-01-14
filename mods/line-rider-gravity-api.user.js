// ==UserScript==

// @name         Gravity API
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

(() => {
  class GravityAPI {
    // Define constants as  properties
    DEFAULT_GRAVITY = { x: 0, y: 0.175 };
    FRAMES_PER_SECOND = 40;
    ContactPoints = {
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

    PointGroups = {
      ALL: [...Array(17).keys()], // All contact points (0-16)
      SLED: [0, 1, 2, 3],
      RIDER: [4, 5, 6, 7, 8, 9], // Body parts only
      SCARF: [10, 11, 12, 13, 14, 15, 16],
    };

    DefaultShape = {
      // Sled points
      [this.ContactPoints.PEG]: { x: 0, y: 0 },
      [this.ContactPoints.TAIL]: { x: 0, y: 5 },
      [this.ContactPoints.NOSE]: { x: 15, y: 5 },
      [this.ContactPoints.STRING]: { x: 17.5, y: 0 },

      // Rider points
      [this.ContactPoints.BUTT]: { x: 5, y: 0 },
      [this.ContactPoints.SHOULDER]: { x: 5, y: -5.5 },
      [this.ContactPoints.RHAND]: { x: 11.5, y: -5 },
      [this.ContactPoints.LHAND]: { x: 11.5, y: -5 },
      [this.ContactPoints.LFOOT]: { x: 10, y: 5 },
      [this.ContactPoints.RFOOT]: { x: 10, y: 5 },

      // Scarf points
      [this.ContactPoints.SCARF_0]: { x: 3, y: -5.5 },
      [this.ContactPoints.SCARF_1]: { x: 1, y: -5.5 },
      [this.ContactPoints.SCARF_2]: { x: -1, y: -5.5 },
      [this.ContactPoints.SCARF_3]: { x: -3, y: -5.5 },
      [this.ContactPoints.SCARF_4]: { x: -5, y: -5.5 },
      [this.ContactPoints.SCARF_5]: { x: -7, y: -5.5 },
      [this.ContactPoints.SCARF_6]: { x: -9, y: -5.5 },
    };

    Kramual = {
      // Sled points
      [this.ContactPoints.PEG]: { x: 0, y: 0 },
      [this.ContactPoints.TAIL]: { x: -0.48, y: 0 },
      [this.ContactPoints.NOSE]: { x: 16.9, y: 0 },
      [this.ContactPoints.STRING]: { x: 20.7, y: 0 },

      // Rider points
      [this.ContactPoints.BUTT]: { x: 4.85, y: 0 },
      [this.ContactPoints.SHOULDER]: { x: 6.42, y: 0 },
      [this.ContactPoints.RHAND]: { x: 13.11, y: 0 },
      [this.ContactPoints.LHAND]: { x: 12.61, y: 0 },
      [this.ContactPoints.LFOOT]: { x: 12.57, y: 0 },
      [this.ContactPoints.RFOOT]: { x: 12.24, y: 0 },

      // Scarf points
      [this.ContactPoints.SCARF_0]: { x: 8.42, y: 0.02 },
      [this.ContactPoints.SCARF_1]: { x: 10.42, y: -0.02 },
      [this.ContactPoints.SCARF_2]: { x: 12.42, y: 0.01 },
      [this.ContactPoints.SCARF_3]: { x: 14.42, y: 0.06 },
      [this.ContactPoints.SCARF_4]: { x: 16.42, y: 0.05 },
      [this.ContactPoints.SCARF_5]: { x: 18.42, y: 0 },
      [this.ContactPoints.SCARF_6]: { x: 20.42, y: -0.01 },
    };

    timestampToFrames([minutes, seconds, remainingFrames]) {
      return (
        minutes * GravityAPI.FRAMES_PER_SECOND * 60 +
        seconds * GravityAPI.FRAMES_PER_SECOND +
        remainingFrames
      );
    }

    /**
     * Helper function to calculate target position for a contact point
     */
    // JavaScript
    calculateTargetPosition({
      contactPoint,
      anchorPoint = null,
      targetPosition,
      isAbsolute,
      shape,
      rotation = 0,
      riderData,
    }) {
      // Determine anchor (default to PEG)
      let anchor;
      if (anchorPoint !== null && anchorPoint !== undefined) {
        anchor = anchorPoint;
      } else {
        const keys = Object.keys(riderData.points);
        if (keys.length === 0) throw new Error("No points in riderData");
        anchor = keys[0];
      }

      let relativeOffset;
      if (shape) {
        // Use provided shape offsets
        const anchorOffset = shape[anchor];
        const contactPointOffset = shape[contactPoint];

        relativeOffset = {
          x: contactPointOffset.x - anchorOffset.x,
          y: contactPointOffset.y - anchorOffset.y,
        };
      } else {
        // Use current positions for offset
        const anchorPos = riderData.points[anchor].pos;
        const contactPos = riderData.points[contactPoint].pos;
        relativeOffset = {
          x: contactPos.x - anchorPos.x,
          y: contactPos.y - anchorPos.y,
        };
      }

      // Apply rotation if needed
      if (rotation !== 0) {
        relativeOffset = rotateOffset(relativeOffset, rotation);
      }

      if (isAbsolute && targetPosition !== null) {
        // Place anchor at absolute position, maintain shape for other points
        return {
          x: targetPosition.x + relativeOffset.x,
          y: targetPosition.y + relativeOffset.y,
        };
      }

      // Relative mode: anchor is at current position, add offset if provided
      const anchorData = riderData.points[anchor];
      const anchorPosition = {
        x: anchorData.pos.x + anchorData.vel.x,
        y: anchorData.pos.y + anchorData.vel.y,
      };
      const positionOffset =
        targetPosition && !isAbsolute ? targetPosition : { x: 0, y: 0 };

      return {
        x: anchorPosition.x + relativeOffset.x + positionOffset.x,
        y: anchorPosition.y + relativeOffset.y + positionOffset.y,
      };
    }

    resolveShape(shape, riderData, anchor) {
      return shape || buildCurrentShape(riderData, anchor);
    }

    rotateOffset(offset, angleDegrees) {
      const angleRadians = angleDegrees * (Math.PI / 180);
      const cos = Math.cos(angleRadians);
      const sin = Math.sin(angleRadians);

      return {
        x: offset.x * cos - offset.y * sin,
        y: offset.x * sin + offset.y * cos,
      };
    }

    // Helper to build current shape from riderData
    buildCurrentShape(riderData, anchor) {
      const anchorPos = riderData.points[anchor].pos;
      const shape = {};
      for (const cp in riderData.points) {
        const p = riderData.points[cp].pos;
        shape[cp] = { x: p.x - anchorPos.x, y: p.y - anchorPos.y };
      }
      return shape;
    }

    applyGravity(
      baseTimestamp,
      contactPoints,
      keyframeFn,
      intervalFn = () => 0,
    ) {
      console.log("applyGravity called with:", {
        baseTimestamp,
        contactPoints,
      });
      if (!Array.isArray(contactPoints))
        throw new Error("contactPoints must be an array");
      if (!Array.isArray(baseTimestamp))
        throw new Error(
          "baseTimestamp must be an array [minutes, seconds, frames]",
        );

      const timeAsFrames = this.timestampToFrames(baseTimestamp);
      const groupSize = 17;
      const numGroups = Math.ceil(contactPoints.length / groupSize);

      const validate = (keyframes) => {
        console.log("Validating keyframes:", keyframes);
        return (
          Array.isArray(keyframes) &&
          keyframes.every(
            (kf) => Array.isArray(kf) && (kf.length === 3 || kf.length === 4),
          )
        );
      };

      const needsGrouping = Array.from({ length: numGroups }, (_, i) =>
        intervalFn(i),
      ).some(Boolean);

      if (!needsGrouping) {
        const keyframes = keyframeFn(timeAsFrames, contactPoints);
        if (!validate(keyframes))
          throw new Error("Keyframe must be [time, contactPoints, effect]");
        return keyframes;
      }

      return Array.from({ length: numGroups }, (_, i) => {
        const group = contactPoints.slice(i * groupSize, (i + 1) * groupSize);
        const t = timeAsFrames + intervalFn(i);
        const keyframes = keyframeFn(t, group);
        if (!validate(keyframes))
          throw new Error("Keyframe must be [time, contactPoints, effect]");
        return keyframes;
      }).flat();
    }

    setGravity =
      ({ x, y }) =>
      (t, cp = all) => [[t, cp, (_keyframeContext) => ({ x, y })]];

    pulseGravity =
      ({ x, y, duration = 0, normalGravity }) =>
      (t, cp = all) => [
        [t, cp, (_keyframeContext) => ({ x, y }), true],
        [t + duration + 1, cp, (_keyframeContext) => normalGravity, true],
      ];

    teleport =
      ({ dx, dy, normalGravity = { x: 0, y: 0.175 } }) =>
      (t, cp = all) => [
        [
          t,
          cp,
          (ctx) => ({
            x: dx,
            y: dy,
          }),
          true,
        ],
        [t + 1, cp, (ctx) => ({ x: -dx, y: -dy }), true],
        [t + 2, cp, (_ctx) => normalGravity, true],
      ];

    transformRider =
      ({
        anchorPoint = null,
        position = null,
        isAbsolute = false,
        shape = null,
        rotation = 0,
        normalGravity = { x: 0, y: 0.175 },
      }) =>
      (t, cp = all) => {
        return [
          [
            t,
            cp,
            (keyframeContext) => {
              const targetPos = calculateTargetPosition({
                contactPoint: keyframeContext.contactPoint,
                anchorPoint,
                targetPosition: position,
                isAbsolute,
                shape,
                rotation,
                riderData: keyframeContext.riderData,
              });
              const pos = keyframeContext.contactPointData.pos;

              return {
                x: targetPos.x - pos.x - keyframeContext.contactPointData.vel.x,
                y: targetPos.y - pos.y - keyframeContext.contactPointData.vel.y,
              };
            },
            true,
          ],
          [
            t + 1,
            cp,
            (keyframeContext) => {
              const vel = keyframeContext.contactPointData.vel;
              return { x: -vel.x, y: -vel.y };
            },
            true,
          ],
          [t + 2, cp, (_keyframeContext) => normalGravity, true],
        ];
      };

    lockToAxisKeyframes(
      { x = null, y = null },
      maxForce,
      duration,
      startFrame,
      contactPoints,
    ) {
      const keyframes = [];
      for (let i = 0; i < duration; i++) {
        keyframes.push([
          startFrame + i,
          contactPoints,
          (keyframeContext) => {
            const pos = keyframeContext.contactPointData.pos;
            let force = { x: 0, y: 0 };
            if (x !== null) {
              const dx = x - pos.x;
              force.x = Math.max(-maxForce, Math.min(maxForce, dx));
            }
            if (y !== null) {
              const dy = y - pos.y;
              force.y = Math.max(-maxForce, Math.min(maxForce, dy));
            }
            return force;
          },
          true,
        ]);
      }
      // Optionally revert at the end
      keyframes.push([
        startFrame + duration,
        contactPoints,
        (keyframeContext) => keyframeContext.lastGravity,
        true,
      ]);
      return keyframes;
    }

    lockToAxis =
      ({ x = null, y = null }, maxForce, duration) =>
      (t, cp) =>
        lockToAxisKeyframes({ x, y }, maxForce, duration, t, cp);

    Intervals = {
      simultaneous: () => 0,
      stagger: (frames) => (i) => i * frames,
      exponential:
        (base, scale = 1) =>
        (i) =>
          Math.pow(base, i) * scale,
      sine: (period, amplitude) => (i) => Math.sin(i * period) * amplitude,
    };

    // JavaScript
    getGravityForContactPoint({
      keyframes,
      frameIndex,
      globalCpIndex,
      context,
    }) {
      let lastGravity = undefined;
      let found = false;
      for (const [timestamp, cps, gravityFn, computed] of keyframes) {
        const frame = Array.isArray(timestamp)
          ? timestampToFrames(timestamp)
          : timestamp;
        if (frame > frameIndex) break;
        if (!cps.includes(globalCpIndex)) continue;

        if (computed) {
          // Use the last non-computed gravity found so far
          lastGravity = gravityFn({
            ...context,
            frameIndex,
            globalCpIndex,
            lastGravity,
          });
        } else {
          lastGravity = gravityFn({
            ...context,
            frameIndex,
            globalCpIndex,
            lastGravity,
          });
        }
        found = true;
      }
      return found ? lastGravity : DEFAULT_GRAVITY;
    }

    setGravityKeyframes(gravity) {
      // Clear Cache
      window.store.getState().camera.playbackFollower._frames.length = 0;
      window.store.getState().simulator.engine.engine._computed._frames.length = 1;
      const currentIndex = store.getState().player.index;
      store.dispatch({ type: "SET_PLAYER_INDEX", payload: 0 });
      requestAnimationFrame(() =>
        store.dispatch({ type: "SET_PLAYER_INDEX", payload: currentIndex }),
      );
      window.allGravityKeyframes = gravity.flat().sort((a, b) => a[0] - b[0]);

      this.triggerSubscriberHack();
    }

    triggerSubscriberHack() {
      Object.defineProperty(window.$ENGINE_PARAMS, "gravity", {
        get() {
          const frameIndex =
            store.getState().simulator.engine.engine._computed._frames.length;

          const riders =
            store.getState().simulator.engine.engine.state.riders || [];
          const numRiders = riders.length;
          if (numRiders === 0) {
            return DEFAULT_GRAVITY;
          }

          const iterationsPerRider = 17;
          const globalIteration = (window.__gravityIterationCounter =
            (window.__gravityIterationCounter || 0) + 1);

          const currentRiderIndex =
            Math.floor((globalIteration - 1) / iterationsPerRider) % numRiders;
          const currentContactPoint =
            (globalIteration - 1) % iterationsPerRider;

          const globalCpIndex = currentRiderIndex * 17 + currentContactPoint;

          const allKeyframes = window.allGravityKeyframes || [];
          const riderIndex = Math.floor(globalCpIndex / 17);
          const contactPoint = globalCpIndex % 17;
          const frameData = store
            .getState()
            .simulator.engine.engine.getFrame(frameIndex - 1);
          const riderData =
            frameData?.snapshot?.entities?.[0]?.entities?.[riderIndex];
          const contactPointData = riderData?.points?.[contactPoint];
          let previousFrameData = null;
          let previousRiderData = null;
          let previousContactPointData = null;
          if (frameIndex >= 2) {
            previousFrameData = store
              .getState()
              .simulator.engine.engine.getFrame(frameIndex - 2);
            previousRiderData =
              previousFrameData.frameData?.snapshot?.entities?.[0]?.entities?.[
                riderIndex
              ];
            previousContactPointData =
              previousRiderData?.points?.[contactPoint];
          }

          return getGravityForContactPoint({
            keyframes: allKeyframes,
            frameIndex,
            globalCpIndex,
            context: {
              contactPoint,
              riderData,
              contactPointData,
              previousFrameData,
              previousRiderData,
              previousContactPointData,
            },
          });
        },
      });
    }
  }
  window.GravityAPI = GravityAPI;
  window.applyGravity = GravityAPI.applyGravity;
  window.setGravity = GravityAPI.setGravity;
  window.setGravityKeyframes = GravityAPI.setGravityKeyframes;
  window.applyGravity = GravityAPI.applyGravity;
  window.lockToAxis = GravityAPI.lockToAxis;
  window.pulseGravity = GravityAPI.pulseGravity;
  window.setGravity = GravityAPI.setGravity;
  window.transformRider = GravityAPI.transformRider;
  window.teleport = GravityAPI.teleport;
  window.timestampToFrames = GravityAPI.timestampToFrames;

  console.log("🚴 Gravity API loaded! All functions available globally");
})();
