import { CHARACTER_STATES, FINAL_STATES, INITIAL_STATES, WEREWOLF_DEFAULTS, WEREWOLF_RULES } from '../../data/narrative.js';

/**
 * Narrative state system for the Lizzie line on top of GameState (saved with the flags):
 *   char(id) / setChar(id, state)   — validated character states (§20)
 *   ww(name) / feed('animal'|'human') / tickDays(n) — the werewolf model (§19)
 *   route / fate                    — investigation_route, lizzie_fate (§21–22)
 */
export class NarrativeState {
  constructor(state) { this.s = state; }

  char(id) { return this.s.get(`char_${id}`, INITIAL_STATES[id]); }

  setChar(id, next) {
    const allowed = CHARACTER_STATES[id];
    if (!allowed?.includes(next)) { console.warn('[narrative] unknown state', id, next); return false; }
    const cur = this.char(id);
    if (FINAL_STATES[id]?.includes(cur) && cur !== next) { console.warn('[narrative] final state', id, cur, '→', next); return false; }
    this.s.set(`char_${id}`, next);
    // the mirrored global flags
    if (id === 'puriel' && next === 'dead') this.s.set('puriel_dead', true);
    if (id === 'vicky' && next === 'taken') this.s.set('vicky_taken', true);
    if (id === 'olivia' && next === 'taken') this.s.set('olivia_taken', true);
    if (id === 'olivia' && next === 'dead') this.s.set('olivia_dead', true);
    if (id === 'lizzie' && next === 'escaping') this.s.set('lizzie_escape_started', true);
    return true;
  }

  ww(name) { return this.s.get(`ww_${name}`, WEREWOLF_DEFAULTS[name]); }
  setWw(name, v) { this.s.set(`ww_${name}`, v); }

  /** A kill: animal blood keeps the human form ~a week, human blood four times longer. */
  feed(kind, n = 1) {
    const key = kind === 'human' ? 'human_blood_consumed' : 'animal_blood_consumed';
    this.setWw(key, this.ww(key) + n);
    const days = WEREWOLF_RULES.daysPerAnimal * n * (kind === 'human' ? WEREWOLF_RULES.humanBloodFactor : 1);
    this.setWw('human_form_duration', this.ww('human_form_duration') + days);
    this.setWw('blood_hunger', Math.max(0, this.ww('blood_hunger') - 0.3 * n * (kind === 'human' ? 4 : 1)));
    this.setWw('blood_rage', false);
  }

  /** Days pass: the human form wears off, hunger grows, past the threshold — rage. */
  tickDays(n) {
    const left = this.ww('human_form_duration') - n;
    this.setWw('human_form_duration', Math.max(0, left));
    if (left < 0) this.setWw('blood_hunger', Math.min(1, this.ww('blood_hunger') + 0.15 * -left));
    this.setWw('blood_rage', this.ww('blood_hunger') >= WEREWOLF_RULES.rageThreshold);
  }

  get route() { return this.s.get('investigation_route', null); }
  get fate() { return this.s.get('lizzie_fate', null); }

  /** The end of L5: written once, readable by every later chapter. */
  setFate(fate) {
    this.s.set('lizzie_fate', fate);
    this.s.set('lizzie_saved', fate === 'SAVED');
    this.setChar('lizzie', fate === 'SAVED' ? 'saved' : 'dead');
  }

  /** Replaying L5 (or switching route) starts from the same captive state: nothing of the other route leaks in (§22). */
  resetL5() {
    for (const k of ['lizzie_fate', 'lizzie_saved', 'lizzie_chapter_5_complete', 'olivia_dead', 'olivia_taken', 'lizzie_escape_started', 'char_lizzie', 'char_olivia']) delete this.s.flags[k];
    this.s.set('char_lizzie', 'captive');
    this.s.set('char_olivia', 'captive');
  }
}
