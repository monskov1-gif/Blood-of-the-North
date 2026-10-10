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
import { CaveDenScene, CaveDeepScene, CaveAltarScene, CaveStoreScene, CaveTunnelScene, CaveRiftScene } from './CaveRooms.js';
import { CafeteriaScene } from './CafeteriaScene.js';
import { ApartmentScene, ApartmentBedroomScene, ApartmentAtticScene } from './ApartmentScene.js';

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
  cave_den: CaveDenScene,
  cave_deep: CaveDeepScene,
  cave_altar: CaveAltarScene,
  cave_store: CaveStoreScene,
  cave_tunnel: CaveTunnelScene,
  cave_rift: CaveRiftScene,
  cafeteria: CafeteriaScene,
  apartment: ApartmentScene,
  apt_bedroom: ApartmentBedroomScene,
  apt_attic: ApartmentAtticScene,
};
