import type { Project, SceneObject, ShowEvent } from '../types/show';
import { createId, createSceneObject } from './catalog';
import { assignLanes } from '../utils/timeline';

/**
 * "Demo Festival Intro" — a ready-to-play 90s show that loads on first run so
 * the app feels alive immediately (the "wow" moment): full rig + a sequence of
 * color washes, strobes, lasers, smoke, flames, CO2, confetti and a blackout.
 *
 * Events are authored as a flat list (each targets all eligible objects) and
 * then laid out onto non-overlapping lanes by `assignLanes`.
 */
export function createDemoProject(): Project {
  const objects: SceneObject[] = [];
  const add = (o: SceneObject) => {
    objects.push(o);
    return o;
  };

  // ---- Stage structure --------------------------------------------------
  add(createSceneObject('stage_platform', { name: 'Main Deck', position: [0, 0.25, -1], scale: 1.4 }));
  add(createSceneObject('dj_booth', { name: 'DJ Booth', position: [0, 0.9, -1.5] }));
  add(createSceneObject('led_screen', { name: 'Main Wall', position: [0, 5, -7], scale: 1.3 }));
  add(createSceneObject('truss', { name: 'Front Truss', position: [0, 6.2, -1], scale: 1.3 }));
  add(createSceneObject('truss', { name: 'Mid Truss', position: [0, 6.2, -4.5], scale: 1.3 }));
  add(createSceneObject('truss_tower', { name: 'Tower Left', position: [-9, 2.5, -1] }));
  add(createSceneObject('truss_tower', { name: 'Tower Right', position: [9, 2.5, -1] }));
  add(createSceneObject('speaker', { name: 'PA Left', position: [-7, 4.6, -1] }));
  add(createSceneObject('speaker', { name: 'PA Right', position: [7, 4.6, -1] }));
  add(createSceneObject('crowd_block', { name: 'Crowd', position: [0, 0, 10], scale: 1.15 }));
  // Safety barrier line between the stage and the pit
  for (let i = 0; i < 11; i++) {
    const x = (i - 5) * 1.22;
    add(createSceneObject('barrier', { name: `Barrier ${i + 1}`, position: [x, 0.55, 6.6] }));
  }
  add(createSceneObject('foh_tower', { name: 'FOH', position: [0, 1.3, 23] }));

  // ---- Festival grounds ---------------------------------------------------
  const treeSpots: [number, number][] = [
    [-19, 2],
    [-22, 9],
    [-18, 16],
    [19, 3],
    [22, 10],
    [18, 17],
    [-24, 22],
    [24, 24],
  ];
  treeSpots.forEach(([x, z], i) => add(createSceneObject('tree', { name: `Tree ${i + 1}`, position: [x, 2.3, z] })));
  add(createSceneObject('bush', { name: 'Bush L', position: [-16, 0.5, 7] }));
  add(createSceneObject('bush', { name: 'Bush R', position: [16, 0.5, 8] }));
  add(createSceneObject('bar_stand', { name: 'Bar West', position: [-15, 1.3, 14], rotation: [0, Math.PI / 2, 0] }));
  add(createSceneObject('food_stand', { name: 'Food East', position: [15, 1.25, 15], rotation: [0, -Math.PI / 2, 0] }));
  add(createSceneObject('tent', { name: 'Chill Tent', position: [-19, 1.25, 25] }));
  for (let i = 0; i < 4; i++) {
    add(createSceneObject('portaloo', { name: `WC ${i + 1}`, position: [18 + i * 2.4, 1.15, 27], rotation: [0, Math.PI, 0] }));
  }
  add(createSceneObject('flag_pole', { name: 'Flag L', position: [-7.6, 2.5, 6.9], color: '#22d3ee' }));
  add(createSceneObject('flag_pole', { name: 'Flag R', position: [7.6, 2.5, 6.9], color: '#e64bd6' }));

  // ---- 8 moving heads on the front truss (4 spot + 4 wash) ---------------
  const headX = [-6, -3.6, -1.2, 1.2, 3.6, 6];
  for (let i = 0; i < 4; i++) {
    const x = [-5.4, -1.8, 1.8, 5.4][i];
    add(createSceneObject('moving_head_spot', { name: `Spot ${i + 1}`, position: [x, 6.1, -1], target: [x * 0.4, 0, 4], color: '#22d3ee', beamAngle: 6 }));
  }
  for (let i = 0; i < 4; i++) {
    const x = [-3.6, -1.2, 1.2, 3.6][i];
    add(createSceneObject('moving_head_wash', { name: `Wash ${i + 1}`, position: [x, 6.1, -4.4], target: [x * 0.5, 0, 3], color: '#8b5cf6', beamAngle: 18 }));
  }

  // ---- 4 beam lights spread across the rig ------------------------------
  for (let i = 0; i < 4; i++) {
    const x = headX[[0, 1, 4, 5][i]];
    add(createSceneObject('beam_light', { name: `Beam ${i + 1}`, position: [x, 6.2, -2.5], target: [x * 0.2, 0, 2], color: i % 2 === 0 ? '#3b82f6' : '#e64bd6', beamAngle: 3.5 }));
  }

  // ---- 2 lasers ---------------------------------------------------------
  add(createSceneObject('laser', { name: 'Laser L', position: [-6, 5.6, -3], target: [2, 1.5, 10], color: '#39ff14' }));
  add(createSceneObject('laser', { name: 'Laser R', position: [6, 5.6, -3], target: [-2, 1.5, 10], color: '#22d3ee' }));

  // ---- 2 smoke machines, 2 flame jets, CO2 + confetti -------------------
  add(createSceneObject('smoke_machine', { name: 'Hazer L', position: [-7, 0.22, -2] }));
  add(createSceneObject('smoke_machine', { name: 'Hazer R', position: [7, 0.22, -2] }));
  add(createSceneObject('flame_jet', { name: 'Flame L', position: [-4, 0.34, -2.5] }));
  add(createSceneObject('flame_jet', { name: 'Flame R', position: [4, 0.34, -2.5] }));
  add(createSceneObject('co2_jet', { name: 'CO2 L', position: [-2, 0.38, -1] }));
  add(createSceneObject('co2_jet', { name: 'CO2 R', position: [2, 0.38, -1] }));
  add(createSceneObject('confetti_cannon', { name: 'Confetti L', position: [-5, 0.42, 0] }));
  add(createSceneObject('confetti_cannon', { name: 'Confetti R', position: [5, 0.42, 0] }));

  // ---- Timeline events (flat; assignLanes lays them onto lanes) ---------
  const events: ShowEvent[] = [];
  const ev = (time: number, duration: number, type: ShowEvent['type'], params: Record<string, unknown> = {}) => {
    events.push({ id: createId('evt'), lane: '', time, duration, type, targets: [], params });
  };

  // Intro — deep blue wash + LED pulse building energy
  ev(0, 90, 'led_color', { color: '#1b2a55' });
  ev(0, 14, 'light_color', { color: '#2a4cff' });
  ev(0, 14, 'light_intensity', { intensity: 0.5 });
  ev(2, 12, 'light_sweep', { pattern: 'wave', speed: 22 });
  ev(4, 8, 'smoke_burst', { intensity: 1 });

  // Build — color shift + first laser teaser
  ev(14, 16, 'light_color', { color: '#22d3ee' });
  ev(14, 16, 'light_intensity', { intensity: 0.9 });
  ev(14, 16, 'light_sweep', { pattern: 'circular', speed: 40 });
  ev(16, 14, 'led_pulse', { color: '#22d3ee', rate: 1 });
  ev(20, 8, 'laser_on', { color: '#39ff14', pattern: 'up_down', speed: 25 });

  // Drop 1 at ~30s — strobe + flames + confetti + magenta
  ev(28, 2, 'light_strobe', { rate: 9, color: '#ffffff' });
  ev(30, 18, 'light_color', { color: '#e64bd6' });
  ev(30, 18, 'light_intensity', { intensity: 1.3 });
  ev(30, 18, 'light_sweep', { pattern: 'circular', speed: 60 });
  ev(30, 1.2, 'flame_burst', { intensity: 1.2 });
  ev(30, 1.2, 'confetti_burst', { intensity: 1.4 });
  ev(30, 18, 'led_pulse', { color: '#e64bd6', rate: 1.3 });
  ev(30, 18, 'laser_on', { color: '#ff2bd0', pattern: 'circular', speed: 60 });
  ev(36, 1, 'co2_burst', { intensity: 1 });
  ev(42, 1.2, 'flame_burst', { intensity: 1 });

  // Breakdown at ~48s — calmer violet, smoke rolls in
  ev(48, 14, 'light_color', { color: '#8b5cf6' });
  ev(48, 14, 'light_intensity', { intensity: 0.7 });
  ev(48, 14, 'light_sweep', { pattern: 'left_right', speed: 26 });
  ev(48, 12, 'smoke_burst', { intensity: 1 });
  ev(48, 14, 'led_color', { color: '#2b1a55' });
  ev(50, 10, 'laser_on', { color: '#22d3ee', pattern: 'wave', speed: 40 });

  // Drop 2 at ~62s — full energy, amber + strobe + CO2
  ev(60, 2, 'light_strobe', { rate: 10, color: '#ffffff' });
  ev(62, 16, 'light_color', { color: '#ff7b1c' });
  ev(62, 16, 'light_intensity', { intensity: 1.4 });
  ev(62, 16, 'light_sweep', { pattern: 'circular', speed: 72 });
  ev(62, 16, 'led_pulse', { color: '#ff7b1c', rate: 1.5 });
  ev(62, 16, 'laser_on', { color: '#39ff14', pattern: 'circular', speed: 78 });
  ev(62, 1.2, 'co2_burst', { intensity: 1.3 });
  ev(64, 1.2, 'flame_burst', { intensity: 1.3 });
  ev(68, 1.2, 'confetti_burst', { intensity: 1.6 });
  ev(72, 1, 'co2_burst', { intensity: 1 });

  // Outro — cool down then blackout finish
  ev(78, 10, 'light_color', { color: '#2a4cff' });
  ev(78, 10, 'light_intensity', { intensity: 0.6 });
  ev(78, 10, 'led_color', { color: '#101a3a' });
  ev(80, 6, 'smoke_burst', { intensity: 0.8 });
  ev(88, 2, 'blackout', {});

  const laid = assignLanes(events);

  return {
    id: createId('proj'),
    name: 'Demo Festival Intro',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects,
    lanes: laid.lanes,
    events: laid.events,
    settings: { duration: 90, bpm: 128, fog: true, timeOfDay: 13, dayBrightness: 1, nightBrightness: 0.12 },
  };
}
