import { BarScene } from './BarScene.js';
import { BarStory } from '../../story/BarStory.js';

/**
 * Scene registry: each entry pairs a 3D world builder with its story script.
 * Future locations (forest, police station, hospital…) are added here.
 */
export const SCENES = {
  bar: { World: BarScene, Story: BarStory },
};
