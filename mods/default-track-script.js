window.store.dispatch({
  type: 'SET_PLAYBACK_DIMENSIONS',
  payload: { width: 1920, height: 1080 }
});

window.store.dispatch({
  type: 'SET_VIEW_OPTION',
  payload: { key: 'playbackPreview', value: true }
});

window.store.dispatch({
  type: 'SET_AUDIO_OFFSET',
  payload: 10
});

window.store.dispatch({
  type: 'SET_AUDIO_VOLUME',
  payload: 0.50
});

window.store.dispatch({
  type: 'SET_INTERPOLATE',
  payload: true // Smooth = true; 40 fps = false; 60 fps = 60;
});

store.dispatch({
  type: 'SET_PLAYBACK_FOLLOWER_SETTINGS',
  payload: {
    maxZoom: 32,
    // area: 1,
    pull: 0.8,
    push: 0.01,
    roundness: 0.5,
    squareness: 0
  }
});
