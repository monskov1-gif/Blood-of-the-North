/**
 * Character definitions. `poses` map pose names → atlas frames.
 * `portrait` names the procedural portrait painter (src/characters/portraits).
 * `layer` 1 = visible to the main camera only (not to mirrors).
 */
// Julian's outfits: the coat (default) and the hospital gown (admitted → recovery)
export const JULIAN_OUTFITS = {
  coat: { poses: { idle: 'jul_idle', talk: 'jul_talk', think: 'julian_think', drink: 'julian_think' }, lie: 'lie_julian', portrait: 'julian' },
  gown: { poses: { idle: 'julg_idle', talk: 'julg_talk', think: 'julg_idle', drink: 'julg_idle' }, lie: 'lie_julian_gown', portrait: 'julian_gown' },
  // Lizzie's chapters (L1–L5): the player character wears her sprites
  lizzy: { poses: { idle: 'lizzy_idle', talk: 'lizzy_talk', think: 'lizzy_idle', drink: 'lizzy_idle' }, lie: null, portrait: 'julian' },
};

export const CHARACTERS = {
  julian: {
    id: 'julian', name: 'Джулиан Рид', nameEn: 'JULIAN REED', portrait: 'julian', color: '#b5302f',
    poses: { idle: 'jul_idle', talk: 'jul_talk', think: 'julian_think', drink: 'julian_think' },
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
    poses: { idle: 'cop_blond_idle', aim: 'cop_blond_aim' }, speed: 1.6, selfLight: 0xa49a92,
  },
  officer2: {
    id: 'officer2', name: 'Полицейский', nameEn: 'OFFICER', color: '#3a4a7a',
    poses: { idle: 'cop_red_idle', aim: 'cop_red_aim' }, speed: 1.5, selfLight: 0xa49a92,
  },
  // Quinn Nova Torres — constable, Julian's friend (arrest, the drive, the news at the end)
  quinn: {
    id: 'quinn', name: 'Куинн Торрес', nameEn: 'QUINN TORRES', portrait: 'quinn', color: '#5a4a6a',
    poses: { idle: 'quinn_idle', talk: 'quinn_idle', aim: 'quinn_aim', drive: 'quinn_drive', side: 'quinn_side', walk: 'quinn_side' }, speed: 1.5, selfLight: 0xb0a69c,
  },
  radio: { id: 'radio', name: 'Рация', nameEn: 'RADIO', poses: { idle: 'officer_seat' } },
  // --- custody / station / hospital cast
  driver: { id: 'driver', name: 'Куинн Торрес', nameEn: 'QUINN TORRES', portrait: 'quinn', poses: { idle: 'quinn_drive' }, selfLight: 0xa49a92 },
  sergeant: { id: 'sergeant', name: 'Сержант Пелли', nameEn: 'SGT. PELLY', poses: { idle: 'officer_b', walk: 'officer_b' }, speed: 1.3 },
  // Wyatt Nicholas Lewis — Julian doesn't know him; his name is never put on screen
  interrogator: { id: 'interrogator', name: 'Офицер', nameEn: 'OFFICER', portrait: 'wyatt', poses: { idle: 'wyatt_side', sit: 'wyatt_seat' }, speed: 1.4 },
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
  patient: { id: 'patient', name: 'Пациентка', nameEn: 'PATIENT', poses: { idle: 'patient_old' }, lie: 'lie_granny' },
  bartender: {
    id: 'bartender', name: 'Бармен', nameEn: 'BARTENDER', color: '#8a3030',
    poses: { idle: 'bartender_idle', talk: 'bartender_talk' },
  },
  waiter2: { id: 'waiter2', name: 'Официант', poses: { idle: 'waiter2' }, speed: 1.1 },
  patronA: { id: 'patronA', name: 'Посетитель', poses: { idle: 'patron_a' }, speed: 1.1, selfLight: 0x5a4c48 },
  patronB: { id: 'patronB', name: 'Посетитель', poses: { idle: 'patron_b', talk: 'patron_b_talk' }, selfLight: 0x5a4c48 },
  woman: { id: 'woman', name: 'Посетительница', poses: { idle: 'woman' }, selfLight: 0x5a4c48 },
  // Christian Cox — a regular at the bar; he dies in the massacre (his story comes later)
  chris: { id: 'chris', name: 'Крис', nameEn: 'CHRIS', poses: { idle: 'patron_b', talk: 'patron_b_talk' }, selfLight: 0x5a4c48, lie: 'lie_vest' },
  // v0.12 — Lizzie Reed (Julian's sister, 17) and her friends; four huge wolves
  lizzy: { id: 'lizzy', name: 'Лиззи Рид', nameEn: 'LIZZIE REED', portrait: 'lizzy', color: '#8a5a3a', poses: { idle: 'lizzy_idle', talk: 'lizzy_talk' }, speed: 1.35 },
  vikki: { id: 'vikki', name: 'Викки', nameEn: 'VICKY', portrait: 'vikki', color: '#3a3a44', poses: { idle: 'vikki_idle', talk: 'vikki_talk' }, speed: 1.35 },
  olivia: { id: 'olivia', name: 'Оливия', nameEn: 'OLIVIA', portrait: 'olivia', color: '#6a5a4a', poses: { idle: 'olivia_idle', talk: 'olivia_talk' }, speed: 1.35 },
  puriel: { id: 'puriel', name: 'Пуриэль', nameEn: 'PURIEL', portrait: 'puriel', color: '#c8b89a', poses: { idle: 'puriel_idle', talk: 'puriel_talk' }, speed: 1.3 },
  wolf: { id: 'wolf', name: 'Волк', nameEn: 'WOLF', rig: 'dark', poses: { idle: 'wolf_dark', eat: 'wolf_dark_eat' }, speed: 1.6, selfLight: 0x7484a8 },
  wolfGrey: { id: 'wolfGrey', name: 'Волк', nameEn: 'WOLF', rig: 'grey', poses: { idle: 'wolf_grey', eat: 'wolf_grey_eat' }, speed: 1.7, selfLight: 0x7484a8 },
  wolfWhite: { id: 'wolfWhite', name: 'Волк', nameEn: 'WOLF', rig: 'white', poses: { idle: 'wolf_white', eat: 'wolf_white_eat' }, speed: 1.7, selfLight: 0x7484a8 },
  wolfRed: { id: 'wolfRed', name: 'Волк', nameEn: 'WOLF', rig: 'red', poses: { idle: 'wolf_red', eat: 'wolf_red_eat' }, speed: 1.7, selfLight: 0x7484a8 },
  // the pack (L3–L5): in the cave they are always wolves — they speak, but never take a human face there
  bob: { id: 'bob', name: 'Стинко Боб', nameEn: 'STINKO BOB', rig: 'dark', poses: { idle: 'wolf_dark', eat: 'wolf_dark_eat' }, speed: 1.2, scale: 1.1, tint: 0xb4a490, selfLight: 0x6a5a4a },
  packA: { id: 'packA', name: 'Хриплый', nameEn: 'THE HOARSE ONE', rig: 'dark', poses: { idle: 'wolf_dark', eat: 'wolf_dark_eat' }, speed: 1.6, scale: 1.2, selfLight: 0x5a4c40 },
  packB: { id: 'packB', name: 'Молодой', nameEn: 'THE YOUNG ONE', rig: 'grey', poses: { idle: 'wolf_grey', eat: 'wolf_grey_eat' }, speed: 1.8, scale: 0.85, selfLight: 0x6a5a4a },
  packC: { id: 'packC', name: 'Седой', nameEn: 'GREY MUZZLE', rig: 'white', poses: { idle: 'wolf_white', eat: 'wolf_white_eat' }, speed: 1.3, scale: 1.0, tint: 0xc8beb0, selfLight: 0x6a5a4a },
  packD: { id: 'packD', name: 'Марта', nameEn: 'MARTHA', rig: 'grey', poses: { idle: 'wolf_grey', eat: 'wolf_grey_eat' }, speed: 1.6, scale: 1.0, tint: 0xd0b49a, selfLight: 0x6a5a4a },
  packE: { id: 'packE', name: 'Рыжая', nameEn: 'THE RED ONE', rig: 'red', poses: { idle: 'wolf_red', eat: 'wolf_red_eat' }, speed: 1.7, scale: 1.05, selfLight: 0x6a5a4a },
  // Julian as a separate cast member inside Lizzie's chapters (route WEREWOLF)
  julianL: { id: 'julianL', name: 'Джулиан Рид', nameEn: 'JULIAN REED', portrait: 'julian', poses: { idle: 'jul_idle', talk: 'jul_talk', think: 'julian_think' }, speed: 1.55 },
  // v0.14: the school crowd (re-dyed classmates, tools/build_sprites.py)
  stuG0: { id: 'stuG0', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g0_idle' }, speed: 1.35 },
  stuG1: { id: 'stuG1', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g1_idle' }, speed: 1.35 },
  stuG2: { id: 'stuG2', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g2_idle' }, speed: 1.35 },
  stuG3: { id: 'stuG3', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g3_idle' }, speed: 1.35 },
  stuG4: { id: 'stuG4', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g4_idle' }, speed: 1.35 },
  stuG5: { id: 'stuG5', name: 'Ученица', nameEn: 'STUDENT', poses: { idle: 'stu_g5_idle' }, speed: 1.35 },
  stuB0: { id: 'stuB0', name: 'Ученик', nameEn: 'STUDENT', poses: { idle: 'stu_b0' }, speed: 1.4, scale: 0.93 },
  stuB1: { id: 'stuB1', name: 'Ученик', nameEn: 'STUDENT', poses: { idle: 'stu_b1' }, speed: 1.4, scale: 0.97 },
  stuB2: { id: 'stuB2', name: 'Ученик', nameEn: 'STUDENT', poses: { idle: 'stu_b2' }, speed: 1.4, scale: 0.93 },
  stuB3: { id: 'stuB3', name: 'Ученик', nameEn: 'STUDENT', poses: { idle: 'stu_b3' }, speed: 1.4, scale: 0.97 },
  // the werewolf in human form (seen from far away in the forest)
  stranger: { id: 'stranger', name: 'Человек', nameEn: 'MAN', poses: { idle: 'npc_bluecoat_side' }, speed: 1.2, selfLight: 0x5a6680 },
};
