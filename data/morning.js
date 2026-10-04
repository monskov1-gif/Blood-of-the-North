/**
 * Who lies where in BAR_MORNING_CRIME_SCENE. Bodies reuse the evening crowd
 * characters (matched by their atlas frame) so the player recognises them.
 *   pose: 'lying' (on the floor) | 'slumped' (stays in its seat)
 *   dir:  which way the body fell (+1 head to the right)
 * Staff (bartenders, waiters) survived — they are not in the room.
 */
export const BODIES = [
  { frame: 'npc_cap_back', pose: 'lying', x: -4.3, z: -2.0, dir: 1 },
  { frame: 'npc_butler_front', pose: 'lying', x: -12.05, z: -0.55, dir: -1 },
  { frame: 'npc_green_side_v', pose: 'lying', x: -9.25, z: -0.3, dir: 1 },
  { frame: 'npc_bluecoat_front', pose: 'lying', x: 10.55, z: -0.85, dir: -1 },
  { frame: 'npc_vest_back', pose: 'lying', x: 1.75, z: -2.05, dir: -1 },
  { frame: 'npc_fur_front', pose: 'lying', x: -6.2, z: -1.05, dir: 1 },
  { frame: 'sit_smoker', pose: 'slumped' },
  { frame: 'sit_burgundy', pose: 'slumped' },
  { frame: 'sit_fur_v', pose: 'slumped' },
  { frame: 'sit_glasses', pose: 'slumped' },
  { frame: 'sit_hat', pose: 'slumped' },
  { frame: 'sit_maid_v', pose: 'slumped' },
];

// Kayden fell by the table where they talked. Feet towards the room, head by
// the table: walking in from the left, the player sees the coat first, the face last.
export const KAYDEN_BODY = { x: -1.0, z: 1.15, dir: 1 };
export const JULIAN_WAKE = { x: -5.4, z: 0.45, dir: -1 };
