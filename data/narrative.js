/**
 * Narrative state of the Lizzie line (docs/claude/lizzy_arc_spec.md §19–22).
 * Everything lives in GameState flags (so saves carry it): character states as
 * `char_<id>`, the werewolf system as `ww_<name>`, plus the global flags below.
 * Transitions are validated (a dead character cannot come back alive).
 */

export const CHARACTER_STATES = {
  lizzie: ['curious', 'investigative', 'frightened', 'captive', 'grieving', 'desperate', 'escaping', 'saved', 'dead'],
  puriel: ['alive', 'attacked', 'dead'],
  olivia: ['alive', 'frightened', 'captive', 'taken', 'dying', 'dead'],
  vicky: ['alive', 'captive', 'taken'],
  bob: ['hostile_neutral', 'conversational', 'lore_source'],
  pack: ['guarding', 'feeding', 'hunting', 'territorial_conflict', 'human_form', 'wolf_form', 'blood_rage'],
};

// one-way states: once reached, earlier ones are refused
export const FINAL_STATES = { puriel: ['dead'], olivia: ['dead'], vicky: ['taken'], lizzie: ['saved', 'dead'] };

export const INITIAL_STATES = { lizzie: 'curious', puriel: 'alive', olivia: 'alive', vicky: 'alive', bob: 'hostile_neutral', pack: 'guarding' };

/**
 * The werewolf system as an extensible narrative model (not a simulation yet).
 * Days of human form: ~7 on animal blood, several animals extend it, human blood ×4.
 * Hunger grows when the form runs out; past the threshold — blood rage.
 */
export const WEREWOLF_DEFAULTS = {
  human_form_duration: 7,      // days
  animal_blood_consumed: 0,
  human_blood_consumed: 0,
  blood_hunger: 0,             // 0..1
  blood_rage: false,
  pack_territory_conflict: true,
  pack_current_territory: 'takhini_north',
  pack_enemy_territory: 'takhini_south',
};
export const WEREWOLF_RULES = { daysPerAnimal: 7, humanBloodFactor: 4, rageThreshold: 0.85 };

// global flags of the line (all false until set)
export const LIZZIE_FLAGS = [
  'lizzie_chapter_1_complete', 'lizzie_chapter_2_complete', 'lizzie_chapter_3_complete',
  'lizzie_chapter_4_complete', 'lizzie_chapter_5_complete',
  'puriel_dead', 'vicky_taken', 'olivia_taken', 'olivia_dead', 'lizzie_escape_started', 'lizzie_saved',
];
// investigation_route = 'VAMPIRE' | 'WEREWOLF' (set at the case folders, before L5)
// lizzie_fate = 'DEAD' | 'SAVED' (set at the end of L5, read by later chapters)
