/**
 * Life state of a character. Only ALIVE and DEAD are used by the demo, the
 * others are reserved so later scenes can extend behaviour without changing
 * the character system.
 */
export const CharacterState = Object.freeze({
  ALIVE: 'alive',
  DEAD: 'dead',
  INJURED: 'injured',
  UNCONSCIOUS: 'unconscious',
  HIDDEN: 'hidden',
});
