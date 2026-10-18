/**
 * Narrative state shared by every scene: flags (booleans / numbers / strings),
 * the current story stage and which interactables were used.
 * Everything here is plain data so the save system can serialize it as is.
 */
export class GameState {
  constructor(bus) {
    this.bus = bus;
    this.reset();
  }

  reset() {
    this.flags = {};
    this.stage = 'explore';
    this.sceneId = 'bar';
    this.interacted = new Set();
    this.choices = [];
  }

  get(flag, fallback = false) { return flag in this.flags ? this.flags[flag] : fallback; }

  set(flag, value = true) {
    const prev = this.flags[flag];
    this.flags[flag] = value;
    if (prev !== value) this.bus.emit('flag', { flag, value, prev });
  }

  /**
   * Evaluates a tiny condition language used in data files:
   * "noticed_owen", "!read_news", "a && !b", "a || b".
   */
  test(expr) {
    if (!expr) return true;
    if (typeof expr === 'function') return !!expr(this);
    return expr.split('||').some((part) =>
      part.split('&&').every((term) => {
        const t = term.trim();
        return t.startsWith('!') ? !this.get(t.slice(1)) : !!this.get(t);
      }));
  }

  setStage(stage) {
    const prev = this.stage;
    this.stage = stage;
    this.bus.emit('stage', { stage, prev });
  }

  markInteracted(id) { this.interacted.add(id); }

  recordChoice(dialogueId, nodeId, index) { this.choices.push({ dialogueId, nodeId, index }); }

  serialize() {
    return {
      flags: { ...this.flags },
      stage: this.stage,
      sceneId: this.sceneId,
      interacted: [...this.interacted],
      choices: [...this.choices],
    };
  }

  restore(data) {
    this.flags = { ...(data.flags || {}) };
    this.stage = data.stage || 'explore';
    this.sceneId = data.sceneId || 'bar';
    this.interacted = new Set(data.interacted || []);
    this.choices = [...(data.choices || [])];
  }
}
