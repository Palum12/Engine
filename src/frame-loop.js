// Physics follows the browser clock; drawing may run less often or sleep entirely.
export function createFrameLoop({ requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame,
  isActive, isVisible = () => !document.hidden, maxFps = () => 60, advance, render, updateUI }) {
  let pending = null, previous = null, drawn = null, uiElapsed = 0, dirty = false, disposed = false, moving = false, rendering = false;
  const schedule = () => { if (!disposed && pending === null) pending = requestFrame(frame); };
  function frame(time) {
    pending = null;
    if (disposed || !isVisible()) { previous = drawn = null; return; }
    const waking = previous === null;
    const dt = waking ? 0 : Math.max(0, Math.min((time - previous) / 1000, .1));
    previous = time;
    const invalidated = dirty; dirty = false;
    advance(dt);
    uiElapsed += dt;
    const active = isActive();
    // A last physics step can finish between two drawing/UI deadlines.
    // Flush that terminal state before allowing the loop to sleep.
    if (invalidated || drawn === null || time - drawn >= 1000 / maxFps() - .01 || !active && !moving) {
      const renderDt = drawn === null ? 1 / 60 : Math.min((time - drawn) / 1000, .1);
      rendering = true;
      try { moving = !!render(renderDt); }
      finally { rendering = false; }
      drawn = time;
    }
    if (invalidated || uiElapsed >= .08 || !active && !moving && !dirty) { updateUI(); uiElapsed = 0; }
    // Controls can change derived physics at rest (for example disabling EV).
    // The zero-dt wake needs one real clock step before the scene can settle.
    if (active || moving || dirty || waking && invalidated) schedule();
    else previous = drawn = null;
  }
  return {
    invalidate() {
      // OrbitControls emits change from inside render while damping. The
      // returned moving flag already schedules it within the frame budgets.
      if (disposed || rendering) return;
      dirty = true;
      if (!isVisible()) {
        if (pending !== null) cancelFrame(pending);
        pending = previous = drawn = null;
        uiElapsed = 0;
        return;
      }
      schedule();
    },
    dispose() { disposed = true; if (pending !== null) cancelFrame(pending); pending = previous = drawn = null; }
  };
}
