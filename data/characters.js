/**
 * Character definitions. `poses` map pose names → atlas frames.
 * `portrait` names the procedural portrait painter (src/characters/portraits).
 * `layer` 1 = visible to the main camera only (not to mirrors).
 */
export const CHARACTERS = {
  julian: {
    id: 'julian', name: 'Джулиан Рид', nameEn: 'JULIAN REED', portrait: 'julian', color: '#b5302f',
    poses: { idle: 'julian_idle', talk: 'julian_talk', think: 'julian_think', drink: 'julian_think' },
    speed: 1.55,
  },
  kayden: {
    id: 'kayden', name: 'Кайден Альварес', nameEn: 'KAYDEN ALVAREZ', portrait: 'kayden', color: '#8a7a5a',
    poses: { idle: 'kayden_idle', talk: 'kayden_talk', think: 'kayden_think' },
  },
  waiter: {
    id: 'waiter', name: 'Официант', nameEn: 'WAITER', portrait: 'waiter', color: '#9a9aa8',
    poses: { idle: 'waiter_idle', talk: 'waiter_talk', bow: 'waiter_hands', offer: 'waiter_talk' },
    speed: 1.2,
  },
  owen: {
    id: 'owen', name: 'Незнакомец', nameEn: 'STRANGER', portrait: null, color: '#5a5a6a',
    poses: { idle: 'owen_idle', think: 'owen_think', raise: 'owen_raise' },
    layer: 1, selfLight: 0x4a4652,
  },
  bartender: {
    id: 'bartender', name: 'Бармен', nameEn: 'BARTENDER', color: '#8a3030',
    poses: { idle: 'bartender_idle', talk: 'bartender_talk' },
  },
  waiter2: { id: 'waiter2', name: 'Официант', poses: { idle: 'waiter2' }, speed: 1.1 },
  patronA: { id: 'patronA', name: 'Посетитель', poses: { idle: 'patron_a' }, speed: 1.1, selfLight: 0x5a4c48 },
  patronB: { id: 'patronB', name: 'Посетитель', poses: { idle: 'patron_b', talk: 'patron_b_talk' }, selfLight: 0x5a4c48 },
  woman: { id: 'woman', name: 'Посетительница', poses: { idle: 'woman' }, selfLight: 0x5a4c48 },
};
