/**
 * Case files (CaseFiles UI, InvestigationSequence). Two folders on the board:
 *   WEREWOLF — «Лесной фауницид»: the carcasses in the valley, Lizzie's disappearance
 *   VAMPIRE  — «Массовое убийство в „Северной розе“» (branch in development)
 * Evidence `req` = flag that must be set before the item shows in the folder.
 */

// RCMP list of the dead, Saturday 4 December (pinned next to Lizzie's poster)
export const VICTIMS = [
  { name: 'Кайден Альварес', age: 32, where: 'столик у стойки' },
  { name: 'Кристиан Кокс', age: 41, where: 'барная стойка, табурет №2' },
  { name: 'Агата Росс', age: 27, where: 'у окна' },
  { name: 'Беатрис Уотсон', age: 58, where: 'в глубине зала' },
  { name: 'Женевьева Морель', age: 34, where: 'у музыкального автомата' },
  { name: 'Гордон Финч', age: 61, where: 'у входа (метрдотель)' },
  { name: 'Уэйд Маккензи', age: 38, where: 'барная стойка' },
  { name: 'Лоренс Бирн', age: 45, where: 'в глубине зала' },
  { name: 'Харриет Дюбуа', age: 63, where: 'столик у окна' },
  { name: 'Сэмюэл Тёрнер', age: 50, where: 'центральный столик' },
  { name: 'Нора Линдквист', age: 24, where: 'диван у галереи' },
];

export const CASES = {
  WEREWOLF: {
    id: 'WEREWOLF',
    tab: 'Лесной фауницид',
    title: 'Лесной фауницид',
    en: 'THE FOREST FAUNICIDE',
    no: 'ДЕЛО № 0417-ФН',
    status: 'закрыто кап. Морроу · «нападение волков»',
    summary: 'Долина реки Такхини, 40 км к северу от Уайтхорса. Двадцать три туши: олени, лоси, медведь. Не съедены — разорваны. Борозды на коре на высоте двух метров. 11 ноября там же пропала Элизабет Рид.',
    personal: 'Лиззи. Моя сестра. Тридцать дней.',
    evidence: [
      { id: 'carcasses', title: 'Фото: туши у реки', text: 'Двадцать три животных на одном пятачке. Ни одно не съедено. Как будто кто-то убивал не от голода.' },
      { id: 'track', title: 'Слепок следа · 19 см', text: 'Передняя лапа. Волчья — по форме. По размеру — нет. Криминалист приписал: «вероятно, деформация в оттаявшем грунте».' },
      { id: 'bark', title: 'Кора с бороздами', text: 'Четыре параллельные борозды на высоте 2,1 м. Сверху вниз. Так не царапает зверь, стоящий на четырёх лапах.' },
      { id: 'fur', title: 'Шерсть с проволоки', text: 'Тёмная, жёсткая, с серебром. Лаборатория: «семейство псовых». Дальше никто не проверял.' },
      { id: 'phone', title: 'Телефон Э. Рид', text: 'Найден 12 ноября в сорока метрах от реки, под снегом. Экран треснул. Батарея села. Вещдок № 11.', phone: true },
      { id: 'tourists', title: 'Туристы у каньона Майлс', text: 'Четверо. Палатка разорвана изнутри наружу. Те же борозды. В отчёте снова «волки».', req: 'tourists_news' },
      { id: 'beast', title: 'Записи: то, что я видел', text: 'Волк. Размером с лошадь. Он ел — не как голодный зверь, а как человек, который давно не ел. А потом встал. И стал человеком.', req: 'saw_transform' },
    ],
    tasks: [
      { text: 'Место пропажи Лиззи — долина у реки', done: 'forest_visited' },
      { text: 'Просмотреть улики в папке', done: 'saw_lizzy_phone' },
      { text: 'Сопоставить следы: слепок, борозды, кости', done: 'fo_analysis_done', req: ['fo_claws', 'fo_bones'], action: 'analysis' },
      { text: 'Найти, кто это делает', done: 'saw_transform', req: 'tourists_news' },
      { text: 'Проследить за ним', done: 'found_cave', req: 'saw_transform' },
    ],
  },
  VAMPIRE: {
    id: 'VAMPIRE',
    tab: 'Массовое убийство',
    title: 'Массовое убийство в «Северной розе»',
    en: 'THE NORTHERN ROSE MASSACRE',
    no: 'ДЕЛО № 1204-УБ',
    status: 'ведёт дет. Ковальски',
    summary: 'Одиннадцать погибших. Острая кровопотеря у всех. Крови на месте — нет. Один выживший гость: детектив Дж. Рид.',
    personal: 'Я был там. И ничего не помню.',
    wip: true,
  },
};

// what Lizzie's phone shows once it is charged in the folder (evidence #11)
export const LIZZY_PHONE = {
  time: '23:47',
  date: 'четверг, 11 ноября',
  items: [
    { who: 'Джул', text: 'Лиз, я на вызове. Перезвоню утром.', t: '21:02' },
    { who: 'Черновик · Джул', text: 'оно стоит на двух ногах. джул оно стоит', t: '23:41', draft: true },
    { who: 'Камера', text: 'Последний снимок: два огонька между деревьями — на высоте человеческого роста.', t: '23:44', photo: true },
    { who: 'Исходящий · Джул', text: 'Вызов не отвечен · 0:00', t: '23:45', missed: true },
  ],
};
