/**
 * The Reeds' place (v0.14): the apartment on Hanson Street with Lizzie's attic room.
 *   lh_* — L1 prologue, Wednesday 3 November: Julian tells Lizzie about the valley case.
 *   jh1_* — Julian comes home after the discharge (chapter 5): night, the flat is empty.
 *   jh2_* — Julian at home in the morning before his own investigation (chapter 8).
 */
export const DIALOGUES = {
  // ============================================================ L1 prologue — the evening before
  lh_open: [
    ['lthought', 'Среда. Дома пахнет кофе и холодным супом. Значит, Джул дома.'],
    ['lthought', 'И значит — опять работа на кухонном столе.'],
  ],
  lh_julian: {
    mode: 'vn',
    bg: 'home',
    cast: { left: 'lizzy', right: 'julianL' },
    nodes: {
      a: { speaker: 'lizzy', text: 'Ты опять ужинаешь фотографиями?', expr: { lizzy: 'smile', julianL: 'neutral' } },
      b: { speaker: 'julianL', text: 'Привет, Лиз. Суп на плите. Наверное, уже холодный.' },
      c: { speaker: 'lizzy', text: 'Что это? …Это лось?', expr: { lizzy: 'serious' } },
      d: { speaker: 'julianL', text: 'Был лось. Долина Такхини, три места за две недели. Олени, два лося. Их не едят. Рвут — и бросают.' },
      e: { speaker: 'lizzy', text: 'Волки?' },
      f: { speaker: 'julianL', text: 'В отчёте — «волки». Шеф подписал. Дело закрыто, у нас и без лосей хватает.' },
      g: {
        speaker: 'lizzy', text: 'А ты так не думаешь.',
        choices: [
          { text: '«Покажи на карте».', next: 'map' },
          { text: '«Может, медведь?»', next: 'bear' },
        ],
      },
      map: { speaker: 'julianL', text: 'Юг реки. Потом севернее. Потом ещё севернее. Будто кто-то идёт вверх по течению — и не торопится.', set: { lh_map: true }, next: 'h' },
      bear: { speaker: 'julianL', text: 'Медведи в ноябре спят, Лиз. Почти все. И медведь не уходит за сорок километров от берлоги, чтобы порвать лося и бросить.', next: 'h' },
      h: { speaker: 'julianL', text: 'Шаг — два метра. Борозды на коре выше моей головы. Волк так не умеет. Никто так не умеет.' },
      i: { speaker: 'lizzy', text: 'И что ты будешь делать?' },
      j: { speaker: 'julianL', text: 'Ничего. Это не моё дело. И ты — тоже ничего. Слышишь? Химия, контрольная, спать.', expr: { julianL: 'serious' } },
      k: { speaker: 'lizzy', text: 'Да, сэр. Как скажете, сэр.', expr: { lizzy: 'smile' } },
      l: { speaker: 'julianL', text: 'В пятницу у меня ночное дежурство. Не жди, ложись.', expr: { julianL: 'smile' } },
      m: { speaker: 'lizzy', text: 'Передай Кайдену, что он мне должен двадцать баксов.', set: { lh_talked: true } },
    },
  },
  lh_after: [
    ['lthought', 'Он ушёл в душ и оставил папку открытой. Нарочно или нет — неважно.'],
    ['lthought', 'Я пересняла всё. Двенадцать кадров. Теперь — к себе, наверх.'],
  ],
  lh_photos: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Фото с вертолёта: снег, кровь, следы цепочкой. Внизу его почерком: «Не волки?»' } } },
  lh_fridge: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Магниты из Доусона, мой рисунок из третьего класса — мы с Джулом и собака, которой у нас никогда не было.' } } },
  lh_photo: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Мы на озере Атлин. Мне девять, Джулу двадцать один. Через месяц мамы не станет. Это последнее фото, где мы все смеёмся.' } } },
  lh_coat: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Его красный шарф. Я связала его на Рождество — криво, с дыркой. Он носит его каждый день.' } } },
  lh_window: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Ханс-стрит. Фонари, пустая дорога, за крышами — чёрная полоса холмов.' } } },
  lh_tv: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Новости без звука: «В Уайтхорсе — до минус пятнадцати. Снег ожидается к концу месяца».' } } },
  lh_sofa: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Плед пахнет Джулом и кофе. Он опять спал тут, а не в кровати.' } } },
  lh_need_talk: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Сначала — Джул. Он что-то разложил на кухне.' } } },
  lh_bedroom: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Его комната. Нельзя. Ну, то есть — можно, если он в душе.' } } },
  lh_board: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Доска с его делами. Нож в Риверсайде, угнанные снегоходы. В углу, отдельно, — фото лося. Красная нитка ведёт в никуда.' } } },
  lh_mirror: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Зеркало. За рамку засунуты билеты в кино, которые мы так и не использовали.' } } },
  lh_jbed: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Заправлено по-армейски. Он заправляет кровать, даже когда спит на диване.' } } },
  // the attic
  lh_desk: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Химия открыта на той же странице, что и неделю назад. Контрольная в пятницу. Ага.' } } },
  lh_map: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Карта Юкона. Три булавки — по фото Джула. Юг, середина, север. Ровная линия вдоль реки. Значит, следующая точка — ещё севернее.', set: { lh_pins: true } } } },
  lh_camera: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Мамин «Пентакс» и новая плёнка на тридцать шесть кадров. Хватит на три места.' } } },
  lh_posters: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Бабочки Юкона. Я собирала их в восемь лет и плакала над каждой. Теперь просто фотографирую.' } } },
  lh_awindow: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Огни Уайтхорса. Где-то там, на севере, кто-то идёт вдоль реки.' } } },
  lh_bed_wait: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Спать рано. Сначала — карта.' } } },
  lh_night: [
    ['lthought', 'Напишу девочкам. «Пятница. Столовая. У меня дело века».'],
    ['lthought', 'Пуриэль ответила через секунду: «УБИЙСТВА?? я в деле». Викки — «нет». Оливия — «а еду брать?»'],
  ],
  lh_down_wait: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Внизу — ничего интересного. Только Джул и его холодный суп.' } } },
  lh_door_wait: { mode: 'bark', nodes: { a: { speaker: 'lthought', text: 'Уже поздно. Никуда я не пойду. Ну — до пятницы.' } } },

  // ============================================================ Julian at home — after the discharge
  jh1_open: [
    ['thought', 'Дом. Шесть дней меня тут не было. Шесть дней и одна смерть.'],
    ['thought', 'Её куртки нет на вешалке. Её ботинок нет у двери.'],
  ],
  jh1_photo: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Атлин. Ей девять. Она смеётся, потому что я уронил удочку в озеро. Я обещал, что с ней ничего не случится. Маме — обещал.' } } },
  jh1_fridge: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Молоко, сыр, её йогурты. Пахнет картоном. Всё пахнет картоном. Хочется не этого.', set: { jh1_fridge: true } } } },
  jh1_table: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Кухонный стол. Моя папка по долине. Двенадцати фотографий не хватает — отсюда видно по пустым кармашкам.', set: { jh1_table: true } } } },
  jh1_coat: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Вешаю шарф на крючок. Её крючок пустой. На нём наклейка с бабочкой — она клеила их везде в девять лет.' } } },
  jh1_window: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Фонари. Я вижу каждую снежинку в их свете — отдельно, как под лупой. Раньше так не было.' } } },
  jh1_tv: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Чёрный экран. В нём отражается комната — диван, торшер, окно. Себя я в нём не нахожу. Наверное, угол.' } } },
  jh1_sofa: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Плед. Её запах — шампунь с яблоком. Я помню его с больницы: так пахла её трубка, когда она звонила. Когда кричала.' } } },
  jh1_board: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Моя доска. Нож в Риверсайде, снегоходы — чепуха. Фото лося в углу. Красная нитка ведёт в никуда. Теперь — к ней.' } } },
  jh1_mirror: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Зеркало. Бледный. Глаза — будто три ночные смены подряд. Только я спал неделю. Или не спал. Или не я.' } } },
  jh1_jbed: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Не лягу. Я не устал. Это тоже новое.' } } },
  jh1_desk: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Учебник химии. На полях — её почерк: «юг → середина → север = река?» Она решала мою задачу, а не свою.', set: { jh1_desk: true } } } },
  jh1_map: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Карта. Три булавки — мои три места. И четвёртая, красная, севернее. Она знала, куда идти. Я — нет.', set: { jh1_map: true } } } },
  jh1_camera: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Маминого «Пентакса» нет. Пустой чехол. Она пошла туда фотографировать. Из-за меня.' } } },
  jh1_posters: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Бабочки. Она плакала над каждой, когда ей было восемь. Я говорил: им не больно, Лиз. Врал.' } } },
  jh1_bed: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Её кровать. Сажусь на край, как в детстве, когда ей снились кошмары. Теперь кошмар — снаружи.' } } },
  jh1_awindow: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Север. Где-то там. Я найду тебя, Лиз. Я обещаю. Ещё раз.' } } },
  jh1_need: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Не сейчас. Сначала — её комната. Наверху.' } } },
  jh1_end: [
    ['thought', 'Её карта. Её почерк. Она расследовала моё дело — то, что я назвал «не моим».'],
    ['thought', 'Ковальски сказал: «Придёшь, когда сможешь». Я смогу через неделю. Дольше не выдержу.'],
  ],

  // ============================================================ Julian at home — morning, before chapter 8
  jh2_open: [
    ['thought', 'Утро. В квартире светло и пусто. Тишина такая, что слышно холодильник.'],
  ],
  jh2_table: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Папка, кофе, ключи. Кофе остыл — я снова забыл его выпить. Мне больше не хочется кофе.' } } },
  jh2_photo: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Атлин. Держись, Лиз. Ещё немного.' } } },
  jh2_fridge: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'На дверце — её записка: «Купи молоко!!! И себе мозги». Не снимаю.' } } },
  jh2_coat: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Пальто, шарф. Пора.', set: { jh2_ready: true } } } },
  jh2_window: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Серое небо. Снег ещё не лёг. Следы на земле пока видно.' } } },
  jh2_tv: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Утренние новости: «Поиски пропавших школьниц продолжаются. Волонтёры собираются у…» Выключаю.' } } },
  jh2_sofa: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Я не ложился. Просидел тут до рассвета, глядя в окно. Не устал. Совсем.' } } },
  jh2_door_wait: { mode: 'bark', nodes: { a: { speaker: 'thought', text: 'Пальто. Шарф. Без шарфа она меня убьёт.' } } },
  jh2_go_wolf: [
    ['thought', 'Долина Такхини. Её четвёртая булавка. Начну оттуда, где она была последней.'],
  ],
  jh2_go_vampire: [
    ['thought', 'Человек из бара. Коктейль. Если я узнаю, что он со мной сделал, — может, узнаю и остальное.'],
  ],
};
