// ==UserScript==

// @name         Line Rider Constants
// @namespace    https://www.linerider.com/
// @author       Anton Nydal
// @description  Global constants for Line Rider API
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

  const PointGroups = {
    all: [...Array(17).keys()],
    sled: [0, 1, 2, 3],
    body: [4, 5, 6, 7, 8, 9],
    scarf: [10, 11, 12, 13, 14, 15, 16],
    notScarf: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    hands: [6, 7],
    feet: [8, 9],
  };

  // Expose constants globally
  window.lrConstants = {
    ContactPoints,
    PointGroups,
  };

  // Expose PointGroups (arrays)
  const {
    all, sled, body, scarf, notScarf, hands, feet,
  } = PointGroups;

  window.all = all;
  window.sled = sled;
  window.body = body;
  window.scarf = scarf;
  window.notScarf = notScarf;
  window.hands = hands;
  window.feet = feet;

  // Expose individual contact points as numbers
  window.peg = 0;
  window.tail = 1;
  window.nose = 2;
  window.string = 3;
  window.butt = 4;
  window.shoulder = 5;
  window.rhand = 6;
  window.lhand = 7;
  window.lfoot = 8;
  window.rfoot = 9;
})();

