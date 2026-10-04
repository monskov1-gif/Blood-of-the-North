import { storage } from '../core/storage.js';

/**
 * Data-driven dialogue runner (see data/dialogue/*.js for the node format).
 * It owns the flow (conditions, flags, commands, choices, checkpoints,
 * history, read-tracking). Presentation is delegated to a view.
 */
export class DialogueSystem {
  constructor({ bus, state, director, view, characters, dialogues }) {
    this.bus = bus;
    this.state = state;
    this.director = director;
    this.view = view;
    this.characters = characters;
    this.dialogues = dialogues;
    this.history = [];
    this.read = new Set(storage.get('read', []));
    this.active = null;
    this.checkpoint = null;
  }

  get busy() { return !!this.active; }

  nodeOrder(d) { return Object.keys(d.nodes); }

  /** Runs a dialogue to the end. Resolves with the id of the last node. */
  async start(id, { from } = {}) {
    const d = this.dialogues[id];
    if (!d) { console.warn('[dialogue] missing', id); return; }
    if (this.active) await this.active.promise;
    const order = this.nodeOrder(d);
    let nodeId = from || order[0];
    const run = { id, d, nodeId };
    let finish;
    run.promise = new Promise((r) => { finish = r; });
    this.active = run;
    this.bus.emit('dialogue-start', { id, mode: d.mode });
    await this.view.open(d, id, from);

    let last = null;
    while (nodeId) {
      const node = d.nodes[nodeId];
      if (!node) { console.warn('[dialogue] missing node', id, nodeId); break; }
      run.nodeId = nodeId;
      if (!this.state.test(node.if)) { nodeId = node.next || order[order.indexOf(nodeId) + 1]; continue; }
      if (node.checkpoint) {
        this.checkpoint = { dialogue: id, node: nodeId };
        this.bus.emit('checkpoint', this.checkpoint);
      }
      if (node.set) for (const [k, v] of Object.entries(node.set)) this.state.set(k, v);
      if (node.cmd) {
        for (const c of [].concat(node.cmd)) await this.director.run(c, { dialogue: this, node });
        if (this.active !== run) { finish(null); return null; } // aborted (load / title)
      }
      if (node.bg) await this.view.setBackground?.(node.bg);
      if (node.expr) this.view.setExpressions?.(node.expr);
      if (node.pose) for (const [cid, pose] of Object.entries(node.pose)) this.characters.get(cid)?.setPose(pose);

      let next = node.next || order[order.indexOf(nodeId) + 1];
      if (!(node.skipEmpty && !node.text)) {
        const key = `${id}:${nodeId}`;
        const line = {
          key, speaker: node.speaker, text: node.text, distort: node.distort || 0,
          read: this.read.has(key), mode: d.mode,
        };
        this.history.push({ speaker: node.speaker, text: node.text });
        if (this.history.length > 200) this.history.shift();
        this.bus.emit('line', line);
        if (node.choices) {
          const choices = node.choices.filter((c) => this.state.test(c.if));
          const idx = await this.view.showLine({ ...line, choices });
          if (this.active !== run) { finish(null); return null; }
          const choice = choices[idx];
          this.state.recordChoice(id, nodeId, idx);
          this.history.push({ speaker: 'choice', text: choice.text });
          if (choice.set) for (const [k, v] of Object.entries(choice.set)) this.state.set(k, v);
          next = choice.next || next;
        } else {
          await this.view.showLine(line);
        }
        if (this.active !== run) { finish(null); return null; }
        this.markRead(key);
      }
      last = nodeId;
      if (node.end) break;
      nodeId = next;
    }

    if (this.active === run) {
      await this.view.close(d);
      this.active = null;
      this.bus.emit('dialogue-end', { id, last });
    }
    finish(last);
    return last;
  }

  /** Forcefully ends the current dialogue (used by cutscene commands). */
  async abort() {
    const run = this.active;
    if (!run) return;
    this.active = null;
    this.view.waiter = null;
    await this.view.close(run.d);
    this.bus.emit('dialogue-end', { id: run.id, aborted: true });
  }

  markRead(key) {
    if (this.read.has(key)) return;
    this.read.add(key);
    storage.set('read', [...this.read]);
  }

  save() { return { checkpoint: this.checkpoint, history: this.history.slice(-60) }; }

  load(data) {
    this.checkpoint = data?.checkpoint || null;
    this.history = data?.history || [];
  }
}
