/**
 * The Saturday crowd of the "Northern Rose".
 * Each entry: frame (atlas), and one of
 *   seat: { fg: i }       foreground table chair i (world.foregroundSeats)
 *   seat: { stool: i }    bar stool i (raised: stool seat is higher than a chair)
 *   seat: { x, z, y }     explicit seat (banquette / mid tables)
 *   at:   { x, z }        standing spot
 * facing: 1 → right, -1 → left. `block` adds a collider (standing in the walk lane).
 */
export const STOOLS_X = [-5.35, -3.8, -2.25, -0.7, 0.85, 2.4, 3.95];
export const STOOL_Z = -2.73;
export const STOOL_LIFT = 0.32;

export const CROWD = [
  // --- at the bar, on stools
  { frame: 'sit_soldier', seat: { stool: 0 }, facing: 1 },
  { frame: 'sit_glasses_v', seat: { stool: 2 }, facing: -1 },
  { frame: 'sit_hat', seat: { stool: 3 }, facing: 1 },
  { frame: 'sit_fur_v', seat: { stool: 5 }, facing: -1 },
  { frame: 'sit_green', seat: { stool: 6 }, facing: 1 },
  // --- standing at the bar, backs to the room
  { frame: 'npc_cap_back', at: { x: -4.55, z: -2.38 }, block: true },
  { frame: 'npc_vest_back', at: { x: 1.62, z: -2.4 }, block: true },
  { frame: 'npc_glasses_back_v', at: { x: 3.18, z: -2.38 }, block: true },
  // --- second barman behind the counter
  { frame: 'npc_butler_side_v', at: { x: 2.3, z: -4.2 }, facing: -1, noShadow: true },
  // --- foreground tables (closest to the camera)
  { frame: 'sit_maid', seat: { fg: 0 }, facing: 1 },
  { frame: 'sit_burgundy', seat: { fg: 1 }, facing: -1 },
  { frame: 'sit_smoker', seat: { fg: 2 }, facing: 1 },
  { frame: 'sit_hat_v', seat: { fg: 4 }, facing: 1 },
  { frame: 'sit_fur', seat: { fg: 5 }, facing: -1 },
  { frame: 'sit_glasses', seat: { fg: 6 }, facing: 1 },
  { frame: 'sit_green_v', seat: { fg: 7 }, facing: -1 },
  { frame: 'sit_soldier_v', seat: { fg: 8 }, facing: 1 },
  { frame: 'sit_burgundy_v', seat: { fg: 10 }, facing: 1 },
  { frame: 'sit_maid_v', seat: { fg: 11 }, facing: -1 },
  { frame: 'sit_smoker_v', seat: { fg: 12 }, facing: 1 },
  // --- the table by the window
  { frame: 'sit_green', seat: { x: -10.42, z: -1.2 }, facing: 1 },
  { frame: 'sit_glasses_v', seat: { x: -8.98, z: -1.2 }, facing: -1 },
  // --- lounge table and banquette
  { frame: 'sit_burgundy_v', seat: { x: 6.2, z: -1.1 }, facing: 1 },
  { frame: 'sit_smoker', seat: { x: 7.64, z: -1.1 }, facing: -1 },
  { frame: 'sit_fur_v', seat: { x: 7.2, z: -4.3 }, facing: 1 },
  { frame: 'sit_hat', seat: { x: 8.35, z: -4.3 }, facing: -1 },
  { frame: 'sit_maid', seat: { x: 13.1, z: -4.3 }, facing: -1 },
  // --- standing groups
  { frame: 'npc_butler_front', at: { x: -12.95, z: -0.7 }, facing: 1, block: true },      // maître d' by the door
  { frame: 'npc_bluecoat_side', at: { x: -6.75, z: -0.85 }, facing: 1, block: true },     // a couple chatting
  { frame: 'npc_fur_front', at: { x: -6.08, z: -0.9 }, facing: -1, block: true },
  { frame: 'npc_green_side_v', at: { x: -7.0, z: -2.1 }, facing: -1, block: true },        // by the jukebox
  { frame: 'npc_vest_side_v', at: { x: -4.75, z: -1.75 }, facing: -1, block: true },       // watching the TV
  { frame: 'npc_fur_side_v', at: { x: 7.55, z: -2.25 }, facing: 1, block: true },          // lounge pair
  { frame: 'npc_glasses_front_v', at: { x: 4.95, z: -0.85 }, facing: -1, block: true },    // reading by the service door
  { frame: 'npc_bluecoat_front', at: { x: -1.3, z: -0.95 }, facing: 1, block: true },
  { frame: 'npc_cap_side_v', at: { x: -2.6, z: 0.6 }, facing: 1, wander: true },
  { frame: 'npc_fedora_side', at: { x: 8.2, z: -2.2 }, facing: -1, id: 'leaver' },
];
