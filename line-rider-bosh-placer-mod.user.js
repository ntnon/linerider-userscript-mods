// ==UserScript==

// @name         _
// @namespace    https://www.linerider.com/
// @author       _
// @description  Bosh placer mod
// @version      1.0.0
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

/* global Actions, Selectors */

const Actions = {
  commitTrackChanges: () => ({
    type: 'COMMIT_TRACK_CHANGES'
  }),
  revertTrackChanges: () => ({
    type: 'REVERT_TRACK_CHANGES'
  }),
  setRiders: (newRiders) => ({ type: "SET_RIDERS", payload: newRiders })
}

class RiderMod {
  constructor(store, initState) {
    this.store = store;
    this.state = initState;
    this.name = "Rider Mod"
    this.riders = []
    this.lines = []
    this.lastLine = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }
    /* Substate Variables */

    this.changed = false;

    store.subscribeImmediate(() => {
      this.onUpdate();
    });
  }

  add() {
    const lastLine = this.lines[this.lines.length - 1]
    if (lastLine) {
      const newRiders = [
        ...this.riders,
        {
          "startPosition": {
            "x": lastLine.p2.x ?? 0,
            "y": lastLine.p2.y ?? 0
          },
          "startVelocity": {
            "x": 0.4,
            "y": 0
          },
          "remountable": 1
        }
      ]
      this.store.dispatch(Actions.setRiders(newRiders))
      this.riders = []
      this.changed = true;
    }
  }

  remove() {
    // Create a copy of the current riders array
    const newRiders = [...this.riders];
    // Remove the last rider from the copied array
    newRiders.pop();
    // Dispatch the updated array of riders
    this.store.dispatch(Actions.setRiders(newRiders));
    this.riders = [];
    this.changed = true;
  }


  commit() {
    if (!this.changed) return false;
    this.store.dispatch(Actions.commitTrackChanges());
    this.store.dispatch(Actions.revertTrackChanges());
    this.changed = false;
    return true;
  }

  onUpdate(nextState = this.state) {
    let shouldUpdate = false;

    if (this.state !== nextState) {
      this.state = nextState;
      shouldUpdate = true;
    }

    if (this.state.active) {
      /* Check State Changes */
      const riders = this.store.getState().simulator.engine.engine.state.riders
      const lines = this.store.getState().simulator.engine.engine.state.lines.buffer
      if (this.riders != riders) {
        this.riders = riders
      }
      if (this.lines != lines) {
        this.lines = lines
      }

    }

    if (!shouldUpdate) return;

    if (this.changed) {
      this.store.dispatch(Actions.revertTrackChanges());
      this.changed = false;
    }

    if (!this.state.active) return;
  }
}

function main() {
  const {
    React,
    store
  } = window;
  const create = React.createElement;

  class RiderModComponent extends React.Component {
    constructor(props) {
      super(props);

      this.state = {
        active: false
        /* State Props */
      };

      this.mod = new RiderMod(store, this.state);

      store.subscribe(() => {

      });
    }

    componentWillUpdate(nextProps, nextState) {
      this.mod.onUpdate(nextState);
    }

    onActivate() {
      if (this.state.active) {
        this.setState({ active: false });
      } else {
        this.setState({ active: true });
      }
    }

    onCommit() {
      const committed = this.mod.commit();

      if (committed) {
        this.setState({ active: false });
      }
    }
    onRemove() {
      this.mod.add()
    }
    onAdd() {
      this.mod.remove()
    }

    render() {
      return create("div", null,
        this.state.active && create("div", null,
          /* Mod UI */
          create("button",
            {
              style: { float: "left" },
              onClick: this.onAdd.bind(this)
            },
            "Add Rider"
          ),
          create("button",
            {
              style: { float: "left" },
              onClick: this.onRemove.bind(this)
            },
            "Remove Rider"
          ),
          create("button",
            {
              style: { float: "left" },
              onClick: this.onCommit.bind(this)
            },
            "Commit"
          )
        ),
        create("button",
          {
            style: { backgroundColor: this.state.active ? "lightblue" : null },
            onClick: this.onActivate.bind(this)
          },
          this.mod.name
        )
      );
    }

  }


  window.registerCustomSetting(RiderModComponent);
}

if (window.registerCustomSetting) {
  main();
} else {
  const prevCb = window.onCustomToolsApiReady;
  window.onCustomToolsApiReady = () => {
    if (prevCb) prevCb();
    main();
  };
}

/* Utility Functions */