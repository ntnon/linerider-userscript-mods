// ==UserScript==

// @name         Bosh Manager
// @namespace    https://www.linerider.com/
// @author       Anton
// @description  Bosh Manager Mod
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

const SELECT_TOOL = 'SELECT_TOOL'
const EMPTY_SET = new Set()

const commitTrackChanges = () => ({
    type: "COMMIT_TRACK_CHANGES"
});

const revertTrackChanges = () => ({
    type: "REVERT_TRACK_CHANGES"
});

const setTool = (tool) => ({
    type: 'SET_TOOL',
    payload: tool
})

const setToolState = (toolId, state) => ({
    type: 'SET_TOOL_STATE',
    payload: state,
    meta: { id: toolId }
})

const getToolState = (state, toolId) => state.toolState[toolId]
const getSelectToolState = state => getToolState(state, SELECT_TOOL)
const setSelectToolState = toolState => setToolState(SELECT_TOOL, toolState)
const setRiders = (new_riders) => ({ type: "SET_RIDERS", payload: new_riders })
const getSimulatorCommittedTrack = state => state.simulator.committedEngine;
const getSimulatorCommittedRiders = state => getSimulatorCommittedTrack(state).engine.state.riders

function getLinesFromPoints(points) {
    return new Set([...points].map(point => point >> 1))
}

class BoshAdderMod {
    constructor(store, initState) {
        this.store = store;

        this.changed = false;
        this.state = initState;

        /* Substate Variables */
        this.track = getSimulatorCommittedTrack(store.getState());
        this.selectedLines = EMPTY_SET
        this.newRiders = []
        this.riderGroupId = 0

        store.subscribeImmediate(() => {
            this.onUpdate()
        })

        //PUT IN GUARDS SO THAT IT DOESNT COMMIT WHEN CHANGING TOOLS
    }

    //update /fix
    remove() {
    }

    getComittedRiders() {
        return getSimulatorCommittedRiders(this.store.getState())
    }

    commit() {
        if (this.changed) {
            this.store.dispatch(commitTrackChanges());
            this.store.dispatch(revertTrackChanges());
            this.changed = false;
            return true;
        }
    }

    getMostRecentLine() {
        const lineArray = this.track.engine.state.lines.buffer
        if (lineArray.length > 0) {
            return lineArray[lineArray.length - 1]
        }
    }

    onUpdate(nextState = this.state) {
        // Helper variable to check if the mod should update
        let shouldUpdate = false;

        // Sets the line preview mode to fast select
        if (!this.state.active && nextState.active) {
            window.previewLinesInFastSelect = true;
        }
        if (this.state.active && !nextState.active) {
            window.previewLinesInFastSelect = false;
        }

        // Checks whether the mod state itself has changed
        if (this.state !== nextState) {
            this.state = nextState;
            shouldUpdate = true;
        }

        // Checks that the engine has changed, only if the mod is active
        if (this.state.active) {
            const track = getSimulatorCommittedTrack(this.store.getState());

            if (this.track !== track) {
                this.track = track;
                shouldUpdate = true;
                this.store.dispatch(revertTrackChanges())
            }
        }



        // Don't need to do anything if there aren't updates
        if (!shouldUpdate) return;

        // If changes have been made previously, discard them for the new changes incoming
        if (this.changed) {
            this.store.dispatch(revertTrackChanges());
            this.changed = false;
        }

        // If the mod isn't active, then no new changes are incoming and the previous changes have
        // already been discard, so the function is done
        if (!this.state.active) return;

        //load track amd riders
        const committed_riders = getSimulatorCommittedRiders(this.store.getState())

        const allLines = this.track.engine.state.lines.buffer
        if (allLines.length > 0 && this.state.useLastLine) {
            const lastLine = allLines[allLines.length - 1]
            this.state.x_init = lastLine.p2.x
            this.state.y_init = lastLine.p2.y
        }
        if (!this.state.useLastLine) {
            this.state.x_init = 0
            this.state.y_init = 0
        }

        let x_riders = 1
        let y_riders = 1

        if (this.state.multipleRiders) {
            x_riders = this.state.multi_rider_x
            y_riders = this.state.multi_rider_y
        }


        for (let iy = 0; iy < y_riders; iy++) {
            for (let ix = 0; ix < x_riders; ix++) {
                let newRider = {
                    "startPosition": {
                        "x": this.state.x_init + this.state.x + (ix * this.state.x_offset),
                        "y": this.state.y_init + this.state.y + (iy * this.state.y_offset)
                    },
                    "startVelocity": {
                        "x": this.state.x_velocity,
                        "y": this.state.y_velocity
                    },
                    "remountable": 1,
                }
                if (this.state.key) {
                    newRider["key"] = this.state.key
                }
                this.state.riderCount = [...committed_riders, ...this.newRiders].length

                if (this.state.riderCount < this.state.maxRiders) {
                    this.newRiders.push(newRider)
                }
            }
        }
        if (this.newRiders.length > 0) {
            this.store.dispatch(setRiders([...committed_riders, ...this.newRiders]))
        }
        this.state.riderCount = [...committed_riders, ...this.newRiders].length

        this.newRiders = []
        this.changed = true
    }
}

