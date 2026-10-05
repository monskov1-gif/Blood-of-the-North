/**
 * Character definitions. `poses` map pose names → atlas frames.
 * `portrait` names the procedural portrait painter (src/characters/portraits).
 * `layer` 1 = visible to the main camera only (not to mirrors).
 */
export const CHARACTERS = {
  julian: {
    id: 'julian', name: 'Джулиан Рид', nameEn: 'JULIAN REED', portrait: 'julian', color: '#b5302f',
    poses: { idle: 'julian_idle', talk: 'julian_talk', think: 'julian_think', drink: 'julian_think' },
    lie: 'lie_julian',
    speed: 1.55,
  },
  kayden: {
    id: 'kayden', name: 'Кайден Альварес', nameEn: 'KAYDEN ALVAREZ', portrait: 'kayden', color: '#8a7a5a',
    poses: { idle: 'kayden_idle', talk: 'kayden_talk', think: 'kayden_think' },
    lie: 'lie_kayden',
  },
  waiter: {
    id: 'waiter', name: 'Официант', nameEn: 'WAITER', portrait: 'waiter', color: '#9a9aa8',
    poses: { idle: 'waiter_idle', talk: 'waiter_talk', bow: 'waiter_hands', offer: 'waiter_talk' },
    speed: 1.2,
  },
  owen: {
    id: 'owen', name: 'Незнакомец', nameEn: 'STRANGER', portrait: 'owen', color: '#5a5a6a',
    poses: { idle: 'owen_back', think: 'owen_profile', raise: 'owen_front_raise', look: 'owen_front' },
    layer: 1, selfLight: 0x4a4652,
  },
  // the arrest: two constables + Quinn
  officer: {
    id: 'officer', name: 'Полицейский', nameEn: 'OFFICER', color: '#3a4a7a',
    poses: { idle: 'cop_blond_idle', aim: 'cop_blond_aim' }, speed: 1.6,
  },
  officer2: {
    id: 'officer2', name: 'Полицейский', nameEn: 'OFFICER', color: '#3a4a7a',
    poses: { idle: 'cop_red_idle', aim: 'cop_red_aim' }, speed: 1.5,
  },
  // Quinn Nova Torres — constable, Julian's friend (arrest, the drive, the news at the end)
  quinn: {
    id: 'quinn', name: 'Куинн Торрес', nameEn: 'QUINN TORRES', portrait: 'quinn', color: '#5a4a6a',
    poses: { idle: 'quinn_idle', talk: 'quinn_idle', aim: 'quinn_aim', drive: 'quinn_drive' }, speed: 1.5,
  },
  radio: { id: 'radio', name: 'Рация', nameEn: 'RADIO', poses: { idle: 'officer_seat' } },
  // --- custody / station / hospital cast
  driver: { id: 'driver', name: 'Куинн Торрес', nameEn: 'QUINN TORRES', portrait: 'quinn', poses: { idle: 'quinn_drive' } },
  sergeant: { id: 'sergeant', name: 'Сержант Пелли', nameEn: 'SGT. PELLY', poses: { idle: 'officer_b', walk: 'officer_b' }, speed: 1.3 },
  // Wyatt Nicholas Lewis — Julian doesn't know him; his name is never put on screen
  interrogator: { id: 'interrogator', name: 'Офицер', nameEn: 'OFFICER', portrait: 'wyatt', poses: { idle: 'wyatt_stand', sit: 'wyatt_seat' }, speed: 1.4 },
  investigator: { id: 'investigator', name: 'Детектив Мэтт Ковальски', nameEn: 'DET. KOWALSKI', poses: { idle: 'npc_fedora_side', front: 'npc_fedora_front' }, speed: 1.2 },
  survivorWaiter: { id: 'survivorWaiter', name: 'Ноа, официант', nameEn: 'NOAH', portrait: 'waiter', poses: { idle: 'waiter_idle', talk: 'waiter_talk', hands: 'waiter_hands' } },
  survivorWaiter2: { id: 'survivorWaiter2', name: 'Лео, официант', nameEn: 'LEO', poses: { idle: 'waiter2' } },
  chef: { id: 'chef', name: 'Ги Ларош, шеф', nameEn: 'CHEF LAROCHE', poses: { idle: 'chef' } },
  dishwasher: { id: 'dishwasher', name: 'Томми, посудомойщик', nameEn: 'TOMMY', poses: { idle: 'dishwasher' } },
  barman: { id: 'barman', name: 'Рэй, бармен', nameEn: 'RAY', poses: { idle: 'bartender_idle', talk: 'bartender_talk' } },
  doctor: { id: 'doctor', name: 'Доктор Нгуен', nameEn: 'DR. NGUYEN', poses: { idle: 'medic_m', wave: 'medic_m_wave' }, speed: 1.1 },
  doctor2: { id: 'doctor2', name: 'Доктор Бэйли', nameEn: 'DR. BAILEY', poses: { idle: 'doctor_f', wave: 'doctor_f_wave' }, speed: 1.1 },
  nurse: { id: 'nurse', name: 'Медсестра Грир', nameEn: 'NURSE GREER', portrait: 'nurse', poses: { idle: 'nurse_red', talk: 'nurse_red_wave', wave: 'nurse_red_wave' }, speed: 1.2 },
  nurseNight: { id: 'nurseNight', name: 'Медсестра', nameEn: 'NURSE', poses: { idle: 'nurse_blue', wave: 'nurse_blue_wave' }, speed: 1.05 },
  medic: { id: 'medic', name: 'Фельдшер', nameEn: 'MEDIC', poses: { idle: 'nurse_white', wave: 'nurse_white_wave' }, speed: 1.1 },
  nurse2: { id: 'nurse2', name: 'Медсестра', nameEn: 'NURSE', poses: { idle: 'nurse_white', wave: 'nurse_white_wave' }, speed: 1.15 },
  patient: { id: 'patient', name: 'Пациентка', nameEn: 'PATIENT', poses: { idle: 'patient_old' } },
  bartender: {
    id: 'bartender', name: 'Бармен', nameEn: 'BARTENDER', color: '#8a3030',
    poses: { idle: 'bartender_idle', talk: 'bartender_talk' },
  },
  waiter2: { id: 'waiter2', name: 'Официант', poses: { idle: 'waiter2' }, speed: 1.1 },
  patronA: { id: 'patronA', name: 'Посетитель', poses: { idle: 'patron_a' }, speed: 1.1, selfLight: 0x5a4c48 },
  patronB: { id: 'patronB', name: 'Посетитель', poses: { idle: 'patron_b', talk: 'patron_b_talk' }, selfLight: 0x5a4c48 },
  woman: { id: 'woman', name: 'Посетительница', poses: { idle: 'woman' }, selfLight: 0x5a4c48 },
};
