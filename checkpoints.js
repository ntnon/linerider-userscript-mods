GravityAPI.help()

clearRiders()
startRiders = repeatRider(3, "startRiders", makeRider().vel(0, 0).pos(-100, 0))
addRider(startRiders)

checkpoint1 = [100, 0]

sendToCheckpoint = (t, cps, checkpoint) => [
    [t, cps, adjustRider().pos(0, 0).absolute().pose(Poses.default).gravity(0, 0).vel(0.1, 0.1)],
    [t+5 , cps, adjustRider().pos(0, 0).absolute().pose(Poses.default).gravity(0, 0).vel(0.1, 0.1)],
    [t+10, cps, adjustRider().pos(0, 0).absolute().pose(Poses.default).gravity(0, 0).vel(0.1, 0.1)],
    [t + 40, cps, adjustRider().pos(50, 50).absolute().pose(Poses.kramual).angle(90).vel(3, 0)],
    [t + 42, cps, pulseGravity(-0.1, 0.1)],
    [t + 160, cps, adjustRider().pos(checkpoint[0], checkpoint[1]).absolute().pose(Poses.default).gravity(0, 0)]
]

gravityStartRiders = [

    [ 1, getRidersByGroup("startRiders").all(), setGravity(0,0.175), Intervals.stagger(1)],
    ...sendToCheckpoint(40, getRidersByGroup("startRiders").all(), checkpoint1)
]

setGravityKeyframes([
    [0, allRiders().all(), setGravity(0, 0)],
    ...gravityStartRiders
])
