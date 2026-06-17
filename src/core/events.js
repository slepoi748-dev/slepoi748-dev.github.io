class EventBus {
  constructor() { this.map = new Map(); }
  on(type, handler) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) { this.map.get(type)?.delete(handler); }
  emit(type, payload) {
    this.map.get(type)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[bus] "${type}"`, e); }
    });
  }
}

export const bus = new EventBus();

export const EVENTS = {
  UNLOCK: 'app:unlock',
  LOCK: 'app:lock',
  SETTINGS_OPEN: 'settings:open',
  SETTINGS_CLOSE: 'settings:close',
  CONFIG_CHANGE: 'config:change',
  PASSCODE_ENTERED: 'passcode:entered',
};