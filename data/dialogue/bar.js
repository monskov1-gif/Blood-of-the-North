/**
 * Dialogue data for the bar scene (demo).
 *
 * Node fields
 *   speaker   julian | kayden | waiter | bartender | owen | thought (Julian's inner voice) | narrator
 *   text      the line
 *   expr      { characterId: expression } — portrait: neutral/smile/serious… or sad/tired/concerned/dizzy/pain (looking down)
 *   pose      { characterId: pose } — 3D sprite pose changes
 *   if        condition string (flags), node is skipped when false
 *   set       { flag: value } applied when the node is shown
 *   cmd       story command (string or array) awaited BEFORE the line is shown
 *   choices   [{ text, next, set, if }]
 *   next      next node id (default: following node in declaration order)
 *   distort   0..1 text corruption (hallucination)
 *   checkpoint  save restarts here
 *   end       true → dialogue ends after this node
 *
 * mode: 'vn' = full dialogue screen (painted background + portraits)
 *       'bark' = short subtitles while exploring
 */

export const DIALOGUES = {
  // ------------------------------------------------------------ exploration barks
  intro: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Минус тридцать четыре. Кайден клялся, что в «Северной Розе» хотя бы тепло.' },
      b: { speaker: 'thought', text: 'Он уже здесь — столик у стойки. Пара минут, чтобы оттаять, и подойду.', set: { objective: 'kayden' } },
    },
  },
  photo: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: '«Northern Rose», 1898-й. Золотая лихорадка: сюда шли за удачей, а уходили — если везло — с целыми пальцами.' },
      b: { speaker: 'julian', text: 'Кто-то очень любит это место. Рамки протирают каждый день.', set: { looked_photo: true } },
    },
  },
  door: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Нет. Я обещал Кайдену хотя бы один вечер без работы. Хотя бы час.' },
    },
  },
  coats: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Парки, пуховики, чья-то шапка с ушами. В Уайтхорсе минус тридцать четыре называют «свежо».' },
    },
  },
  window: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Снег идёт третий день. Где-то там, к северу, долина Юкона.', if: '!seen_window' },
      b: { speaker: 'thought', text: 'Следы, которые я видел у реки, этот снег скоро спрячет. Если уже не спрятал.', if: '!seen_window', set: { seen_window: true } },
      c: { speaker: 'thought', text: 'Фонарь на той стороне мигает. На улице — ни души.', if: 'seen_window_twice' },
      d: { speaker: 'thought', text: 'Пустая улица. Только снег.', if: 'seen_window && !seen_window_twice', set: { seen_window_twice: true } },
    },
  },
  jukebox: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Старый «Вурлитцер». Кто-то до сих пор меняет в нём пластинки.', cmd: 'jukebox' },
      b: { speaker: 'thought', text: 'Медленный свинг. Лиззи сказала бы, что это музыка для пенсионеров. И всё равно потащила бы меня танцевать.', if: '!jukebox_lizzie', set: { jukebox_lizzie: true } },
    },
  },
  tv: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Местные новости. Опять долина. «Двадцать три туши. Версия полиции — волки».' },
      b: { speaker: 'thought', text: 'Версия полиции — это я. Только я в неё не верю.', set: { read_news: true } },
    },
  },
  newspaper: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: '«Юкон Леджер»: «Волки виновны в гибели животных в долине». Ни слова о следах на деревьях.', cmd: 'sfx:sfx.paper' },
      b: { speaker: 'thought', text: 'Ни слова о том, что волки не ломают лосю хребет одним ударом.', set: { read_newspaper: true } },
    },
  },
  bartender: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'bartender', text: 'Детектив Рид. Вам как обычно?', cmd: 'pose:bartender:talk' },
      b: { speaker: 'julian', text: 'Позже. Меня ждут.' },
      c: { speaker: 'bartender', text: 'Альварес уже второй заказывает. Сказал — за ваш счёт.', cmd: 'pose:bartender:idle' },
    },
  },
  chris: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'chris', text: 'Рид! Живой. А говорили, тебя из участка уже не выпускают.', cmd: 'pose:patronB:talk' },
      b: { speaker: 'julian', text: 'Крис. Опять до закрытия?' },
      c: { speaker: 'chris', text: 'Суббота же. Слушай… если завтра увидишь меня трезвым — не удивляйся. Есть разговор. Не здесь.', cmd: 'pose:patronB:idle' },
      d: { speaker: 'thought', text: 'Кристиан Кокс. Свой человек в «Северной розе» — знает всех, кто сюда ходит. Раньше он никогда не говорил «не здесь».', set: { met_chris: true } },
    },
  },
  serviceDoor: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: '«Только для персонала». Из кухни тянет жареным луком и хлоркой.' },
    },
  },
  moose: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Лось смотрит стеклянными глазами поверх бутылок. Даже у него вид бодрее, чем у меня в последние недели.' },
    },
  },
  gallery: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Пантеры, портреты, давно забытые лица в золочёных рамах.' },
      b: { speaker: 'thought', text: 'В полумраке кажется, что все они смотрят в одну сторону. В угол.', set: { looked_gallery: true } },
    },
  },
  mirror: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Старое зеркало. Отражение мутное, как вода в проруби.', cmd: 'mirrorFocus' },
      b: { speaker: 'thought', text: 'Угловой столик. В зеркале — пустой стул и нетронутый бокал.' },
      c: { speaker: 'thought', text: 'Оборачиваюсь — за столиком сидит человек.', cmd: 'lookAtOwen' },
      d: { speaker: 'thought', text: '…Свет так падает. Наверное.', set: { noticed_owen: true, mirror_anomaly: true }, cmd: 'mirrorRelease' },
    },
  },
  owen: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Мужчина в чёрном пальто. Бокал красного, к которому он не притрагивается.' },
      b: { speaker: 'thought', text: 'Он не смотрит на меня. Слишком старательно не смотрит.', set: { noticed_owen: true } },
    },
  },
  kaydenWave: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'kayden', text: 'Джул! Я тут! Виски стынет — а это, между прочим, преступление.' },
    },
  },
  escapeHint: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Дверь. Нужно дойти до двери.', distort: 0.4 },
    },
  },

  // ------------------------------------------------------------ the conversation
  main: {
    mode: 'vn',
    bg: 'table',
    cast: { left: 'julian', right: 'kayden' },
    nodes: {
      start: { speaker: 'kayden', text: 'Ну наконец-то. Я уж думал, ты опять ночуешь в участке.', expr: { kayden: 'smile', julian: 'tired' }, checkpoint: true, set: { met_kayden: true } },
      s2: { speaker: 'julian', text: 'Почти. Капитан хотел закрыть дело ещё в понедельник.', expr: { julian: 'tired' } },
      s3: {
        speaker: 'kayden', text: 'Дело о волках?', expr: { kayden: 'neutral' },
        choices: [
          { text: '«Это не волки».', next: 'a1' },
          { text: '«Давай хоть пять минут не о работе».', next: 'b1' },
        ],
      },
      b1: { speaker: 'kayden', text: 'Пять минут. Засекаю.', expr: { kayden: 'smirk', julian: 'neutral' } },
      b2: { speaker: 'narrator', text: 'Кайден честно молчит. Секунд двадцать.' },
      b3: { speaker: 'kayden', text: 'Ладно, кого я обманываю. У тебя всё на лице написано. Рассказывай.', expr: { kayden: 'concerned' }, next: 'a1' },

      a1: { speaker: 'julian', text: 'Это не волки, Кайден.', expr: { julian: 'serious', kayden: 'neutral' } },
      a2: { speaker: 'kayden', text: 'Криминалисты сказали…' },
      a3: { speaker: 'julian', text: 'Криминалисты видели фотографии. А я там был. Двадцать три животных — олени, лоси, даже медведь. На одном пятачке у реки.', expr: { julian: 'serious' } },
      a4: { speaker: 'julian', text: 'Их не ели. Их разорвали. Следы когтей — длиннее моей ладони.', expr: { julian: 'talk' }, pose: { julian: 'talk' } },
      a5: { speaker: 'julian', text: 'По телевизору уже говорят «волки». Удобно.', if: 'read_news || read_newspaper', expr: { julian: 'serious' } },
      a6: { speaker: 'kayden', text: 'Стая может…', expr: { kayden: 'concerned' }, pose: { julian: 'idle', kayden: 'talk' } },
      a7: { speaker: 'julian', text: 'Стая не оставляет борозды на стволах на высоте двух метров. Как будто что-то стояло. В полный рост.', expr: { julian: 'serious' } },
      a8: { speaker: 'kayden', text: '…Медведь-шатун?', expr: { kayden: 'surprised' } },
      a9: { speaker: 'julian', text: 'Медведи не ходят двести метров на задних лапах.', expr: { julian: 'tired' } },
      a10: {
        speaker: 'kayden', text: 'И что ты будешь делать? Капитан тебя к этому делу больше не подпустит.', expr: { kayden: 'concerned' }, pose: { kayden: 'idle' },
        choices: [
          { text: 'Поеду в долину сам.', next: 'c1', set: { plan_valley: true } },
          { text: 'Пока не знаю.', next: 'c2' },
        ],
      },
      c1: { speaker: 'julian', text: 'Поеду туда сам. На выходных.', expr: { julian: 'serious' } },
      c1b: { speaker: 'kayden', text: 'Один? Зимой? В долину, где кто-то рвёт лосей пополам? Блестящий план, детектив.', expr: { kayden: 'serious' }, next: 'd' },
      c2: { speaker: 'julian', text: 'Не знаю. Пока — не знаю.', expr: { julian: 'tired' }, next: 'd' },

      d: { speaker: 'kayden', text: 'Джулиан. Это ведь не только из-за туш, да?', expr: { kayden: 'concerned', julian: 'sad' }, pose: { kayden: 'think' } },
      d2: {
        speaker: 'kayden', text: 'Это то же место. Где пропала Лиззи.',
        choices: [
          { text: 'Рассказать о её звонке.', next: 'e1', set: { asked_about_lizzie: true } },
          { text: 'Промолчать.', next: 'e2' },
        ],
      },
      e1: { speaker: 'julian', text: 'Она звонила мне. В ту ночь. Я был на вызове и не взял трубку.', expr: { julian: 'sad' } },
      e2v: { speaker: 'julian', text: 'Я до сих пор переслушиваю это сообщение. Семь секунд. «Я у реки… ты должен это увидеть».', if: 'heard_voicemail', next: 'e3' },
      e2n: { speaker: 'julian', text: 'Оставила голосовое. Семь секунд. «Я у реки… ты должен это увидеть».', if: '!heard_voicemail' },
      e3: { speaker: 'julian', text: 'Что она там увидела, Кайден?', expr: { julian: 'concerned' }, next: 'f' },
      e2: { speaker: 'narrator', text: 'Джулиан молчит. Кайден не торопит.', expr: { julian: 'sad' } },
      e2b: { speaker: 'kayden', text: 'Можешь не говорить. Я и так вижу, как ты держишь стакан.', expr: { kayden: 'concerned' } },

      f: { speaker: 'kayden', text: 'Мне жаль, Джул. Правда. Если бы я мог хоть что-то сделать…', expr: { kayden: 'sad' }, pose: { kayden: 'idle' } },
      f2: { speaker: 'kayden', text: 'Двадцать три дня — это не приговор. Людей находили и позже.', expr: { kayden: 'concerned' } },
      f3: { speaker: 'julian', text: 'В минус сорок?', expr: { julian: 'sad' } },
      f4: { speaker: 'narrator', text: 'Кайден не отвечает.' },
      f5: { speaker: 'kayden', text: 'Давай так. На выходных едем в долину вместе. Возьму у шурина снегоход. Неофициально.', expr: { kayden: 'smile' }, pose: { kayden: 'talk' } },
      f6: { speaker: 'julian', text: '…Спасибо.', expr: { julian: 'neutral' }, set: { trust_kayden: true }, pose: { kayden: 'idle' } },

      // the cocktail (3D cutscene, then back to the dialogue screen)
      g0: { speaker: 'narrator', text: '', cmd: 'cocktailArrives', skipEmpty: true },
      g1: { speaker: 'kayden', text: 'Ого. У тебя появились поклонники?', expr: { kayden: 'surprised', julian: 'concerned' }, checkpoint: true, bg: 'tableOwen' },
      g2: { speaker: 'julian', text: 'Ты его знаешь?', expr: { julian: 'serious' } },
      g3: { speaker: 'kayden', text: 'Впервые вижу. Турист, наверное. Сейчас их полно — северное сияние, все дела.', expr: { kayden: 'neutral' } },
      g4: { speaker: 'waiter', text: 'Он просил передать… «Детективу — за то, что не сдаётся».', expr: { waiter: 'neutral' }, cmd: 'cast:right2:waiter' },
      g5: {
        speaker: 'thought', text: 'Он знает, кто я.', expr: { julian: 'concerned' },
        choices: [
          { text: 'Кивнуть незнакомцу и выпить.', next: 'h1' },
          { text: 'Спросить официанта, кто это.', next: 'h2', set: { asked_waiter: true } },
        ],
      },
      h2: { speaker: 'waiter', text: 'Не представился. Заплатил наличными, сразу. Сказал — вы поймёте.', expr: { waiter: 'talk' } },
      h2b: { speaker: 'kayden', text: 'Да брось. Раз угощают — пей. Ты сегодня заслужил.', expr: { kayden: 'smile' }, next: 'h1' },

      h1: { speaker: 'narrator', text: '', cmd: ['cast:right2:none', 'drink'], skipEmpty: true, set: { drank_cocktail: true } },
      i1: { speaker: 'thought', text: 'Вишня. Горечь. И что-то ещё — будто прикусил губу до крови.', expr: { julian: 'neutral', kayden: 'smile' }, checkpoint: true, bg: 'table' },
      i2: { speaker: 'kayden', text: 'Ну? Как?' },
      i3: { speaker: 'julian', text: 'Странно. Но… да.', expr: { julian: 'smirk' } },
      i4: { speaker: 'kayden', text: 'Помнишь, как Лиззи притащила нас на этот дурацкий фестиваль саун в Доусоне?', expr: { kayden: 'smile' }, pose: { kayden: 'talk' } },
      i5: { speaker: 'julian', text: 'Она поспорила на сорок долларов, что я не досижу до конца.', expr: { julian: 'smile' } },
      i6: { speaker: 'kayden', text: 'И ты не досидел.', expr: { kayden: 'smile' } },
      i7: { speaker: 'julian', text: 'Я не досидел.', expr: { julian: 'smile' }, pose: { kayden: 'idle' } },

      // PHASE 2 — slight discomfort
      j1: { speaker: 'thought', text: 'Жарко. Слишком жарко для минус тридцати четырёх.', cmd: 'phase:2', expr: { julian: 'tired' } },
      j2: { speaker: 'kayden', text: '…так вот, шурин говорит, снегоход заводится с третьего раза, но если пойдём по старой дороге…', expr: { kayden: 'talk' } },
      // PHASE 3 — auditory distortion
      j3: { speaker: 'kayden', text: '…к обеду будем на месте, а там до излучины рукой подать, если лёд…', cmd: 'phase:3', distort: 0.35 },
      j4: { speaker: 'thought', text: 'Голос Кайдена — как из-под воды. Сердце стучит прямо в ушах.', expr: { julian: 'concerned' } },
      j5: {
        speaker: 'kayden', text: 'Джул? Ты меня слышишь?', expr: { kayden: 'concerned' }, distort: 0.2,
        choices: [
          { text: '«Я в порядке».', next: 'k1' },
          { text: '«Мне нехорошо».', next: 'k1', set: { admitted_sick: true } },
        ],
      },
      // PHASE 4 — visual distortion
      k1: { speaker: 'thought', text: 'Угловой столик пуст. Бокал на месте. Когда он ушёл?', cmd: ['phase:4', 'owenGone'], bg: 'tableOwen', expr: { julian: 'dizzy' } },
      k2: { speaker: 'kayden', text: 'Ты бледный как… Эй. Посмотри на меня.', expr: { kayden: 'surprised' }, distort: 0.5, bg: 'table' },
      k3: { speaker: 'thought', text: 'Лица вокруг смазываются. Кто-то смеётся — слишком медленно. Слишком долго.', distort: 0.65 },
      k4: { speaker: 'julian', text: 'Мне надо… на воздух.', expr: { julian: 'dizzy' } },
      k5: { speaker: 'kayden', text: 'Я с тобой —', expr: { kayden: 'concerned' } },
      k6: { speaker: 'julian', text: 'Сиди. Я сейчас.', expr: { julian: 'pain' }, distort: 0.3 },
      k7: { speaker: 'narrator', text: '', cmd: 'escape', skipEmpty: true, end: true },
    },
  },

  // in-scene lines of the cocktail cutscene (shown as cinematic subtitles)
  cocktail: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'waiter', text: 'Прошу прощения. Это вам.' },
      b: { speaker: 'julian', text: 'Я не заказывал.' },
      c: { speaker: 'waiter', text: 'Комплимент. От джентльмена за дальним столиком.' },
    },
  },
  owenNod: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Мужчина в чёрном. Поднимает бокал — едва заметно.', if: '!noticed_owen' },
      b: { speaker: 'thought', text: 'Тот самый, из угла. Из зеркала. Поднимает бокал — едва заметно.', if: 'noticed_owen' },
    },
  },
  ending: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'unknown', text: 'Тш-ш. Не сопротивляйся.' },
    },
  },
};
