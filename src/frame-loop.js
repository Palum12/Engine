// Physics follows the browser clock; drawing may run less often or sleep entirely.
export function createFrameLoop({ requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame,
  isActive, isVisible = () => !document.hidden, maxFps = () => 60, advance, render, updateUI }) {
  let pending = null, previous = null, drawn = null, uiElapsed = 0, dirty = false, disposed = false, moving = false;
  const schedule = () => { if (!disposed && pending === null) pending = requestFrame(frame); };
  function frame(time) {
    pending = null;
    if (disposed || !isVisible()) { previous = drawn = null; return; }
    const dt = previous === null ? 0 : Math.max(0, Math.min((time - previous) / 1000, .1));
    previous = time;
    const invalidated = dirty; dirty = false;
    advance(dt);
    uiElapsed += dt;
    if (invalidated || drawn === null || time - drawn >= 1000 / maxFps() - .01) {
      const renderDt = drawn === null ? 1 / 60 : Math.min((time - drawn) / 1000, .1);
      moving = !!render(renderDt);
      drawn = time;
    }
    if (invalidated || uiElapsed >= .08) { updateUI(); uiElapsed = 0; }
    if (isActive() || moving || dirty) schedule();
    else previous = drawn = null;
  }
  return {
    invalidate() { dirty = true; schedule(); },
    dispose() { disposed = true; if (pending !== null) cancelFrame(pending); pending = previous = drawn = null; }
  };
}
