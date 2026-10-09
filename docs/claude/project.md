# О проекте

**Blood of the North** — браузерная narrative-adventure / визуальная новелла. Пролог-демо.
3D-окружение (three.js) + 2D пиксельные персонажи с глубиной, боковая камера, исследование,
диалоги в режиме VN с портретами, катсцены через «режиссёра». Статический сайт без сборки:
`index.html` + ES-модули, three.js лежит в `vendor/`.

- Сайт: https://monskov1-gif.github.io/Blood-of-the-North/
- Репозиторий: `monskov1-gif/Blood-of-the-North`
- Рабочая ветка разработки задаётся сессией; сайт собирается с ветки `claude/admiring-turing-t5ns0m`
  (см. `release.md`).
- Версия: `src/version.js` (на момент написания — 0.13).

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
   - `street` — улица у больницы (поздняя осень, первый снег) → `station_return`.
4. **Расследование** (`InvestigationSequence.js`, `data/dialogue/investigation.js`, `data/cases.js`,
   `INVESTIGATION_STAGES`):
   - `station_return` — участок через неделю: список погибших в «Северной розе» на доске (11 имён, среди
     них Кристиан Кокс = Крис из бара, Агата Росс, Беатрис Уотсон, Женевьева Морель), Куинн, детектив
     Ковальски предлагает участвовать → меню папок (`src/ui/CaseFiles.js`, `css/cases.css`, по
     референсу `docs/claude/case_menu_reference.jpg`). Флаг `investigation_route`: `WEREWOLF` (лесной фауницид)
     или `VAMPIRE` (Джулиановы главы 8/10 — заглушки, но маршрут ведёт к L5 и гибели Лиззи). После выбора — кнопка папки в HUD (J):
     дело, улики (телефон Лиззи — вещдок № 11, флаг `saw_lizzy_phone`), задачи, жертвы.
   - `forest` — долина Такхини днём (`ForestScene`, состояние `day`): оцепление, маркеры, осина с
     когтями, маркер 11. После осмотра — звонок Куинн о туристах у каньона Майлс, радио (`tourists_news`).
   - `forest_night` — сумерки (состояние `night`): волк ест у реки → превращается в человека
     (`stranger`) → слежка до пещеры (x ≈ 42) → «Продолжение следует» → `ended`.

### Порядок глав (v0.13, утверждён владельцем)

| № | Чья | Глава | stage / где |
|---|---|---|---|
| 01 | Джулиан | Кровавый вечер | `explore`…`escape`, утро, `car` |
| 02 | Лиззи I | След | `lizzie_1`: школа (`SchoolScene`) → три точки в долине (`forest`/`l1`), фото → карта |
| 03 | Джулиан | Подозреваемый | `station` → `interrogation` → `medical` → `hospital_day`/`evening` |
| 04 | Лиззи II | Лес | `lizzie_2`: стадо у реки (`forest`/`l2`), видео нападения, звонок Джулиану, Пуриэль схвачена |
| 05 | Джулиан | Жажда | `hospital_night` → `hospital_return` → `recovery` → `street` |
| 06 | Джулиан | Улики | `station_return`: материалы, свидетели Рэй/Ноа, камеры (`lzui.cctv`), карта нападений (`lzui.map`), выбор папки |
| 07 | Лиззи III | Пещера | `lizzie_3` (`CaveScene`/`l3`): пробуждение, Пуриэль мертва, Боб и правила, неудачный побег |
| 08 | Джулиан | Территория | WEREWOLF: `forest` + «Сопоставить следы» (`fo_analysis`, ошибка → возврат) + маршруты (`fo_routes`); VAMPIRE: карточка-заглушка |
| 09 | Лиззи IV | Стая | `lizzie_4` (`l4`, +19 дней): разговоры со стаей и Бобом, Викки уводят |
| 10 | Джулиан | Волк | WEREWOLF: `forest_night`, наблюдение, `fn_predict` (угадать маршрут), слежка до пещеры; VAMPIRE: заглушка |
| 11 | Лиззи V | Побег | `lizzie_5` (`l5`): ритуал над Оливией, «Беги», погоня по пещере под управлением игрока |
| 12 | Оба | Пересечение | `forest`/`night`: погоня по лесу → WEREWOLF: Джулиан спасает (SAVED) / VAMPIRE: гибель (DEAD) → `ended` |

Код Лиззи: `src/story/LizzieSequence.js` (`playLizzie(n)`, `lizzieL1..L5`, `lzRunCave`, `lzRunForest`,
финалы), текст `data/dialogue/lizzie.js`, UI `src/ui/LizzieUI.js` + `css/lizzie.css` (фото, REC,
карта, камеры). Лиззи играет тот же персонаж игрока (`setOutfit('lizzy')`), девочки/стая/Боб — `lzCastIn`.
Состояния персонажей и модель оборотней — `data/narrative.js` + `src/story/NarrativeState.js`
(`g.narrative`: `setChar` с проверкой допустимых состояний, `feed`, `tickDays`, `setFate`, `resetL5`).

Флаги: `lizzie_chapter_N_complete` (1–5), `char_<id>` (lizzie/puriel/olivia/vicky/bob/pack),
`puriel_dead`, `vicky_taken`, `olivia_taken`, `olivia_dead`, `lizzie_escape_started`, `lizzie_saved`,
`investigation_route` (`WEREWOLF`/`VAMPIRE`, выбор в гл. 6), `lizzie_fate` (`SAVED`/`DEAD`), `ww_*`.
Синхронизация линий: главы Лиззи вставлены в конец Джулиановых (`carTalk` → L1, вечер → L2,
`afterEvidence` → L3, `touristsCall`/`vampireChain` → L4, `caveEnding`/`vampireChain` → L5), каждая
проверяет свой флаг `_complete`, поэтому загрузка сейва не повторяет главу. Загрузка `lizzie_N` после
главы продолжает Джулиана (`loadLizzie`). QA-хуки: `globalThis.__ts` (ускорение пауз), `__dtMax`.

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

## Состояние (v0.12)

0.12: правки 1–12 владельца (NPC обходят мебель — A* в `Navigation`, шея Джулиана, пакет крови,
эпичная остановка сердца — леттербокс + один долгий наезд, палаты 4×3.6 м, рост официанта, фон меню =
место автосохранения, без двойного зума на iOS, глубина за окнами, бабушка в 113, Крис в баре и утром,
арест крупнее), возвращение в участок, меню папок дел, ветка оборотней до пещеры. Спрайты v0.12:
Лиззи/Викки/Оливия/Пуриэль (портреты + игровые), четыре волка.

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
