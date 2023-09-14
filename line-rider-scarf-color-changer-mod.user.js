// ==UserScript==

// @name         Line Rider Scarf Color Changer Mod
// @author       Ntnon
// @description  Easily edit the scarf color of bosh in Line Rider
// @version      1.0

// @namespace    http://tampermonkey.net/
// @match        https://www.linerider.com/*
// @match        https://*.official-linerider.com/*
// @match        http://localhost:8000/*
// @match        https://*.surge.sh/*
// @grant        none
// @downloadURL  https://github.com/ntnon/linerider-userscript-mods/blob/main/line-rider-scarf-color-changer-mod.user.js.user.js
// @updateURL    https://github.com/ntnon/linerider-userscript-mods/blob/main/line-rider-scarf-color-changer-mod.user.js.user.js
// ==/UserScript==

// jshint asi: true
// jshint esversion: 6

const updateLines = (linesToRemove, linesToAdd, name) => ({
  type: 'UPDATE_LINES',
  payload: { linesToRemove, linesToAdd },
  meta: { name: name }
})

const addLines = (line) => updateLines(null, line, 'ADD_LINES')

const commitTrackChanges = () => ({
  type: 'COMMIT_TRACK_CHANGES'
})

const revertTrackChanges = () => ({
  type: 'REVERT_TRACK_CHANGES'
})

const getSimulatorCommittedTrack = state => state.simulator.committedEngine

const NEW_TRACK = 'NEW_TRACK'
const LOAD_TRACK = 'LOAD_TRACK'
const SAVE_TRACK = 'SAVE_TRACK'

const newTrack = (isV61 = false) => ({
  type: NEW_TRACK,
  payload: {
    startPosition: { x: 0, y: 0 },
    version: isV61 ? '6.1' : '6.2',
    label: '',
    creator: '',
    description: '',
    dirty: false,
    saveTime: null,
    viewOnly: false,
    derivedFrom: null
  }
})

const loadTrackAction = (trackData) => ({
  type: LOAD_TRACK,
  payload: {
    viewOnly: trackData["for viewing only, please don't steal tracks"] === true,
    ...trackData
  }
})

const saveTrackAction = () => ({ type: SAVE_TRACK })

const removeLines = (lineIds) => updateLines('REMOVE_LINES', lineIds, null)

const setRiders = (riders) => ({
  type: SET_RIDERS,
  payload: riders
})

// Class to hold back-end information

class BoshPlaceMod {
  constructor(store, initState) {
    this.store = store
    this.state = initState

    this.changed = false

    this.track = this.store.getState().simulator.committedEngine

    store.subscribeImmediate(() => {
      this.onUpdate()
    })
  }

  // Committing changes

  commit() {
    if (this.changed) {
      this.store.dispatch(commitTrackChanges())
      this.store.dispatch(revertTrackChanges())
      this.changed = false
      return true
    }
  }

  onUpdate(nextState = this.state) {
    let shouldUpdate = false

    // Preview the lines if the mod is active

    if (!this.state.active && nextState.active) {
      window.previewLinesInFastSelect = true
    }
    if (this.state.active && !nextState.active) {
      window.previewLinesInFastSelect = false
    }

    // Update when user changes inputs of UI component

    if (this.state !== nextState) {
      this.state = nextState
      shouldUpdate = true
    }

    // Update when specific changes in track happen

    if (this.state.active) {
      const track = getSimulatorCommittedTrack(this.store.getState())

      if (this.track !== track) {
        this.track = track
        shouldUpdate = true
      }
    }

    // Changes made on update

    if (shouldUpdate) {

      if (this.changed) {
        this.store.dispatch(revertTrackChanges())
        this.changed = false
      }

      if (this.state.active) {
        let myLines = []

        // Add any mod logic here

        // Example: Creates a line based on slider values

        for (let { p1, p2 } of genLines(this.state)) {
          myLines.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            type: 2
          })
        }

        if (myLines.length > 0) {
          this.store.dispatch(addLines(myLines))
          this.changed = true
        }
      }
    }
  }
}

// Function to create UI component

function main() {
  const {
    React,
    store
  } = window

  const create = React.createElement

  // Class to hold front-end information

  class BoshPlaceModComponent extends React.Component {
    constructor(props) {
      super(props)

      this.state = {
        active: false,

        // Add any input variables used in UI here

        // Example: components of a rectangle
        boshId: 0,
        x: 0,
        y: 0,
      }

      // Pull from logic class

      this.myMod = new BoshPlaceMod(store, this.state)

      // Function called when window updates

      store.subscribe(() => {

      })
    }

    componentWillUpdate(nextProps, nextState) {
      this.myMod.onUpdate(nextState)
    }

    onActivate() {
      if (this.state.active) {

        //Do stuff when the mod is turned off here

        this.setState({ active: false })
      } else {

        //Do stuff when the mod is turned on here

        this.setState({ active: true })
      }
    }

    onCommit() {
      const committed = this.myMod.commit()
      if (committed) {
        this.setState({ active: false })
      }
    }

    /*
 
    Creates a slider element from an input variable given from this.state
 
    @param {key} The input variable stored in this.state
    @param {title} Title displayed on the UI element
    @param {props} The UI properties issued to the slider element
 
    */

    // Main render function

    render() {
      return create('div', null,
        this.state.active && create('div', null,

          // Render UI elements for the mod here
          // Example: Rectangle inputs width, height, x, y

          create('button', { style: { float: 'left' }, onClick: () => this.onCommit() },
            'Commit'
          )
        ),

        // Creates main mod button here

        create('button',
          {
            style: {
              backgroundColor: this.state.active ? 'lightblue' : null
            },
            onClick: this.onActivate.bind(this)
          },
          'Bosh Place Mod'
        )
      )
    }
  }

  window.registerCustomSetting(BoshPlaceModComponent)
}

// Initializes mod

if (window.registerCustomSetting) {
  main()
} else {
  const prevCb = window.onCustomToolsApiReady
  window.onCustomToolsApiReady = () => {
    if (prevCb) prevCb()
    main()
  }
}

// Utility functions can go here

// Example: Generate a rectangle from inputs

function* genLines({ width = 0, height = 0, xOff = 0, yOff = 0 } = {}) {
  const { V2 } = window

  // Create points from inputs

  const pointA = [xOff, yOff]
  const pointB = [xOff, yOff + height]
  const pointC = [xOff + width, yOff + height]
  const pointD = [xOff + width, yOff]

  // Return lines connecting points

  yield {
    p1: V2.from(pointA[0], pointA[1]),
    p2: V2.from(pointB[0], pointB[1])
  }

  yield {
    p1: V2.from(pointB[0], pointB[1]),
    p2: V2.from(pointC[0], pointC[1])
  }

  yield {
    p1: V2.from(pointC[0], pointC[1]),
    p2: V2.from(pointD[0], pointD[1])
  }

  yield {
    p1: V2.from(pointD[0], pointD[1]),
    p2: V2.from(pointA[0], pointA[1])
  }
}
