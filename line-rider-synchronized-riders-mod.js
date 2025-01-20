// ==UserScript==

// @name         Synchronized Riders Mod
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


const commitTrackChanges = () => ({
    type: "COMMIT_TRACK_CHANGES"
});

const revertTrackChanges = () => ({
    type: "REVERT_TRACK_CHANGES"
});

const setRiders = (new_riders) => ({ type: "SET_RIDERS", payload: new_riders })
const getSimulatorCommittedTrack = state => state.simulator.committedEngine;
const getSimulatorCommittedRiders = state => getSimulatorCommittedTrack(state).engine.state.riders



class RiderMod {
    constructor(store, initState) {
        this.store = store;
        this.state = initState;

        this.track = getSimulatorCommittedTrack(store.getState());

        this.changed = false;

        store.subscribeImmediate(() => {
            this.onUpdate();
        });
    }

    //update /fix
    remove() {
        if (this.changed) return false;
        const newRiders = getSimulatorCommittedRiders(this.store.getState()).pop()

        this.store.dispatch(setRiders(newRiders));
        this.riders = [];
        this.changed = true;
    }


    commit() {
        if (!this.changed) return false;
        this.store.dispatch(commitTrackChanges());
        this.store.dispatch(revertTrackChanges());
        this.changed = false;
        return true;
    }

    onUpdate(nextState = this.state) {
        let shouldUpdate = false;

        if (!this.state.active && nextState.active) {
            window.previewLinesInFastSelect = true;
        }
        if (this.state.active && !nextState.active) {
            window.previewLinesInFastSelect = false;
        }

        if (this.state !== nextState) {
            this.state = nextState;
            shouldUpdate = true;
        }

        if (this.state.active) {
            const track = getSimulatorCommittedTrack(this.store.getState());

            if (this.track !== track) {
                this.track = track;
                shouldUpdate = true;
            }
        }

        if (!shouldUpdate) return;

        if (this.changed) {
            this.store.dispatch(revertTrackChanges());
            this.changed = false;
        }


        if (!this.state.active) return;
        if (!shouldUpdate) return;


        if (this.changed) {
            this.store.dispatch(revertTrackChanges());
            this.changed = false;
        }

        if (!this.state.active) return;

        const committed_riders = getSimulatorCommittedRiders(this.store.getState())


        const new_riders = []

        for (let iy = 0; iy < this.state.rider_count_y; iy++) {
           for (let ix = 0; ix < this.state.rider_count_x; ix++) {
            new_riders.push({
                "startPosition": {
                    "x": this.state.x + (ix* this.state.x_offset),
                    "y": this.state.y + (iy*this.state.y_offset)
                },
                "startVelocity": {
                    "x": this.state.x_velocity,
                    "y": this.state.y_velocity
                },
                "remountable": 1,
                "createdUsingMod": true
            })
        }

        }

        this.store.dispatch(setRiders([...committed_riders, ...new_riders]))
        this.changed = true
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
                x: 0,
                y: 0,
                x_velocity: 0.4,
                y_velocity: 0,
                rider_count_x: 1,
                rider_count_y: 1,
                x_offset: 10,
                y_offset: 10
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

        renderSlider(key, title, props) {
            props = {
                ...props,
                value: this.state[key],
                onChange: e => this.setState({ [key]: parseFloat(e.target.value) })
            };

            return create("div", null,
                title,
                create("input", { style: { width: "3em" }, type: "number", ...props }),
                create("input", { type: "range", ...props, onFocus: e => e.target.blur() })
            );
        }

        renderNumber(key, title, props) {
            props = {
                ...props,
                value: this.state[key],
                onChange: e => this.setState({ [key]: parseFloat(e.target.value) })
            };

            return create("div", null,
                title,
                create("input", { style: { width: "3em" }, type: "number", ...props }),
            );
        }

        render() {
            return create("div", null,
                this.state.active && create("div", null,
                    create("div", null,
                        this.renderNumber("rider_count_x", "amount", { min: 0, max: 20, step: 1 }),
                        this.renderNumber("rider_count_y", "amount", { min: 0, max: 20, step: 1 }),

                        create("div", null,
                            this.renderSlider("x_offset", "x offset", { min: -40, max: 40, step: 1 }),
                            this.renderSlider("y_offset", "y offset", { min: -40, max: 40, step: 1 })
                        ),
                        this.renderSlider("x", "X", { min: -40, max: 40, step: 1 }),
                        this.renderSlider("y", "Y", { min: -40, max: 40, step: 1 }),
                        this.renderSlider("x_velocity", "x velocity", { min: -40, max: 40, step: 1 }),
                        this.renderSlider("y_velocity", "y velocity", { min: -40, max: 40, step: 1 })
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
