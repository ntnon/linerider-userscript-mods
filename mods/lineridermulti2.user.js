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
        return {
            groups: Array.isArray(groups) ? groups : [groups],
            startPosition: { x, y },
            startVelocity: { x: vx, y: vy },
            startAngle: angle,
            remountable,
        };
    }

    // Generate multiple riders
    function makeRiders(count, groups, opts = {}) {
        const riders = [];
        for (let i = 0; i < count; i++) {
            riders.push(
                makeRider(
                    groups,
                    opts.x || 0,
                    opts.y || 0,
                    opts.vx || 0,
                    opts.vy || 0,
                    opts.angle || 0,
                    opts.remountable !== undefined
                        ? opts.remountable
                        : true,
                ),
            );
        }
        return riders;
    }

    // Add riders to scene
    function addRiders(riders) {
        const current = window.Selectors.getRiders();
        window.Actions.setRiders([...current, ...riders]);
        window.Actions.commitTrackChanges();
    }

    // Remove all riders
    function clearRiders() {
        window.Actions.setRiders([]);
        window.Actions.commitTrackChanges();
    }

    // Select all riders
    function allRiders() {
        return window.Selectors.getRiders();
    }

    // Select riders by group
    function ridersByGroup(group) {
        return allRiders().filter(
            (r) => r.groups && r.groups.includes(group),
        );
    }

    // Select riders by indices
    function ridersByIndices(indices) {
        const riders = allRiders();
        return indices.map((i) => riders[i]).filter((r) => r);
    }

    // Select a single rider by index
    function rider(index) {
        return allRiders()[index];
    }

    // Filter contact points for a selection of riders
    function contactPoints(riders, points = PointGroups.all) {
        const result = [];
        riders.forEach((rider, riderIndex) => {
            points.forEach((cpIndex) => {
                result.push(riderIndex * 17 + cpIndex);
            });
        });
        return result;
    }

    // Expose API
    window.lrmulti = {
        makeRider,
        makeRiders,
        addRiders,
        clearRiders,
        allRiders,
        ridersByGroup,
        ridersByIndices,
        rider,
        contactPoints,
        PointGroups,
        ContactPoints,
    };
})();
