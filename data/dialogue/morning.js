/**
 * BAR_MORNING_CRIME_SCENE — lines for the morning after.
 * Same node format as bar.js. The Kayden discovery, the memory flash and the
 * police arrival are staged in src/story/MorningSequence.js (they need timing).
 */
export const DIALOGUES = {
  m_wake: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: '…' },
      b: { speaker: 'thought', text: 'Голова. Пол. Холодно.' },
    },
  },
  m_wake2: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'julian', text: 'Чёрт…' },
      b: { speaker: 'thought', text: 'Бар. Кайден что-то говорил про снегоход. Мужчина в чёрном… Дальше — ничего.' },
      c: { speaker: 'thought', text: 'Во рту сухо. Ноги как чужие. И тишина — такая, что слышно, как звенит в ушах.', set: { objective: 'morning' } },
    },
  },
  m_glass: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Осколки бокала. Это со вчера.' },
    },
  },
  m_chair: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Стул опрокинут. Ещё один — у окна.' },
      b: { speaker: 'thought', text: 'Кто-то бежал.', set: { m_clue_chair: true } },
    },
  },
  m_body_bar: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Мужчина у стойки. Кожа белая, как воск.' },
      b: { speaker: 'thought', text: 'Крови нет. Ни капли — ни на нём, ни на полу.', set: { m_body_bar: true } },
    },
  },
  m_body_window: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Женщина. Вчера она сидела у окна и смеялась.' },
      b: { speaker: 'thought', text: 'На шее — два прокола…' },
      c: { speaker: 'julian', text: 'Какого чёрта…', set: { m_body_window: true, saw_wounds: true } },
    },
  },
  m_body_door: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Метрдотель. Вчера он держал мне дверь.' },
      b: { speaker: 'thought', text: 'Он почти успел выйти.', set: { m_body_door: true } },
    },
  },
  m_body_far: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Даже здесь, в дальнем углу. Никто не успел добежать.', set: { m_body_far: true } },
    },
  },
  m_bar: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Бутылки разбиты. Стойка пуста.' },
      b: { speaker: 'thought', text: 'Кассу никто не тронул.', set: { m_clue_bar: true } },
    },
  },
  m_door: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Дверь открыта.', cmd: 'sfx:sfx.wind_gust' },
      b: { speaker: 'thought', text: 'Снаружи — ни следа. Снег всё замёл.', set: { m_clue_door: true } },
    },
  },
  m_window: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'julian', text: 'Уже утро?' },
      b: { speaker: 'thought', text: 'Серое небо. Пустая улица. Сколько же я здесь пролежал…', set: { m_clue_window: true } },
    },
  },
  m_marks: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Полосы на полу — кого-то тащили.' },
      b: { speaker: 'julian', text: 'Что здесь произошло?', set: { m_clue_marks: true } },
    },
  },
  m_bag: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'Женская сумка. Кошелёк на месте, деньги тоже.' },
      b: { speaker: 'thought', text: 'Это не ограбление.', set: { m_clue_bag: true } },
    },
  },
  m_hint: {
    mode: 'bark',
    nodes: {
      a: { speaker: 'thought', text: 'У нашего столика кто-то лежит.' },
    },
  },
};
