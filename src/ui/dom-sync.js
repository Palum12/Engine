// Skip redundant writes while still detecting changes made by event handlers.
export class DomSync {
  markup = new WeakMap();
  styles = new WeakMap();
  visibleOnly = false;
  canWrite(element) { return element && (!this.visibleOnly || !element.closest('[hidden]')); }
  text(element, value) { if (this.canWrite(element) && element.textContent !== String(value)) element.textContent = value; }
  html(element, value) {
    if (!this.canWrite(element)) return;
    const previous = this.markup.get(element), current = element.innerHTML;
    if (previous?.input === value && previous.serialized === current) return;
    if (current !== value) element.innerHTML = value;
    this.markup.set(element, { input: value, serialized: element.innerHTML });
  }
  attr(element, name, value) { if (this.canWrite(element) && element.getAttribute(name) !== String(value)) element.setAttribute(name, value); }
  property(element, name, value) { if (this.canWrite(element) && String(element[name]) !== String(value)) element[name] = value; }
  style(element, name, value) {
    if (!this.canWrite(element)) return;
    let properties = this.styles.get(element);
    if (!properties) { properties = new Map(); this.styles.set(element, properties); }
    const previous = properties.get(name), current = element.style[name];
    if (previous?.input === value && previous.serialized === current) return;
    if (current !== value) element.style[name] = value;
    properties.set(name, { input: value, serialized: element.style[name] });
  }
  css(element, name, value) { if (this.canWrite(element) && element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value); }
  toggle(element, name, active) { if (this.canWrite(element) && element.classList.contains(name) !== active) element.classList.toggle(name, active); }
}
