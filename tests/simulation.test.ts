import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, seededRandom } from '../game/rules.ts';
import { Simulation } from '../game/simulation.ts';

void test('paused match does not advance actors, projectiles or time', () => {
  const sim = new Simulation(createWorld(seededRandom(12)));
  sim.start();
  sim.update(1 / 60, { forward: 1 });
  sim.pause();
  const before = JSON.stringify(sim.match);
  sim.update(2, { forward: 1, fire: true });
  assert.equal(JSON.stringify(sim.match), before);
  assert.equal(sim.status, 'paused');
});
void test('player movement and jump work on a rooftop', () => {
  const sim = new Simulation(createWorld(seededRandom(12)));
  sim.start();
  const old = { ...sim.match.player };
  for (let i = 0; i < 30; i++) sim.update(1 / 60, { forward: 1, yaw: 0 });
  assert.ok(sim.match.player.z < old.z - 2);
  sim.update(1 / 60, { jump: true });
  assert.ok(sim.match.player.y > old.y);
});
void test('laser creates separated moving red pulses', () => {
  const sim = new Simulation(createWorld(seededRandom(1)));
  sim.start();
  sim.match.player.cooldown = 0;
  for (let i = 0; i < 20; i++)
    sim.update(1 / 60, { fire: true, yaw: 0, pitch: 0.5, assist: false });
  const pulses = sim.projectiles.filter((p) => p.owner === 'player');
  assert.ok(pulses.length >= 2);
  assert.ok(
    Math.hypot(
      pulses[0].x - pulses[1].x,
      pulses[0].y - pulses[1].y,
      pulses[0].z - pulses[1].z,
    ) > 1.5,
  );
});
void test('buddy follows from the roof to the lawn without teleporting and holds a cover position', () => {
  const sim = new Simulation(createWorld(seededRandom(7)));
  sim.start();
  sim.match.enemies.forEach((e) => (e.hp = 0));
  sim.match.enemies[0].hp = 100;
  Object.assign(sim.match.enemies[0], { x: -47, y: 0, z: -47 });
  Object.assign(sim.match.player, { x: 0, y: 0, z: 0 });
  const initial = Math.hypot(sim.match.buddy.x, sim.match.buddy.z);
  for (let i = 0; i < 1800; i++) {
    const last = { ...sim.match.buddy };
    sim.update(1 / 60, {});
    assert.ok(
      Math.hypot(last.x - sim.match.buddy.x, last.z - sim.match.buddy.z) < 0.13,
      'no teleport',
    );
  }
  assert.ok(Math.hypot(sim.match.buddy.x, sim.match.buddy.z) < initial * 0.4);
  assert.ok(sim.match.buddy.y < 0.6);
  sim.command('cover');
  const held = { ...sim.match.buddy };
  Object.assign(sim.match.player, { x: 30, z: 0 });
  for (let i = 0; i < 90; i++) sim.update(1 / 60, {});
  assert.ok(
    Math.hypot(sim.match.buddy.x - held.x, sim.match.buddy.z - held.z) < 0.3,
  );
});
void test('ranged projectiles actually damage enemies and never damage teammates', () => {
  const sim = new Simulation(createWorld(seededRandom(5)));
  sim.start();
  const p = sim.match.player,
    b = sim.match.buddy,
    e = sim.match.enemies[0];
  Object.assign(p, { x: 0, y: 0, z: 0, yaw: 0, cooldown: 0 });
  Object.assign(b, { x: 0, y: 0, z: -2 });
  sim.command('cover');
  Object.assign(e, { x: 0, y: 0, z: -7, weapon: 'katana', cooldown: 10 });
  for (let i = 0; i < 45; i++)
    sim.update(1 / 60, { fire: true, yaw: 0, pitch: 0, assist: true });
  assert.ok(e.hp < 100);
  assert.equal(b.hp, 100);
});
void test('victory freezes gameplay and a new match resets the arena', () => {
  const world = createWorld(seededRandom(5));
  const sim = new Simulation(world);
  sim.start();
  sim.match.enemies.forEach((e) => (e.hp = 0));
  sim.update(1 / 60, {});
  assert.equal(sim.status, 'won');
  const t = sim.match.time;
  sim.update(1, {});
  assert.equal(sim.match.time, t);
  const fresh = new Simulation(world);
  fresh.start();
  assert.equal(fresh.status, 'playing');
  assert.equal(fresh.match.enemies.filter((e) => e.hp > 0).length, 10);
});

void test('the buddy actually walks from the lawn onto all five rooftops', () => {
  const world = createWorld(seededRandom(7));
  for (const roof of world.buildings) {
    const sim = new Simulation(world);
    sim.start();
    sim.match.enemies.forEach((e) => (e.hp = 0));
    Object.assign(sim.match.enemies[0], {
      hp: 1e9,
      cooldown: 1e9,
      x: -48,
      y: 0,
      z: -48,
    });
    Object.assign(sim.match.buddy, { x: 0, y: 0, z: 0 });
    Object.assign(sim.match.player, { x: roof.x, y: roof.h, z: roof.z });
    for (let frame = 0; frame < 3600; frame++) sim.update(1 / 60, {});
    const buddy = sim.match.buddy;
    assert.ok(
      Math.abs(buddy.y - roof.h) < 0.1,
      `failed to reach rooftop at ${roof.x},${roof.z}: buddy ${buddy.x},${buddy.y},${buddy.z}`,
    );
    assert.ok(Math.hypot(buddy.x - roof.x, buddy.z - roof.z) < 3.5);
  }
});
