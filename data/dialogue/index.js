import { DIALOGUES as BAR } from './bar.js';
import { DIALOGUES as MORNING } from './morning.js';
import { DIALOGUES as CUSTODY } from './custody.js';
import { DIALOGUES as INVESTIGATION } from './investigation.js';
import { DIALOGUES as LIZZIE } from './lizzie.js';

/** All dialogue tables merged; add a file per location. */
export const DIALOGUES = { ...BAR, ...MORNING, ...CUSTODY, ...INVESTIGATION, ...LIZZIE };
