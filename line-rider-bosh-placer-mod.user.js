// ==UserScript==

// @name         Bosh spawner
// @namespace    https://www.linerider.com/
// @author       Anton
// @description  Bosh placer mod
// @version      1.0.1
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
    this.riders = []
    this.lines = []
    this.lastLine = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }
    this.x_velocity = this.state.x_velocity
    this.y_velocity = this.state.y_velocity
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
            "x": this.x_velocity,
            "y": this.y_velocity
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
    if (this.changed) return false;
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
      this.x_velocity = this.state.x_velocity
      this.y_velocity = this.state.y_velocity
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
        active: false,
        x_velocity: 0.4,
        y_velocity: 0
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
      this.mod.remove()
    }
    onAdd() {
      this.mod.add()
    }

  renderSlider (key, props) {
      props = {
        ...props,
        value: this.state[key],
        onChange: e => {
  const value = parseFloat(e.target.value) || 0;
  this.setState({ [key]: value });
  this.handleAdditionalLogic(value); // Call additional logic function if needed
}
      }
      return create('div', null,
        key,
        create('input', { style: { width: '3em' }, type: 'number', ...props }),
        create('input', { type: 'range', ...props, onFocus: e => e.target.blur() })
      )
    }

    render() {
      return create("div", null,
        this.state.active && create("div", null,
          /* Mod UI */
          create("div", null,

          this.renderSlider("x_velocity", { min: -40, max: 40, step: 1}),
          this.renderSlider("y_velocity", { min: -40, max: 40, step: 1})
          ),
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
          "Bosh spawner"
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