class BoshEditorMod {
    constructor(store, initState) {
        this.store = store;
        this.state = initState;

        /* Substate Variables */

        this.changed = false;

        store.subscribeImmediate(() => {
            this.onUpdate();
        });
    }

    commit() {
        if (!this.changed) return false;
        this.store.dispatch(commitTrackChanges());
        this.store.dispatch(revertTrackChanges());
        this.changed = false;
        return true;
    }

    remove(index, key) {
        let committed_riders = getSimulatorCommittedRiders(this.store.getState())
        console.log("committed", committed_riders.length)
        this.state.riders = committed_riders.splice(index, 1)
        console.log("state riders", this.state.riders.length)
        this.store.dispatch(setRiders(this.state.riders))
        this.changed = true
        this.commit()

    }

    getComittedRiders() {
        return getSimulatorCommittedRiders(this.store.getState())
    }

    onUpdate(nextState = this.state) {
        let shouldUpdate = false;

        if (this.state !== nextState) {
            this.state = nextState;
            shouldUpdate = true;
        }

        if (this.state.active) {
            /* Check State Changes */
            //this.state.riders = getSimulatorCommittedRiders(store.getState())
        }

        if (!shouldUpdate) return;

        if (this.changed) {
            this.store.dispatch(revertTrackChanges());
            this.changed = false;
        }

        if (!this.state.active) return;

        /* Apply Changes */


        this.store.dispatch(setRiders(this.state.riders))

        this.changed = true;
    }

}

