import { BarScene } from './BarScene.js';
import { BarStory } from '../../story/BarStory.js';
import { PoliceCarScene } from './PoliceCarScene.js';
import { StationScene } from './StationScene.js';
import { InterrogationScene } from './InterrogationScene.js';
import { HospitalScene } from './HospitalScene.js';
import { StreetScene } from './StreetScene.js';
import { ForestScene } from './ForestScene.js';
import { SchoolScene } from './SchoolScene.js';
import { CaveScene } from './CaveScene.js';

/**
 * Scene registry: each entry pairs a 3D world builder with its story script.
 * Future locations (forest, police station, hospital…) are added here.
 */
export const SCENES = {
  bar: { World: BarScene, Story: BarStory },
};

/** Additional 3D locations reachable from the story (built lazily, cached). */
export const LOCATIONS = {
  car: PoliceCarScene,
  station: StationScene,
  interrogation: InterrogationScene,
  hospital: HospitalScene,
  street: StreetScene,
  forest: ForestScene,
  school: SchoolScene,
  cave: CaveScene,
};
