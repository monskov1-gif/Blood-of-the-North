/**
 * Lines for the extended demo: bartender, police car, station, interrogation,
 * medical exam, hospital (day / evening / night), recovery, discharge.
 * Same node format as bar.js. Short scripted beats that need precise timing
 * are plain arrays of [speaker, text, pose?] played by CustodySequence.js.
 */
export const DIALOGUES = {
  // ------------------------------------------------------------ the bartender (scripted beat)
  m_bartender_lines: [
    ['barman', 'Не стреляйте! Не надо! Это я, Рэй… бармен!', 'talk'],
    ['julian', 'Тише, Рэй. Это я. Рид.'],
    ['barman', 'Детектив… Господи. Вы живой. Я думал — все.'],
    ['julian', 'Что здесь было?'],
    ['barman', 'Я не видел. Только слышал. Сначала закричали у окна. Потом — все сразу.'],
    ['barman', 'Стулья, стекло… и звук такой, будто кто-то один — но везде одновременно.'],
    ['barman', 'Я лёг под стойку и не вставал. До утра. Потом стало тихо. Слишком тихо.', 'idle'],
    ['julian', 'Ты видел, кто это был?'],
    ['barman', 'Тень. Быструю. Я не смотрел, детектив. Я не хотел смотреть.'],
  ],

  // ------------------------------------------------------------ police car
  car_intro: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Наручники натирают запястья. Заднее сиденье, решётка, запах дешёвого освежителя.' },
      b: { speaker: 'thought', text: 'За окном Уайтхорс. Как будто ничего не случилось.', set: { objective: 'car' } },
    },
  },
  car_window: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Пустые тротуары. Закусочная на Мэйн-стрит — мы с Кайденом завтракали там по пятницам.' },
      b: { speaker: 'thought', text: 'Кайден.', set: { car_window: true } },
    },
  },
  car_cuffs: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Сталь. Холодная. На пальцах — что-то бурое, засохшее.' },
      b: { speaker: 'thought', text: 'Я не помню, откуда это.', set: { car_cuffs: true } },
    },
  },
  car_cage: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Решётка между мной и водителем. Сколько раз я сам сажал сюда людей.', set: { car_cage: true } },
    },
  },
  car_radio: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'radio', text: '…всем постам. «Северная Роза», Эндрю-стрит. Подтверждено одиннадцать… повторяю, один-один…', cmd: 'sfx:sfx.tv' },
      b: { speaker: 'narrator', text: 'Куинн убавляет звук. Слишком поздно.', set: { car_radio: true } },
    },
  },
  car_talk: {
    mode: 'vn',
    bg: 'car',
    cast: { left: 'julian', right: 'driver' },
    nodes: {
      a: { speaker: 'driver', text: 'Джул. Ты как?', expr: { driver: 'concerned', julian: 'tired' } },
      b: { speaker: 'julian', text: 'Куинн?.. Это ты за рулём?', expr: { julian: 'tired' } },
      c: { speaker: 'driver', text: 'Я. Сама попросилась. Не хотела, чтобы тебя вёз кто-то, кто тебя не знает.', expr: { driver: 'talk' } },
      d: { speaker: 'driver', text: 'Там одиннадцать человек, Джул. Одиннадцать. А ты сидишь тут живой — и я не знаю, радоваться мне или бояться.', expr: { driver: 'sad' } },
      e: {
        speaker: 'driver', text: 'Скажи мне хоть что-нибудь. Что ты видел?', expr: { driver: 'concerned' },
        choices: [
          { text: '«Я ничего не помню».', next: 'f1' },
          { text: '«Был мужчина в чёрном…»', next: 'f2', set: { told_about_owen: true } },
        ],
      },
      f1: { speaker: 'julian', text: 'Ничего. Бар, Кайден, разговор… потом пол. И утро.', expr: { julian: 'sad' }, next: 'g' },
      f2: { speaker: 'julian', text: 'Мужчина в чёрном. Прислал мне коктейль. Лица не помню. Дальше — пусто.', expr: { julian: 'serious' } },
      f2b: { speaker: 'driver', text: 'Расскажешь это в участке. Слово в слово. Ладно?', expr: { driver: 'talk' } },
      g: { speaker: 'driver', text: 'Кайден… Мне так жаль, Джул.', expr: { driver: 'sad' } },
      h: { speaker: 'julian', text: 'Горло сухое… будто песка наелся. Есть вода?', expr: { julian: 'tired' } },
      i: {
        speaker: 'driver', text: 'Держи. Из кулера в участке — я всегда беру с собой.', cmd: 'bottle', expr: { driver: 'neutral' },
        choices: [
          { text: 'Выпить.', next: 'w1' },
          { text: 'Не сейчас.', next: 'n1' },
        ],
      },
      w1: { speaker: 'narrator', text: '', cmd: 'spitWater', skipEmpty: true },
      w2: { speaker: 'julian', text: 'Чёрт… прости. Она… на вкус как ржавчина. Как болотная.', expr: { julian: 'pain' } },
      w3: { speaker: 'driver', text: 'Обычная вода, Джул. Я сама её пила.', expr: { driver: 'concerned' } },
      w4: { speaker: 'narrator', text: 'Куинн вытирает рукав и отворачивается к дороге. До самого участка она больше не произносит ни слова.', set: { water_rejected_car: true }, end: true },
      n1: { speaker: 'julian', text: 'Потом.', expr: { julian: 'tired' } },
      n2: { speaker: 'driver', text: 'Как скажешь. Только не молчи так, ладно? Ты меня пугаешь.', expr: { driver: 'sad' } },
      n3: { speaker: 'narrator', text: 'Остаток пути — дворники и молчание.', end: true },
    },
  },

  // ------------------------------------------------------------ police station
  st_cell: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Камера номер один. Я сам сажал сюда пьяных по субботам.' },
      b: { speaker: 'thought', text: 'Скамья, унитаз, лампа за решёткой. И время, которое не идёт.', set: { objective: 'cell' } },
    },
  },
  st_release: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'sergeant', text: 'Рид. Давайте руки.', cmd: 'sfx:sfx.cuffs' },
      b: { speaker: 'sergeant', text: 'Вы не арестованы. Пока вы свидетель. Подождите в зоне ожидания — вас вызовут.' },
      c: { speaker: 'sergeant', text: 'Там остальные. Те, кто… выжил.' },
      d: { speaker: 'narrator', text: 'Сержант мнётся у решётки, будто хочет сказать ещё что-то.' },
      e: { speaker: 'sergeant', text: 'Альварес… Мне жаль, Рид. Он был хорошим копом. Лучше многих тут.' },
      f: { speaker: 'thought', text: 'Сказанное вслух становится правдой. Кайдена нет.' },
      g: { speaker: 'julian', text: '…Спасибо, Пелли.', set: { kayden_condolence: true, objective: 'survivors' } },
    },
  },
  st_board: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: '«Пропала без вести: Элизабет Рид». Лиззи. Плакату три недели.' },
      b: { speaker: 'thought', text: 'Кто-то обвёл дату маркером. Кто-то ещё помнит.', set: { saw_poster: true } },
    },
  },
  st_vending: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Бутилированная вода. Горло просит — и в то же время сводит от одной мысли о ней.', if: 'water_rejected_car' },
      b: { speaker: 'thought', text: 'Автомат с водой. Пить хочется зверски. Но не воды. Чего тогда?', if: '!water_rejected_car' },
    },
  },
  st_offices: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'За жалюзи — мой стол. На нём ещё стоит кружка Кайдена. «Лучший напарник Юкона». Подарок на спор.' },
    },
  },
  st_desk: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'sergeant', text: 'Ждите, Рид. Вас позовут. Кофе в автомате — отрава, но горячая.' },
    },
  },
  st_entrance: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'За стеклом — фургон новостей и двое с камерами. «Резня в “Северной Розе”». К вечеру это будет везде.' },
    },
  },
  st_medpost_wait: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Медпункт. Ставня опущена — закрыто.' } },
  },
  st_door_wait: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Допросная номер два. Ещё не моя очередь.' } },
  },
  st_noah: {
    mode: 'vn',
    bg: 'station',
    cast: { left: 'julian', right: 'survivorWaiter' },
    nodes: {
      a: { speaker: 'survivorWaiter', text: 'Детектив… вы тоже? Я думал, в зале никого не осталось.', expr: { survivorWaiter: 'concerned', julian: 'tired' } },
      b: { speaker: 'julian', text: 'Где ты был, Ноа?' },
      c: { speaker: 'survivorWaiter', text: 'На кухне. Понёс грязные бокалы — и тут крик. Шеф схватил меня за фартук и затолкал в холодильную камеру.', expr: { survivorWaiter: 'talk' } },
      d: { speaker: 'survivorWaiter', text: 'Мы сидели там всю ночь. И слышали, как кто-то ходит по залу. Быстро. Очень быстро.', expr: { survivorWaiter: 'sad' } },
      e: { speaker: 'julian', text: 'Один человек?', expr: { julian: 'serious' } },
      f: {
        speaker: 'survivorWaiter', text: 'Не знаю. Звучало как один. Но так же не бывает… правда?', expr: { survivorWaiter: 'concerned' },
        choices: [
          { text: '«Мужчина в чёрном — ты его видел?»', next: 'g1' },
          { text: '«Спасибо, Ноа. Держись».', next: 'h' },
        ],
      },
      g1: { speaker: 'survivorWaiter', text: 'Тот, что прислал вам коктейль? Платил наличными. Оставил чаевых больше, чем сам счёт.', expr: { survivorWaiter: 'talk' } },
      g2: { speaker: 'survivorWaiter', text: 'И всё время улыбался. Как будто знал что-то смешное, чего не знаем мы.', set: { noah_owen: true } },
      h: { speaker: 'julian', text: 'Спасибо. Держись.', set: { talked_noah: true }, end: true },
    },
  },
  st_leo: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'barman', text: 'Детектив… Нас всех сюда привезли. Меня — прямо из-под стойки, в одном фартуке.' },
      b: { speaker: 'barman', text: 'Я им всё рассказал. Что и вам утром. Крики, стекло — и тень. Больше ничего.' },
      c: { speaker: 'barman', text: 'А руки до сих пор трясутся. Смешно, да? Двенадцать лет за стойкой.', set: { talked_leo: true } },
    },
  },
  st_chef: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'chef', text: 'Двадцать лет на кухне, детектив. Я знаю, как звучит, когда режут мясо.' },
      b: { speaker: 'chef', text: 'Это звучало иначе. И никто не кричал долго. Крики… обрывались.', set: { talked_chef: true } },
    },
  },
  st_tommy: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'dishwasher', text: 'Я выносил мусор и спрятался в контейнере во дворе. Как идиот. Замёрз до костей.' },
      b: { speaker: 'dishwasher', text: 'Потом в окне кухни кто-то стоял. Высокий. Постоял — и ушёл. И снег под ним не скрипел.', set: { talked_tommy: true } },
    },
  },
  st_called: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'sergeant', text: 'Рид! Вы следующий. Сначала в медпункт — анализы. Потом вторая допросная.', cmd: 'medOpen' },
      b: { speaker: 'julian', text: 'Понял. Моя очередь. Сначала анализы — потом допрос.', set: { objective: 'medpost', survivors_questioned: true } },
    },
  },
  st_blood: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'medic', text: 'Рукав. Кулачок. Сейчас будет неприятно.' },
      b: { speaker: 'thought', text: 'Игла входит в вену. Кровь в пробирке тёмная, почти чёрная.' },
      c: { speaker: 'medic', text: 'Хм. Сворачивается медленно… Ладно, лаборатория разберётся.' },
      d: { speaker: 'medic', text: 'Прижмите ватку. Вас ждут во второй допросной.', set: { objective: 'interrogation', blood_test: true } },
    },
  },

  // ------------------------------------------------------------ interrogation room
  ir_enter: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'interrogator', text: 'Проходите, детектив. Садитесь.' },
      b: { speaker: 'thought', text: 'Его я не знаю. Не из нашего отдела. Седина, спокойные руки — такие не торопятся.', set: { objective: 'sit' } },
    },
  },
  ir_mirror: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Зеркало. Я годами стоял по ту сторону — и смотрел, как люди врут.', cmd: 'observed' },
      b: { speaker: 'thought', text: 'Сейчас там двое. Может, трое. Смотрят на меня.' },
      c: { speaker: 'thought', text: 'Моё отражение какое-то… бледное. Тусклое. Свет здесь отвратительный.', set: { looked_mirror_interrogation: true } },
    },
  },
  ir_camera: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Красный огонёк. Пишет каждое слово.' } },
  },
  ir_clock: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Без двадцати десять. Или десять. Стрелки плывут.' } },
  },
  ir_door: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Заперто снаружи. Конечно.' } },
  },
  ir_jug: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Графин с водой. Горло сжимается при одном взгляде.' } },
  },
  ir_talk: {
    mode: 'vn',
    bg: 'interrogation',
    cast: { left: 'julian', right: 'interrogator' },
    nodes: {
      a: { speaker: 'interrogator', text: 'Запись идёт. Назовите себя.', checkpoint: true, set: { interrogation_started: true }, expr: { interrogator: 'neutral', julian: 'tired' } },
      b: { speaker: 'julian', text: 'Джулиан Рид. Детектив, отдел тяжких преступлений.' },
      b2: { speaker: 'julian', text: 'А вы?' },
      b3: { speaker: 'interrogator', text: 'Сегодня вопросы задаю я, детектив.', expr: { interrogator: 'talk' } },
      c: { speaker: 'interrogator', text: 'Вчера вечером вы были в баре «Северная Роза» с констеблем Альваресом.', expr: { interrogator: 'neutral' } },
      d: {
        speaker: 'interrogator', text: 'Что вы пили?', expr: { interrogator: 'talk' },
        choices: [
          { text: '«Виски. Потом коктейль — его прислали».', next: 'e1' },
          { text: '«Не помню».', next: 'e2' },
        ],
      },
      e1: { speaker: 'interrogator', text: 'Кто прислал?' },
      e1b: { speaker: 'julian', text: 'Мужчина за дальним столиком. Я его не знаю.', next: 'f' },
      e2: { speaker: 'interrogator', text: 'Свидетели говорят — виски. И коктейль от незнакомца.' },
      f: { speaker: 'julian', text: 'Можно воды? Горло… будто песок.', expr: { julian: 'tired' } },
      g: { speaker: 'interrogator', text: 'Пожалуйста.', cmd: 'waterCup', expr: { interrogator: 'neutral' } },
      h: { speaker: 'thought', text: 'Пью. Ещё. Горло мокрое, а жажда та же. Будто пью воздух.', set: { water_rejected_interrogation: true } },
      i: { speaker: 'interrogator', text: 'Что было после коктейля?', expr: { interrogator: 'talk' } },
      j: { speaker: 'julian', text: 'Стало плохо. Жарко. Я пошёл к двери… дальше ничего.', expr: { julian: 'sad' } },
      k: {
        speaker: 'interrogator', text: 'Вы проснулись среди одиннадцати тел. Без единой царапины. И ничего не помните.', expr: { interrogator: 'concerned' },
        choices: [
          { text: '«Я не вру».', next: 'l1' },
          { text: '«Думаете, это я?»', next: 'l2' },
        ],
      },
      l1: { speaker: 'julian', text: 'Я не вру. Хотел бы врать — тогда хоть что-то знал бы.', expr: { julian: 'serious' }, next: 'm' },
      l2: { speaker: 'julian', text: 'Думаете, это сделал я?', expr: { julian: 'serious' } },
      l2b: { speaker: 'interrogator', text: 'Я думаю, что одиннадцать человек мертвы. А вы — нет.', expr: { interrogator: 'neutral' } },
      m: { speaker: 'interrogator', text: 'Альварес был вашим напарником. Вы сидели за одним столом. Его нашли в метре от вас…', cmd: 'phase:3', expr: { interrogator: 'talk' } },
      n: { speaker: 'thought', text: 'Его голос уплывает. Лампа слишком яркая. Сердце бьётся неровно — с провалами.', distort: 0.3, expr: { julian: 'dizzy' } },
      o: { speaker: 'julian', text: 'Мне… нужно встать.', distort: 0.2, expr: { julian: 'dizzy' }, end: true },
    },
  },

  // ------------------------------------------------------------ medical exam (scripted beats)
  med_lines: [
    ['doctor', 'Мистер Рид, следите за светом. Не головой — глазами.'],
    ['thought', 'Свет режет. Слишком ярко. Всё вокруг — слишком ярко.'],
    ['doctor', 'Зрачки реагируют вяло. Тремор. Координация нарушена.'],
    ['doctor2', 'Повторите три слова, которые я назвал минуту назад.'],
    ['julian', '…Река. Лампа. Зима?'],
    ['doctor2', 'Хорошо. А что вы ели вчера на ужин?'],
    ['julian', 'Я… не помню.'],
    ['doctor2', 'Он не симулирует. Провалы настоящие — такое не сыграешь.'],
    ['doctor', 'Токсикология: диссоциативы. Высокая доза. Вместе с алкоголем.'],
    ['doctor', 'Мистер Рид, вас отравили. Мы вас госпитализируем. Прямо сейчас.'],
  ],

  // ------------------------------------------------------------ hospital, day
  h_wake: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Палата 109. Капельница. Монитор пищит в такт — это мой пульс. Медленный.' },
      b: { speaker: 'thought', text: 'Лежать невыносимо. Хотя бы пройтись.', set: { hospital_entered: true, objective: 'hospital' } },
    },
  },
  h_window: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Двор больницы. Сугробы по пояс. Где-то за ними — река.' } } },
  h_cooler: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Кулер. Стаканчик, второй, третий. Живот полон. Горло — сухое.', cmd: 'sfx:sfx.water' },
    },
  },
  h_reception: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Регистратура. На стойке — свежая газета: «Резня в “Северной Розе”: одиннадцать погибших. Детектив очнулся среди тел; персонал уцелел, спрятавшись».' } } },
  h_elevator: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Лифт. Внизу — выход. Меня не выпустят в больничной пижаме и с капельницей в руке.' } } },
  h_stairs: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Лестница. Пахнет хлоркой и холодом.' } } },
  h_procedure: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Процедурная. Здесь мне светили фонариком в глаза. Свет до сих пор плавает пятнами.' } } },
  h_side: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Хирургия. Двери закрыты. Только гул ламп.' } } },
  h_station: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Пост медсестры. График дежурств, кружки, журнал назначений. Моя фамилия обведена красным.' } } },
  h_wardB_day: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Палата 107. Пожилая женщина. Кома, судя по аппаратам.' },
      b: { speaker: 'thought', text: 'Над кроватью висит пакет с кровью. Тёмный. Я почему-то не могу отвести взгляд.', set: { blood_bag_seen: true } },
    },
  },
  h_doctors: [
    ['doctor', '…с такой дозой и алкоголем не выживают. Сердце, печень — всё на пределе.'],
    ['doctor2', 'Родственники есть?'],
    ['doctor', 'Сестра. Пропала без вести, три недели назад.'],
    ['doctor2', 'Господи.'],
    ['doctor', 'Если доживёт до утра — уже чудо. Я бы не рассчитывал.'],
    ['thought', 'Они говорят обо мне.'],
  ],
  h_bed_wait: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Кровать. Лягу — когда не смогу больше стоять.' } } },

  // ------------------------------------------------------------ evening: the investigator
  h_investigator: {
    mode: 'vn',
    bg: 'ward',
    cast: { left: 'julian', right: 'quinn' },
    nodes: {
      a: { speaker: 'quinn', text: 'Привет, Джул. Не вставай.', expr: { quinn: 'neutral', julian: 'tired' } },
      b: { speaker: 'julian', text: 'Куинн.' },
      c: { speaker: 'quinn', text: 'В участке сегодня помянули Кайдена. Скромно. Кофе, пончики. Его кружку поставили на стол — кто-то положил туда жетон.', expr: { quinn: 'sad' } },
      d: { speaker: 'quinn', text: 'Все спрашивали про тебя. Все за тебя, понимаешь? Пережить такое…', expr: { quinn: 'talk' } },
      e: { speaker: 'julian', text: 'Я был там, Куинн. Прямо там. И ничего не помню.', expr: { julian: 'sad' } },
      f: { speaker: 'quinn', text: 'Знаю. Врачи сказали. Диссоциативы с выпивкой — от такого не просыпаются. А ты проснулся.', expr: { quinn: 'concerned' } },
      g: { speaker: 'quinn', text: 'Я пришла сказать сама, пока не сказал кто-нибудь другой: обвинение с тебя сняли. Ты больше не подозреваемый, Джул. Ты жертва.', expr: { quinn: 'talk' } },
      g2: { speaker: 'julian', text: 'Спасибо, что пришла.', expr: { julian: 'tired' } },
      g3: { speaker: 'quinn', text: 'Ну а кто ещё, если не я?.. Ладно. Забудь.', expr: { quinn: 'sad' } },
      h: {
        speaker: 'quinn', text: 'Расследованием займёмся мы. Ты — лежи. Спи. Это приказ.', expr: { quinn: 'neutral' },
        choices: [
          { text: '«Найди его, Куинн».', next: 'i1' },
          { text: '«Держи меня в курсе».', next: 'i2' },
        ],
      },
      i1: { speaker: 'quinn', text: 'Найдём. Обещаю.', expr: { quinn: 'talk' }, next: 'j' },
      i2: { speaker: 'quinn', text: 'Если будешь спать — буду.', expr: { quinn: 'talk' } },
      j: { speaker: 'thought', text: 'Спать. Как будто это так просто.', set: { charges_dropped: true } },
    },
  },

  // ------------------------------------------------------------ night
  n_wake: [
    ['thought', 'ПИТЬ.'],
    ['thought', 'Горло горит. Руки дрожат. Всё тело — одна сухая трещина.'],
  ],
  n_sink: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Вода. Глоток, ещё, ещё — прямо из-под крана.', cmd: 'drinkWater' },
      b: { speaker: 'thought', text: 'Живот полон. Жажда — та же. Это не вода. Мне нужно что-то другое.', set: { night_water: true, objective: 'night' } },
    },
  },
  n_cooler: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Кулер. Нет. Вода не поможет. Я это уже знаю.' } },
  },
  n_station: {
    mode: 'bark',
    nodes: { a: { speaker: 'thought', text: 'Пост пуст. Лампа горит, чай остывает. Медсестры нет.' } },
  },
  n_elevator: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Лифт стоит на первом. Гудит. Нет — не туда.' } } },
  n_ward_voice: [
    ['nurseNight', 'Я на десять минут, покурить. Лежите смирно, миссис Холт. Никуда не уходите.'],
    ['thought', 'Она не видит меня.'],
  ],
  n_patient: [
    ['thought', 'Пожилая женщина. Дышит ровно. Пульс на мониторе ровный — семьдесят два.'],
    ['thought', 'Пакет над кроватью. Тёмно-красный. Он будто светится — или это у меня в глазах?'],
    ['thought', 'Её шея. Тонкая кожа. Я слышу пульс. Слышу, как течёт кровь — по трубке, по ней.'],
    ['julian', 'Нет…'],
  ],
  n_after: [
    ['thought', '…'],
    ['thought', 'Жажда ушла. Голова ясная. Ноги твёрдые. Мне хорошо — так хорошо, как не было никогда.'],
    ['thought', 'Пустой пакет у меня в руке. Красное на пальцах.'],
    ['julian', 'Что я сделал?'],
    ['thought', 'Что со мной?'],
  ],
  n_return_hint: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Назад. В палату. Пока никто не увидел.', set: { objective: 'back' } } } },
  n_nurse_vn: {
    mode: 'vn',
    bg: 'ward',
    cast: { left: 'julian', right: 'nurse' },
    nodes: {
      a: { speaker: 'nurse', text: 'Мистер Рид! Господи… Монитор показал остановку, я думала, вы…', expr: { nurse: 'concerned', julian: 'tired' } },
      b: { speaker: 'nurse', text: 'Опять датчик отвалился. Двадцать лет работаю — и каждый раз сердце в пятки.', expr: { nurse: 'talk' } },
      c: { speaker: 'nurse', text: 'Так. Капельница, датчики… Вы что, сами всё сорвали?', cmd: 'reattach', expr: { nurse: 'neutral' } },
      d: { speaker: 'julian', text: 'Мне… приснилось что-то.', expr: { julian: 'tired' } },
      e: { speaker: 'nurse', text: 'Лежите. И никуда не вставайте, слышите? Никуда.', expr: { nurse: 'talk' } },
      f: { speaker: 'julian', text: 'Слышу.', end: true },
    },
  },
  n_nurse: [
    ['nurse', 'Мистер Рид! Господи… Монитор показал остановку, я думала, вы…'],
    ['nurse', 'Опять датчик отвалился. Двадцать лет работаю — и каждый раз сердце в пятки.'],
    ['nurse', 'Так. Капельница, датчики… Вы что, сами всё сорвали?'],
    ['julian', 'Мне… приснилось что-то.'],
    ['nurse', 'Лежите. И никуда не вставайте, слышите? Никуда.'],
    ['julian', 'Слышу.'],
  ],

  // ------------------------------------------------------------ recovery montage + discharge
  recovery: [
    ['card', 'День второй'],
    ['doctor', 'Показатели стабилизировались. Не понимаю как, но стабилизировались.'],
    ['card', 'День третий'],
    ['nurse', 'Вы ходите быстрее меня, детектив. И аппетит, говорят, вернулся.'],
    ['julian', 'Аппетит… да. Вроде того.'],
    ['card', 'День пятый'],
    ['doctor', 'С такой дозой не выживают, мистер Рид. Мне нечем объяснить ваши анализы. Можете называть это чудом.'],
    ['doctor2', 'Выписываем. Без алкоголя. И — без коктейлей от незнакомцев.'],
  ],
  street: [
    ['thought', 'Уайтхорс. Минус двадцать восемь.'],
    ['thought', 'Я не чувствую холода.'],
  ],
};