function main() {
    const {
        React,
        store
    } = window;
    const create = React.createElement;

    class BoshAdderModComponent extends React.Component {
        constructor(props) {
            super(props);

            this.state = {
                active: false,
                useLastLine: true,
                multipleRiders: false,
                maxRiders: 10,
                riderCount: 0,
                x: 0,
                y: 0,
                x_init: 0,
                y_init: 0,
                x_velocity: 0.4,
                y_velocity: 0,
                multi_rider_x: 2,
                multi_rider_y: 2,
                x_offset: 10,
                y_offset: 10,
                key: "",
            };

            this.mod = new BoshAdderMod(store, this.state);
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


        getComittedRiders() {
            return getSimulatorCommittedRiders(this.store.getState())
        }


        renderString(key, title, props) {
            props = {
                ...props,
                value: this.state[key],
                onChange: e => this.setState({ [key]: e.target.value })
            };

            return create("div", { style: { display: "flex" } },
                title,
                create("input", { type: "text", ...props }),
            );
        }

        renderCheckbox(key, title, props) {
            props = {
                ...props,
                checked: this.state[key],
                onChange: e => this.setState({ [key]: e.target.checked })
            };

            return create("div", null,
                title,
                create("input", { type: "checkbox", ...props }),
            );
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

            return create("div", { style: {} },
                title,
                create("input", {
                    style: {
                        width: "4em"
                    }, type: "number", ...props
                }),
            );
        }

        render() {
            return create("div", null,
                this.state.active && create("div", null,
                    create("style", null,
                        `
                    
                    #table td, #table th {
                      border: 1px solid #ddd;
                        padding: 0.1em;
                    }

                    #table th {
                        text-align: center;
                    }
                    `
                    ),
                    this.renderCheckbox("useLastLine", "use last line ", {}),
                    this.renderCheckbox("multipleRiders", " multiple riders ", {}),
                    this.renderNumber("maxRiders", "max riders", { min: 1, step: 1 }),
                    create("table", { style: { width: "100%" } },
                        create("tr", { id: "table" },
                            create("th", null, "variable"),
                            create("th", null, "x"),
                            create("th", null, "y")
                        ),
                        create("tr", { id: "table" },
                            create("td", null, "position"),
                            create("td", null,
                                this.renderNumber("x", "", { step: 5 })),
                            create("td", null,
                                this.renderNumber("y", "", { step: 5 }))
                        ),
                        create("tr", { id: "table" },
                            create("td", null, "velocity"),
                            create("td", null,
                                this.renderNumber("x_velocity", "", { step: 0.1 })),
                            create("td", null,
                                this.renderNumber("y_velocity", "", { step: 0.1 }))
                        ),
                        this.state.multipleRiders && create("tr", { id: "table" },
                            create("td", null, "riders"),
                            create("td", null,
                                this.renderNumber("multi_rider_x", "", { min: 1, step: 1 })),
                            create("td", null,
                                this.renderNumber("multi_rider_y", "", { min: 1, step: 1 })),
                        ),
                        this.state.multipleRiders && create("tr", { id: "table" },
                            create("td", null, "gap"),
                            create("td", null,
                                this.renderNumber("x_offset", "", { step: 5 })),
                            create("td", null,
                                this.renderNumber("y_offset", "", { step: 5 }))
                        ),
                    ),
                    create("div", { style: { float: "right", display: "flex" } },
                        this.renderString("key", "", { placeholder: "key", style: { width: "5em" } }),
                        create("button",
                            {
                                style: { float: "right" },
                                onClick: this.onCommit.bind(this)
                            },
                            "commit"
                        ),

                    ),
                    "count: ", this.state["riderCount"],
                ),
                create("button",
                    {
                        style: { backgroundColor: this.state.active ? "lightblue" : null },
                        onClick: this.onActivate.bind(this)
                    },
                    "Bosh Adder"
                )
            )
        }
    }

    class BoshEditorModComponent extends React.Component {
        constructor(props) {
            super(props);

            this.state = {
                active: false,
                useGroup: true,
                targetRider: 0,
                targetGroup: "",
                showRemount: false,
                riders: [],
                /* State Props */
            };

            this.mod = new BoshEditorMod(store, this.state);
            store.subscribe(() => {
                //update when riders are updated elsewhere
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
                this.state.riders = getSimulatorCommittedRiders(store.getState())
            }
        }

        onCommit() {
            const committed = this.mod.commit();
            if (committed) {
                this.setState({ active: false });
            }
        }

        onRemove(index, key) {
            //this.mod.remove(index, key)
            this.setState(prevState => {
                const updatedRiders = [...prevState.riders];
                updatedRiders.splice(index, 1);
                return { riders: updatedRiders };
            }
            )
        }

        renderCheckbox(key, title, props) {
            props = {
                ...props,
                checked: this.state[key],
                onChange: e => this.setState({ [key]: e.target.checked })
            };

            return create("div", null,
                title,
                create("input", { type: "checkbox", ...props }),
            );
        }


        renderBoshString(key, index, props) {
            const value = this.state.riders[index] && this.state.riders[index][key] !== undefined
                ? this.state.riders[index][key] // Use the current value if it exists
                : "";
            props = {
                ...props,
                value,
                onChange: (e) => {
                    const newValue = e.target.value; // Get the input value directly as a string
                    this.setState(prevState => {
                        const updatedRiders = [...prevState.riders];
                        updatedRiders[index] = {
                            ...updatedRiders[index],
                            [key]: newValue // Update the value directly under the key
                        };
                        return { riders: updatedRiders };
                    });
                }
            };

            return create("div", { style: { display: "flex" } },
                create("input", { type: "text", ...props, style: { width: "4em" } }),
            );
        }

        renderBoshCheckbox(key, index, props) {
            const checked = Boolean(this.state.riders[index][key]);

            props = {
                ...props,
                checked,
                onChange: (e) => {
                    const value = e.target.checked;
                    this.setState(prevState => {
                        const updatedRiders = [...prevState.riders];
                        updatedRiders[index] = {
                            ...updatedRiders[index],
                            [key]: value
                        }
                            ;
                        return { riders: updatedRiders };
                    });
                }
            };

            return create("div", null,
                create("input", { type: "checkbox", ...props }),
            );
        }

        renderBoshNumber(key1, key2, index, props) {
            const rider = this.state.riders[index];

            const value = rider && rider[key1] && rider[key1][key2] !== undefined
                ? rider[key1][key2]
                : '';

            props = {
                ...props,
                value,
                onChange: (e) => {
                    const value = parseFloat(e.target.value);

                    this.setState(prevState => {
                        const updatedRiders = [...prevState.riders];
                        updatedRiders[index] = {
                            ...updatedRiders[index],
                            [key1]: {
                                ...updatedRiders[index][key1],
                                [key2]: value
                            }
                        };
                        return { riders: updatedRiders };
                    });
                }
            };

            return create("div", { style: {} },
                create("input", {
                    style: {
                        width: "4em"
                    },
                    type: "number",
                    ...props
                }),
            );
        }

        renderBoshEditor = (index) => {
            return create("tr", null,
                create("td", null, index),
                this.state.useGroup && create("td", null,
                    this.renderBoshString("key", index, { placeholder: "null" })),
                create("td", null,
                    this.renderBoshNumber("startPosition", "x", index, { step: 5 }),
                ),
                create("td", null,
                    this.renderBoshNumber("startPosition", "y", index, { step: 5 }),
                ),
                create("td", null,
                    this.renderBoshNumber("startVelocity", "x", index, { step: 0.1 }),
                ),
                create("td", null,
                    this.renderBoshNumber("startVelocity", "y", index, { step: 0.1 }),
                ),
                this.state.showRemount && create("td", null,
                    this.renderBoshCheckbox("remountable", index, {})),
                create("button", { onClick: () => this.onRemove(index).bind(this) }, "remove")
            )
        }

        render() {
            return create("div", null,
                this.state.active && create("div", null,
                    create("style", null,
                        `
                    
                    #table td, #table th {
                      border: 1px solid #ddd;
                        padding: 0.1em;
                    }

                    #table th {
                        text-align: center;
                    }
                    #table tr {
                        display: table-row; /
    }
                    `
                    ),
                    this.renderCheckbox("useGroup", "use key", {}),
                    this.renderCheckbox("showRemount", "show remount", {}), create("table", { id: "table" },
                        create("thead", null,  // Wrap headers in <thead>
                            create("tr", null,
                                create("th", null, "id"),
                                this.state.useGroup && create("th", null, "key"),
                                create("th", null, "x"),
                                create("th", null, "y"),
                                create("th", null, "vx"),
                                create("th", null, "vy"),
                                this.state.showRemount && create("th", null, "remount")
                            )
                        ),
                        create("tbody", null,  // Wrap rows in <tbody>
                            this.mod.state.riders.map((_, index) =>
                                this.renderBoshEditor(index)
                            )
                        )
                    ),
                    create("button", { onClick: this.onCommit.bind(this) }, "commit"),
                ),
                create("button",
                    {
                        style: { backgroundColor: this.state.active ? "lightblue" : null },
                        onClick: this.onActivate.bind(this)
                    },
                    "Bosh Editor"
                ),
            )
        }
    }
    window.registerCustomSetting(BoshEditorModComponent);
    window.registerCustomSetting(BoshAdderModComponent);
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