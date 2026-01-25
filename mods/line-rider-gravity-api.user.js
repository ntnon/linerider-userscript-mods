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

/*
 * USAGE EXAMPLES:
 *
 * // Set gravity at frame 100 for all contact points
 * setGravityKeyframes([
 *   [[0, 2, 20], all, setGravity(0, 0.5, 100)]
 * ]);
 *
 * // Teleport rider at timestamp [0, 3, 0]
 * setGravityKeyframes([
 *   [[0, 3, 0], all, teleport(10, -5, 0, 0.175, frameNumber)]
 * ]);
 *
 * // Transform rider to position (100, 50) at frame 200
 * setGravityKeyframes([
 *   [[0, 5, 0], all, transformRider(0, 100, 50, true, null, 0, 0, 0.175, 200)]
 * ]);
 *
 * // Lock to Y axis at y=50 with max force 2.0 for 40 frames starting at frame 300
 * setGravityKeyframes([
 *   [[0, 7, 20], sled, lockToAxis(null, 50, 2.0, 40, 300, sled)]
 * ]);
 */
(function () {
  "use strict";

  const GravityAPI = (() => {
    const DEFAULT_GRAVITY = { x: 0, y: 0.175 };
    const FRAMES_PER_SECOND = 40;
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

    const DefaultPose = {
      [ContactPoints.PEG]: { x: 0, y: 0 },
      [ContactPoints.TAIL]: { x: 0, y: 5 },
      [ContactPoints.NOSE]: { x: 15, y: 5 },
      [ContactPoints.STRING]: { x: 17.5, y: 0 },
      [ContactPoints.BUTT]: { x: 5, y: 0 },
      [ContactPoints.SHOULDER]: { x: 5, y: -5.5 },
      [ContactPoints.RHAND]: { x: 11.5, y: -5 },
      [ContactPoints.LHAND]: { x: 11.5, y: -5 },
      [ContactPoints.LFOOT]: { x: 10, y: 5 },
      [ContactPoints.RFOOT]: { x: 10, y: 5 },
      [ContactPoints.SCARF_0]: { x: 3, y: -5.5 },
      [ContactPoints.SCARF_1]: { x: 1, y: -5.5 },
      [ContactPoints.SCARF_2]: { x: -1, y: -5.5 },
      [ContactPoints.SCARF_3]: { x: -3, y: -5.5 },
      [ContactPoints.SCARF_4]: { x: -5, y: -5.5 },
      [ContactPoints.SCARF_5]: { x: -7, y: -5.5 },
      [ContactPoints.SCARF_6]: { x: -9, y: -5.5 },
    };

    const KramualPose = {
      [ContactPoints.PEG]: { x: 0, y: 0 },
      [ContactPoints.TAIL]: { x: -0.48, y: 0 },
      [ContactPoints.NOSE]: { x: 16.9, y: 0 },
      [ContactPoints.STRING]: { x: 20.7, y: 0 },
      [ContactPoints.BUTT]: { x: 4.85, y: 0 },
      [ContactPoints.SHOULDER]: { x: 6.42, y: 0 },
      [ContactPoints.RHAND]: { x: 13.11, y: 0 },
      [ContactPoints.LHAND]: { x: 12.61, y: 0 },
      [ContactPoints.LFOOT]: { x: 12.57, y: 0 },
      [ContactPoints.RFOOT]: { x: 12.24, y: 0 },
      [ContactPoints.SCARF_0]: { x: 8.42, y: 0.02 },
      [ContactPoints.SCARF_1]: { x: 10.42, y: -0.02 },
      [ContactPoints.SCARF_2]: { x: 12.42, y: 0.01 },
      [ContactPoints.SCARF_3]: { x: 14.42, y: 0.06 },
      [ContactPoints.SCARF_4]: { x: 16.42, y: 0.05 },
      [ContactPoints.SCARF_5]: { x: 18.42, y: 0 },
      [ContactPoints.SCARF_6]: { x: 20.42, y: -0.01 },
    };

    const PointGroups = {
      ALL: [...Array(17).keys()], // All contact points (0-16)
      SLED: [0, 1, 2, 3],
      RIDER: [4, 5, 6, 7, 8, 9], // Body parts only
      SCARF: [10, 11, 12, 13, 14, 15, 16],
    };

    function timestampToFrames([minutes, seconds, remainingFrames]) {
      return (
        minutes * FRAMES_PER_SECOND * 60 +
        seconds * FRAMES_PER_SECOND +
        remainingFrames
      );
    }

    function toFrameIndex(ts) {
      return Array.isArray(ts) ? timestampToFrames(ts) : ts;
    }

    function calculateTargetPosition({
      contactPoint,
      anchorPoint = null,
      targetPosition,
      isAbsolute,
      pose,
      angle = 0,
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
      if (pose) {
        // Use provided pose offsets
        const anchorOffset = pose[anchor];
        const contactPointOffset = pose[contactPoint];

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

      // Apply angle if needed
      if (angle !== 0) {
        relativeOffset = rotateOffset(relativeOffset, angle);
      }

      if (isAbsolute && targetPosition !== null) {
        // Place anchor at absolute position, maintain pose for other points
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

    function resolvePose(pose, riderData, anchor) {
      return pose || buildCurrentPose(riderData, anchor);
    }

    function rotateOffset(offset, angleDegrees) {
      const angleRadians = angleDegrees * (Math.PI / 180);
      const cos = Math.cos(angleRadians);
      const sin = Math.sin(angleRadians);

      return {
        x: offset.x * cos - offset.y * sin,
        y: offset.x * sin + offset.y * cos,
      };
    }

    function buildCurrentPose(riderData, anchor) {
      const anchorPos = riderData.points[anchor].pos;
      const pose = {};
      for (const cp in riderData.points) {
        const p = riderData.points[cp].pos;
        pose[cp] = { x: p.x - anchorPos.x, y: p.y - anchorPos.y };
      }
      return pose;
    }

    /**
     * Applies gravity keyframes with optional interval grouping
     * @param {Array} baseTimestamp - Timestamp as [minutes, seconds, frames]
     * @param {Array} contactPoints - Array of contact point indices
     * @param {Function} keyframeFn - Function that generates keyframes
     * @param {Function} intervalFn - Function to compute interval offsets (default: simultaneous)
     * @returns {Array} Generated keyframes
     */
    function applyGravity(
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

      const timeAsFrames = timestampToFrames(baseTimestamp);
      const groupSize = 17;
      const numGroups = Math.ceil(contactPoints.length / groupSize);

      const validate = (keyframes) => {
        console.log("Validating keyframes:", keyframes);
        return (
          Array.isArray(keyframes) &&
          keyframes.every((kf) => Array.isArray(kf) && kf.length === 3)
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

    /**
     * Sets constant gravity
     * @param {number} x - X component of gravity
     * @param {number} y - Y component of gravity
     * @returns {Function} Function (time, contactPoints) => keyframes
     */
    function setGravity(x, y) {
      return (t, cp) => [
        [t, cp, (_keyframeContext) => ({ x, y, __default: true })],
      ];
    }

    /**
     * Applies a temporary gravity pulse that returns to the last setGravity value after duration
     * @param {number} x - X component of pulse gravity
     * @param {number} y - Y component of pulse gravity
     * @param {number} duration - Duration in frames for the pulse
     * @param {number} normalX - X component to return to (default: null, uses last setGravity)
     * @param {number} normalY - Y component to return to (default: null, uses last setGravity)
     * @returns {Function} Function (time, contactPoints) => keyframes
     */
    function pulseGravity(x, y, duration = 1, normalX = null, normalY = null) {
      if (duration < 1) throw Error("Duration must be 1 or more");
      return (t, cp) => [
        [t, cp, (_keyframeContext) => ({ x, y })],
        [
          t + duration + 1,
          cp,
          (keyframeContext) => ({
            x: normalX ?? keyframeContext.lastDefaultGravity.x,
            y: normalY ?? keyframeContext.lastDefaultGravity.y,
          }),
        ],
      ];
    }

    /**
     * Teleports the rider by applying instantaneous displacement, then returns to last setGravity
     * @param {number} deltaX - X displacement
     * @param {number} deltaY - Y displacement
     * @param {number} normalX - X component to return to (default: null, uses last setGravity)
     * @param {number} normalY - Y component to return to (default: null, uses last setGravity)
     * @returns {Function} Function (time, contactPoints) => keyframes
     */
    function teleport(dx, dy, normalX = null, normalY = null) {
      return (t, cp) => [
        [
          t,
          cp,
          (ctx) => ({
            x: dx,
            y: dy,
          }),
        ],
        [t + 1, cp, (ctx) => ({ x: -dx, y: -dy })],
        [
          t + 2,
          cp,
          (ctx) => ({
            x: normalX ?? ctx.lastDefaultGravity.x,
            y: normalY ?? ctx.lastDefaultGravity.y,
          }),
        ],
      ];
    }

    /**
     * Transforms the rider to a target position with optional angle
     * @param {number} anchorPoint - Contact point to use as anchor (0-16)
     * @param {number} positionX - Target X position
     * @param {number} positionY - Target Y position
     * @param {boolean} isAbsolute - Whether position is absolute (true) or relative (false)
     * @param {Object} pose - Pose configuration object (default: DefaultPose)
     * @param {number} angle - Rotation angle in degrees
     * @param {number} normalGravityX - X component of normal gravity to return to (default: 0)
     * @param {number} normalGravityY - Y component of normal gravity to return to (default: 0.175)
     * @returns {Array} Keyframe data
     */
    const adjustRiderFn =
      (
        anchorPoint = null,
        positionX = null,
        positionY = null,
        isAbsolute = false,
        pose = null,
        angle = 0,
        normalGravityX = null,
        normalGravityY = null,
      ) =>
      (t, cp = all) => {
        const position =
          positionX !== null && positionY !== null
            ? { x: positionX, y: positionY }
            : null;

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
                pose,
                angle,
                riderData: keyframeContext.riderData,
              });
              const pos = keyframeContext.contactPointData.pos;

              return {
                x: targetPos.x - pos.x - keyframeContext.contactPointData.vel.x,
                y: targetPos.y - pos.y - keyframeContext.contactPointData.vel.y,
              };
            },
          ],
          [
            t + 1,
            cp,
            (keyframeContext) => {
              const vel = keyframeContext.contactPointData.vel;
              return { x: -vel.x, y: -vel.y };
            },
          ],
          [
            t + 2,
            cp,
            (keyframeContext) => ({
              x: normalGravityX ?? keyframeContext.lastDefaultGravity?.x ?? 0,
              y:
                normalGravityY ??
                keyframeContext.lastDefaultGravity?.y ??
                0.175,
            }),
          ],
        ];
      };

    function adjustRider() {
      const state = {
        anchorPoint: null,
        positionX: null,
        positionY: null,
        isAbsolute: false,
        pose: null,
        rotation: 0,
        normalGravityX: null,
        normalGravityY: null,
      };

      const call = (t, cp) => {
        const fn = adjustRiderFn(
          state.anchorPoint,
          state.positionX,
          state.positionY,
          state.isAbsolute,
          state.pose,
          state.rotation,
          state.normalGravityX,
          state.normalGravityY,
        );
        return fn(t, cp);
      };

      call.pose = (p) => {
        state.pose = p;
        return call;
      };
      call.angle = (deg) => {
        state.rotation = deg;
        return call;
      };
      call.x = (px) => {
        state.positionX = px;
        return call;
      };
      call.y = (py) => {
        state.positionY = py;
        return call;
      };
      call.pos = (px, py) => {
        state.positionX = px;
        state.positionY = py;
        return call;
      };
      call.absolute = () => {
        state.isAbsolute = true;
        return call;
      };
      call.relative = () => {
        state.isAbsolute = false;
        return call;
      };
      call.anchor = (idx) => {
        state.anchorPoint = idx;
        return call;
      };
      call.gravity = (nx, ny) => {
        state.normalGravityX = nx;
        state.normalGravityY = ny;
        return call;
      };

      return call;
    }

    /**
     * Tweening/easing functions for smooth animations
     * All functions take a normalized time value (0-1) and return a tweened value (0-1)
     */
    const Tween = {
      /**
       * No easing - constant value throughout duration
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Always returns 1
       */
      none: (t) => 1,

      /**
       * Linear interpolation
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Linear interpolation
       */
      linear: (t) => t,

      /**
       * Quadratic ease in
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInQuad: (t) => t * t,

      /**
       * Quadratic ease out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeOutQuad: (t) => t * (2 - t),

      /**
       * Quadratic ease in-out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

      /**
       * Cubic ease in
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInCubic: (t) => t * t * t,

      /**
       * Cubic ease out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeOutCubic: (t) => --t * t * t + 1,

      /**
       * Cubic ease in-out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInOutCubic: (t) =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

      /**
       * Sine ease in
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),

      /**
       * Sine ease out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeOutSine: (t) => Math.sin((t * Math.PI) / 2),

      /**
       * Sine ease in-out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

      /**
       * Exponential ease in
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),

      /**
       * Exponential ease out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),

      /**
       * Exponential ease in-out
       * @param {number} t - Normalized time (0-1)
       * @returns {number} Eased value
       */
      easeInOutExpo: (t) =>
        t === 0
          ? 0
          : t === 1
            ? 1
            : t < 0.5
              ? Math.pow(2, 20 * t - 10) / 2
              : (2 - Math.pow(2, -20 * t + 10)) / 2,
    };

    /**
     * Locks contact points to specific axis positions using bounded force with optional tweening
     * @param {number|null} x - X axis position to lock to (null to ignore X)
     * @param {number|null} y - Y axis position to lock to (null to ignore Y)
     * @param {number} maxForce - Maximum force to apply for locking
     * @param {number} duration - Duration in frames to maintain lock
     * @param {Function} tweenFn - Tweening function (default: Tween.none for constant force)
     * @returns {Function} Function (startFrame, contactPoints) => keyframes
     */
    function lockToAxisFn(x, y, maxForce, duration, tweenFn = Tween.none) {
      return (startFrame, contactPoints) => {
        const keyframes = [];
        for (let i = 0; i < duration; i++) {
          keyframes.push([
            startFrame + i,
            contactPoints,
            (keyframeContext) => {
              const pos = keyframeContext.contactPointData.pos;
              const t = i / Math.max(duration - 1, 1); // Normalize time to 0-1
              const tweenedForce = tweenFn(t) * maxForce;
              let force = { x: 0, y: 0 };
              if (x !== null) {
                const dx = x - pos.x;
                force.x = Math.max(-tweenedForce, Math.min(tweenedForce, dx));
              }
              if (y !== null) {
                const dy = y - pos.y;
                force.y = Math.max(-tweenedForce, Math.min(tweenedForce, dy));
              }
              return force;
            },
          ]);
        }
        keyframes.push([
          startFrame + duration,
          contactPoints,
          (keyframeContext) => keyframeContext.lastGravity,
        ]);
        return keyframes;
      };
    }

    /**
     * Locks contact points to specific axis positions using bounded force
     * @param {number|null} axisX - X axis position to lock to (null to ignore X)
     * @param {number|null} axisY - Y axis position to lock to (null to ignore Y)
     * @param {number} maxForce - Maximum force to apply for locking
     * @param {number} duration - Duration in frames to maintain lock
     * @param {Function} tweenFn - Optional tweening function (default: Tween.none)
     * @returns {Function} Keyframe generator function
     *
     * @example
     * // Lock to Y=100 with constant force
     * applyGravity([0, 1, 0], all, lockToAxis(null, 100, 2, 40));
     *
     * @example
     * // Lock to X=50 with ease-out (starts strong, ends gentle)
     * applyGravity([0, 1, 0], all, lockToAxis(50, null, 3, 60, Tween.easeOutQuad));
     *
     * @example
     * // Lock to position (100, 200) with ease-in-out for smooth motion
     * applyGravity([0, 1, 0], all, lockToAxis(100, 200, 2, 80, Tween.easeInOutCubic));
     *
     * @example
     * // Linear increase in force over time
     * applyGravity([0, 1, 0], all, lockToAxis(0, 0, 5, 100, Tween.linear));
     */
    function lockToAxis(
      axisX,
      axisY,
      maxForce,
      duration,
      tweenFn = Tween.none,
    ) {
      return lockToAxisFn(axisX, axisY, maxForce, duration, tweenFn);
    }

    /**
     * Interval functions for spacing keyframe application across contact point groups
     */
    const Intervals = {
      /**
       * Apply to all groups simultaneously (no offset)
       * @returns {number} Always returns 0
       */
      simultaneous: () => 0,

      /**
       * Stagger application by fixed frame intervals
       * @param {number} frames - Number of frames between each group
       * @returns {Function} Function that returns frame offset for group index
       */
      stagger: (frames) => (i) => i * frames,

      /**
       * Apply with exponential spacing
       * @param {number} base - Base for exponential growth
       * @param {number} scale - Scaling factor (default: 1)
       * @returns {Function} Function that returns frame offset for group index
       */
      exponential:
        (base, scale = 1) =>
        (i) =>
          Math.pow(base, i) * scale,

      /**
       * Apply with sinusoidal spacing
       * @param {number} period - Period of the sine wave
       * @param {number} amplitude - Amplitude of the sine wave
       * @returns {Function} Function that returns frame offset for group index
       */
      sine: (period, amplitude) => (i) => Math.sin(i * period) * amplitude,
    };

    function getGravityForContactPoint({
      keyframes,
      frameIndex,
      globalCpIndex,
      context,
    }) {
      let lastGravity = undefined;
      let lastDefaultGravity = null;
      let found = false;
      for (const [timestamp, cps, gravityFn] of keyframes) {
        const frame = Array.isArray(timestamp)
          ? timestampToFrames(timestamp)
          : timestamp;
        if (frame > frameIndex) break;
        if (!cps.includes(globalCpIndex)) continue;

        lastGravity = gravityFn({
          ...context,
          frameIndex,
          globalCpIndex,
          lastGravity,
          lastDefaultGravity,
        });

        // Track the last default gravity for temporary effects to fall back to
        if (lastGravity && lastGravity.__default) {
          lastDefaultGravity = { x: lastGravity.x, y: lastGravity.y };
        }

        // Guard: check if gravity has null values
        if (lastGravity && (lastGravity.x == null || lastGravity.y == null)) {
          console.error("Gravity function produced null value:");
          console.error("  Frame:", frameIndex);
          console.error("  Contact Point Index:", globalCpIndex);
          console.error("  Timestamp:", timestamp);
          console.error("  Contact Points:", cps);
          console.error("  Result:", lastGravity);
          console.error("  Gravity Function:", gravityFn);
        }

        found = true;
      }
      if (!found) {
        throw new Error(
          'No gravity keyframe found. Please begin your gravity keyframes with "setGravityKeyframes" that targets all contact points.',
        );
      }
      return found ? lastGravity : DEFAULT_GRAVITY;
    }

    /**
     * Sets gravity keyframes for the simulation
     * @param {Array} items - Array of keyframe items in format [timestamp, contactPoints, keyframeFn, intervalFn?]
     */
    function isValidTimestamp(ts) {
      return Array.isArray(ts) || typeof ts === "number";
    }

    function setGravityKeyframes(items) {
      // Process items - accept array format [timestamp, contactPoints/RiderSelection, keyframeFn, intervalFn?]
      const processedKeyframes = items.map((item) => {
        // If it's an array [timestamp, contactPoints/RiderSelection, keyframeFn, intervalFn?]
        if (Array.isArray(item) && isValidTimestamp(item[0])) {
          let contactPoints = item[1];

          // Auto-detect and convert RiderSelection to contact points
          if (contactPoints && contactPoints._isRiderSelection) {
            contactPoints = contactPoints.toContactPoints();
          }

          // Convert number timestamp to array format [minutes, seconds, frames]
          const timestamp =
            typeof item[0] === "number" ? [0, 0, item[0]] : item[0];

          return applyGravity(
            timestamp, // timestamp
            contactPoints, // contactPoints (converted if needed)
            item[2], // keyframeFn
            item[3] || Intervals.simultaneous, // intervalFn (optional)
          );
        }

        // Fallback: assume it's already processed keyframes
        return item;
      });

      // Clear Cache
      window.store.getState().camera.playbackFollower._frames.length = 0;
      window.store.getState().simulator.engine.engine._computed._frames.length = 1;
      const currentIndex = store.getState().player.index;
      store.dispatch({ type: "SET_PLAYER_INDEX", payload: 0 });
      requestAnimationFrame(() =>
        store.dispatch({
          type: "SET_PLAYER_INDEX",
          payload: currentIndex,
        }),
      );
      window.allGravityKeyframes = processedKeyframes
        .flat()
        .sort((a, b) => a[0] - b[0]);

      triggerSubscriberHack();
    }

    /**
     * Triggers the gravity system by hooking into the engine's gravity property
     * @internal
     */
    function triggerSubscriberHack() {
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

    function help() {
      return `
				Keyframes:
					[
					t,
					contactPointArray,
					effectFn,
					optionalInterval
					]

				Keyframe with interval:
					[ t, [cp0, cp1, ..., cp16, cp0', cp1', ..., cp16', ...], effectFn, interval ]

					Here, the contact points are grouped by rider in blocks of 17.

					- With interval = 40:
					  At frame t: effect applies to Rider 1 (its 17 contact points)
					  At frame t + 40: effect applies to Rider 2 (its 17 contact points)
					  At frame t + 80: effect applies to Rider 3 (its 17 contact points)
					  ...and so on

					- With interval = 0 (or omitted):
					  At frame t: effect applies to all riders simultaneously (each rider’s 17 contact points)

				Effect functions:
					- setGravity(x, y)

					- pulseGravity(x, y, duration, normalX = 0, normalY = 0.175)
					  Applies a temporary gravity pulse (x, y) for 'duration' frames, then restores
					  to fallback/end gravity defined by (normalX, normalY).

					- teleport(dx, dy, normalX = 0, normalY = 0.175)
					  Instantly displaces by (dx, dy), applies inverse correction next frame,
					  then restores to fallback/end gravity (normalX, normalY).

					- lockToAxis(x = null, y = null, maxForce, duration, tweenFn = Tween.none)
					  Pulls each frame toward x and/or y with clamped force, with optional tweening.
					  Returns to the rider's last gravity after duration.

					- adjustRider()
					  Returns a chainable builder that produces a function (t, cp) => keyframes.
					  Example: adjustRider().pose(Poses.kramual).angle(90).x(100).relative()(t, cp)



			`.trim();
    }

    const Poses = {
      default: DefaultPose,
      kramual: KramualPose,
    };

    return {
      setGravityKeyframes,
      Intervals,
      Poses,
      Tween,

      // Gravity functions
      setGravity,
      pulseGravity,
      teleport,
      lockToAxis,
      adjustRider,
      help,
    };
  })();

  window.GravityAPI = GravityAPI;

  // Expose all main functions globally with proper signatures
  window.applyGravity = GravityAPI.applyGravity;
  window.setGravityKeyframes = GravityAPI.setGravityKeyframes;
  window.triggerSubscriberHack = GravityAPI.triggerSubscriberHack;
  window.setGravity = GravityAPI.setGravity;
  window.pulseGravity = GravityAPI.pulseGravity;
  window.teleport = GravityAPI.teleport;
  window.transformRider = GravityAPI.transformRider;
  window.lockToAxis = GravityAPI.lockToAxis;

  // Expose constants
  window.Intervals = GravityAPI.Intervals;
  window.Tween = GravityAPI.Tween;
  window.Shapes = GravityAPI.Shapes;
  window.ContactPoints = GravityAPI.ContactPoints;
  window.PointGroups = GravityAPI.PointGroups;

  console.log(
    "🚴 Gravity API loaded! All functions available globally. Type GravityAPI for the full API.",
  );
})();
