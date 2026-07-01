import type { Project, SceneObject, ShowEvent } from '../types/show';
import { createId, createSceneObject } from './catalog';

/**
 * "Demo Festival Intro" — a ready-to-play 90s show that loads on first run so
 * the app feels alive immediately (the "wow" moment): full rig + a sequence of
 * color washes, strobes, lasers, smoke, flames, CO2, confetti and a blackout.
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
  add(createSceneObject('speaker', { name: 'PA Left', position: [-8, 1.8, 1] }));
  add(createSceneObject('speaker', { name: 'PA Right', position: [8, 1.8, 1] }));
  add(createSceneObject('crowd_block', { name: 'Crowd', position: [0, 0, 12], scale: 1.6 }));

  // ---- 8 moving heads on the front truss (4 spot + 4 wash) ---------------
  const headX = [-6, -3.6, -1.2, 1.2, 3.6, 6];
  const movingHeadIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const x = [-5.4, -1.8, 1.8, 5.4][i];
    const o = add(
      createSceneObject('moving_head_spot', {
        name: `Spot ${i + 1}`,
        position: [x, 6.1, -1],
        target: [x * 0.4, 0, 4],
        color: '#22d3ee',
        beamAngle: 6,
        movement: 'circular',
        movementSpeed: 32,
      }),
    );
    movingHeadIds.push(o.id);
  }
  for (let i = 0; i < 4; i++) {
    const x = [-3.6, -1.2, 1.2, 3.6][i];
    const o = add(
      createSceneObject('moving_head_wash', {
        name: `Wash ${i + 1}`,
        position: [x, 6.1, -4.4],
        target: [x * 0.5, 0, 3],
        color: '#8b5cf6',
        beamAngle: 18,
        movement: 'wave',
        movementSpeed: 26,
      }),
    );
    movingHeadIds.push(o.id);
  }

  // ---- 4 beam lights spread across the rig ------------------------------
  for (let i = 0; i < 4; i++) {
    const x = headX[[0, 1, 4, 5][i]];
    add(
      createSceneObject('beam_light', {
        name: `Beam ${i + 1}`,
        position: [x, 6.2, -2.5],
        target: [x * 0.2, 0, 2],
        color: i % 2 === 0 ? '#3b82f6' : '#e64bd6',
        beamAngle: 3.5,
        movement: 'up_down',
        movementSpeed: 40,
      }),
    );
  }

  // ---- 2 lasers ---------------------------------------------------------
  add(
    createSceneObject('laser', {
      name: 'Laser L',
      position: [-6, 5.6, -3],
      target: [2, 1.5, 10],
      color: '#39ff14',
      movement: 'left_right',
      movementSpeed: 30,
    }),
  );
  add(
    createSceneObject('laser', {
      name: 'Laser R',
      position: [6, 5.6, -3],
      target: [-2, 1.5, 10],
      color: '#22d3ee',
      movement: 'left_right',
      movementSpeed: 30,
    }),
  );

  // ---- 2 smoke machines, 2 flame jets, CO2 + confetti -------------------
  add(createSceneObject('smoke_machine', { name: 'Hazer L', position: [-7, 0.3, -2] }));
  add(createSceneObject('smoke_machine', { name: 'Hazer R', position: [7, 0.3, -2] }));
  add(createSceneObject('flame_jet', { name: 'Flame L', position: [-4, 0.4, -2.5] }));
  add(createSceneObject('flame_jet', { name: 'Flame R', position: [4, 0.4, -2.5] }));
  add(createSceneObject('co2_jet', { name: 'CO2 L', position: [-2, 0.5, -1] }));
  add(createSceneObject('co2_jet', { name: 'CO2 R', position: [2, 0.5, -1] }));
  add(createSceneObject('confetti_cannon', { name: 'Confetti L', position: [-5, 0.6, 0] }));
  add(createSceneObject('confetti_cannon', { name: 'Confetti R', position: [5, 0.6, 0] }));

  // ---- Timeline events --------------------------------------------------
  const events: ShowEvent[] = [];
  const ev = (
    time: number,
    duration: number,
    track: ShowEvent['track'],
    type: ShowEvent['type'],
    params: Record<string, unknown> = {},
    target: string = 'all',
  ) => {
    events.push({ id: createId('evt'), time, duration, track, type, target, params });
  };

  // Intro — deep blue wash + LED pulse building energy
  ev(0, 90, 'led', 'led_color', { color: '#1b2a55' });
  ev(0, 14, 'lights', 'light_color', { color: '#2a4cff' });
  ev(0, 14, 'lights', 'light_intensity', { intensity: 0.5 });
  ev(2, 12, 'lights', 'light_sweep', { amplitude: 1, speed: 0.25 });
  ev(4, 8, 'fx', 'smoke_burst', { intensity: 1 });

  // Build — color shift + first laser teaser
  ev(14, 16, 'lights', 'light_color', { color: '#22d3ee' });
  ev(14, 16, 'lights', 'light_intensity', { intensity: 0.9 });
  ev(14, 16, 'lights', 'light_sweep', { amplitude: 1.4, speed: 0.5 });
  ev(16, 14, 'led', 'led_pulse', { color: '#22d3ee', rate: 1 });
  ev(20, 8, 'lasers', 'laser_on', { color: '#39ff14' });

  // Drop 1 at ~30s — strobe + flames + confetti + magenta
  ev(28, 2, 'lights', 'light_color', { color: '#ffffff' });
  ev(28, 2.2, 'lights', 'light_strobe', { rate: 9, color: '#ffffff' });
  ev(30, 18, 'lights', 'light_color', { color: '#e64bd6' });
  ev(30, 18, 'lights', 'light_intensity', { intensity: 1.3 });
  ev(30, 18, 'lights', 'light_sweep', { amplitude: 1.4, speed: 0.55 });
  ev(30, 1.2, 'fx', 'flame_burst', { intensity: 1.2 });
  ev(30, 1.2, 'fx', 'confetti_burst', { intensity: 1.4 });
  ev(30, 18, 'led', 'led_pulse', { color: '#e64bd6', rate: 1.3 });
  ev(30, 18, 'lasers', 'laser_on', { color: '#ff2bd0' });
  ev(36, 1, 'fx', 'co2_burst', { intensity: 1 });
  ev(42, 1.2, 'fx', 'flame_burst', { intensity: 1 });

  // Breakdown at ~48s — calmer violet, smoke rolls in
  ev(48, 14, 'lights', 'light_color', { color: '#8b5cf6' });
  ev(48, 14, 'lights', 'light_intensity', { intensity: 0.7 });
  ev(48, 14, 'lights', 'light_sweep', { amplitude: 0.8, speed: 0.35 });
  ev(48, 12, 'fx', 'smoke_burst', { intensity: 1 });
  ev(48, 14, 'led', 'led_color', { color: '#2b1a55' });
  ev(50, 10, 'lasers', 'laser_on', { color: '#22d3ee' });

  // Drop 2 at ~62s — full energy, amber + strobe + CO2
  ev(60, 2, 'lights', 'light_color', { color: '#ffffff' });
  ev(60, 2, 'lights', 'light_strobe', { rate: 10, color: '#ffffff' });
  ev(62, 16, 'lights', 'light_color', { color: '#ff7b1c' });
  ev(62, 16, 'lights', 'light_intensity', { intensity: 1.4 });
  ev(62, 16, 'lights', 'light_sweep', { amplitude: 1.5, speed: 0.6 });
  ev(62, 16, 'led', 'led_pulse', { color: '#ff7b1c', rate: 1.5 });
  ev(62, 16, 'lasers', 'laser_on', { color: '#39ff14' });
  ev(62, 1.2, 'fx', 'co2_burst', { intensity: 1.3 });
  ev(64, 1.2, 'fx', 'flame_burst', { intensity: 1.3 });
  ev(68, 1.2, 'fx', 'confetti_burst', { intensity: 1.6 });
  ev(72, 1, 'fx', 'co2_burst', { intensity: 1 });

  // Outro — cool down then blackout finish
  ev(78, 10, 'lights', 'light_color', { color: '#2a4cff' });
  ev(78, 10, 'lights', 'light_intensity', { intensity: 0.6 });
  ev(78, 10, 'led', 'led_color', { color: '#101a3a' });
  ev(80, 6, 'fx', 'smoke_burst', { intensity: 0.8 });
  ev(88, 2, 'lights', 'blackout', {});

  return {
    id: createId('proj'),
    name: 'Demo Festival Intro',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects,
    events,
    settings: { duration: 90, bpm: 128, fog: true },
  };
}
