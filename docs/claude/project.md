# О проекте

**Blood of the North** — браузерная narrative-adventure / визуальная новелла. Пролог-демо.
3D-окружение (three.js) + 2D пиксельные персонажи с глубиной, боковая камера, исследование,
диалоги в режиме VN с портретами, катсцены через «режиссёра». Статический сайт без сборки:
`index.html` + ES-модули, three.js лежит в `vendor/`.

- Сайт: https://monskov1-gif.github.io/Blood-of-the-North/
- Репозиторий: `monskov1-gif/Blood-of-the-North`
- Рабочая ветка разработки задаётся сессией; сайт собирается с ветки `claude/admiring-turing-t5ns0m`
  (см. `release.md`).
- Версия: `src/version.js` (на момент написания — 0.11).

## Сюжет и этапы (stage)

Герой — **Джулиан** (пальто, красный шарф; в больнице — халат). Место — Уайтхорс, Юкон, поздняя осень.

1. **Бар «Северная Роза»** (`BarScene`, `BarStory`, `data/dialogue/bar.js`): `explore` → разговоры
   (Кайден — друг, Оуэн, официант) → коктейль от незнакомца → галлюцинации (6 фаз, `fx/Hallucination.js`)
   → побег/обморок (`escape`).
2. **Утро** (`BarMorning.js`, `MorningSequence.js`, `data/dialogue/morning.js`): тот же бар — место
   массового убийства, тело Кайдена (проколы на шее), вспышка памяти, приезд полиции.
3. **Задержание** (`CustodySequence.js`, `data/dialogue/custody.js`), этапы `CUSTODY_STAGES`:
   - `car` — полицейская машина в разрезе, за рулём офицер Куинн Торрес (`PoliceCarScene`).
   - `station` — участок: камера, выжившие (Ноа, Лео, шеф Ларош, посудомойщик Томми), стенды.
   - `interrogation` — допросная, офицер Уайатт (`InterrogationScene`).
   - `medical` — осмотр, кровь.
   - `hospital_day` — палата 109, медсестра Грир, доктора Нгуен и Бэйли у поста (их подслушать),
     в 107 — бабушка (пульс 72). Свободная прогулка по этажу, включая расширение (крыло пациентов,
     старое крыло, операционная).
   - `hospital_evening` — детектив Мэтт Ковальски.
   - `hospital_night` — остановка сердца Джулиана: пульса после смерти нет (монитор «ноль»,
     медсестра думает, что сломан аппарат), жажда, палата 107 и пакет с кровью.
   - `hospital_return`, `recovery` — выздоровление и выписка (монитор так и не ожил).
   - `street` — улица у больницы (поздняя осень, первый снег) → `ended`.

Сохранения: `SaveSystem`, слот хранит `stage`; загрузка этапа custody запускает свежую сессию сцены.
Тестовые скриншоты стартуют любой этап через `localStorage` (`tools/shots/at.mjs`).

## Персонажи (`data/characters.js`)

julian (наряды `coat` / `gown`), kayden, waiter, owen, officer/officer2, quinn (+ driver — она же за
рулём), radio, sergeant (Пелли), interrogator (Уайатт), investigator (Ковальски), survivorWaiter, chef,
dishwasher, barman, doctor (Нгуен), doctor2 (Бэйли), nurse (Грир), nurseNight, medic/nurse2, patient
(бабушка из 107), bartender, patronA/B, woman. Портреты — `assets/portraits/<id>_0|1|2.webp`.
Позы → кадры атласа: `poses: { idle, talk, walk, side, sit, … }`, лёжа — `lie`.

## Карта кода

| Где | Что |
|---|---|
| `src/core/Game.js` | композиция, главный цикл, `setLocation`, onStep (шаги + эхо), WindowLight |
| `src/render/Renderer.js` | пост-обработка; `setLayer(name, {exposure, bloom, tint…})` — аддитивные слои |
| `src/render/textures.js` | процедурные canvas-текстуры, `streetTexture(time, view)` — виды из окон, `autumnTree`, `pixelate` |
| `src/camera/CameraSystem.js` | боковая камера, `setShot`/`snap`, `minWidth` |
| `src/world/LocationBase.js` | база сцен: `box/plane/wall/pool/textSign/bed/ivStand`, мониторы, `initSafeZones` |
| `src/world/SafeZones.js` | Narrative Safe Zones: передний план гаснет, если закрывает важное |
| `src/world/scenes/*` | Bar, BarMorning, Street, PoliceCar, Station, Interrogation, Hospital (+ HospitalExpansion) |
| `src/fx/WindowLight.js` | свет окон (экспозиция/bloom по расстоянию) + блик объектива (2D-оверлей) |
| `src/fx/Hallucination.js` | 6 фаз отравления |
| `src/characters/Character2D.js` | спрайт в 3D, позы, ходьба (6 шагов), лёжа/падение, `PX` = 1 см |
| `src/story/*` | BarStory (+ установка Custody/Morning), Director (команды `cmd`) |
| `src/audio/*` | AudioManager (шины, loop/play), MusicEngine (темы по `STAGE_MUSIC`), sounds.js (процедурные) |
| `data/dialogue/*` | весь текст: `speaker, text, expr, pose, if/set, choices, cmd, checkpoint` |
| `tools/*` | арт-пайплайн: `process_art*.py` (листы → спрайты/портреты), `build_sprites.py` (атлас) |
| `tools/shots/*` | скриншот-скрипты Playwright для проверки и критиков |

## Состояние (v0.09) и открытые задачи

Сделано в 0.09: расширение больницы (крыло пациентов, старое крыло, операционная, шторки, NPC днём,
звуковые зоны), свет окон A/B/C/D + блик по референсу, полицейская машина как седан в разрезе,
поздняя осень (виды из окон, улица), исправление затухания переднего плана.

Оценки критиков на 0.09: больница день 7, ночь 7, блик vs референс 7, окна в игре 6, машина 6,
виды из окон 7, улица 6.

Бэклог (можно взять, если владелец не дал новых задач):
- Машина: виден срез кузова (толщина двери/крыши), решётка от пола до потолка с сеткой,
  сиденье Джулиана со спинкой и подушкой, стёкла с огнями улицы в верхней части кузова.
- Улица: тонкие снежные корки вместо «подушек», полная берёза в кадре, низкий тёплый боковой
  утренний свет, менее синяя плитка.
- Виды из окон: тонкий снег на земле/дорогах, тёплая полоса низкого солнца, машины меньше на ward109.
- UI: контраст субтитров и имени, подсказка «E / Пробел» на тач-устройствах.
- Окна в игре: хотспот за переплётами, чуть подсветить стены рядом с окнами.
