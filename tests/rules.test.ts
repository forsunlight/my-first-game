import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  seededRandom,
  surfaceAt,
  findPath,
  canMove,
  traceShot,
  createMatch,
  applyDamage,
  outcome,
  WEAPONS,
} from '../game/rules.ts';

void test('random roof spawn and enemies are safe across seeds', () => {
  const roofs = new Set<number>();
  for (let seed = 1; seed <= 50; seed++) {
    const world = createWorld(seededRandom(seed));
    const match = createMatch(world);
    roofs.add(world.spawnBuilding);
    assert.equal(
      match.player.y,
      surfaceAt(world, match.player.x, match.player.z),
    );
    assert.ok(match.player.y >= 4);
    assert.equal(match.enemies.length, 10);
    assert.equal(new Set(match.enemies.map((e) => e.weapon)).size, 5);
    for (const actor of match.enemies) {
      assert.equal(surfaceAt(world, actor.x, actor.z), 0);
      assert.ok(canMove(world, actor, actor.x, actor.z));
      assert.equal(actor.radius, match.player.radius);
    }
  }
  assert.equal(roofs.size, 5);
});

void test('AI can climb from the lawn to every rooftop by walkable steps', () => {
  const world = createWorld(seededRandom(7));
  for (const b of world.buildings) {
    const path = findPath(
      world,
      { x: 0, y: 0, z: 0 },
      { x: b.x, y: b.h, z: b.z },
    );
    assert.ok(path.length > 0, 'rooftop must be reachable');
    let previous = { x: 0, y: 0, z: 0 };
    for (const point of path) {
      assert.ok(
        Math.abs(point.y - previous.y) <= 1.1,
        'no walking through a vertical wall',
      );
      previous = point;
    }
    assert.ok(Math.hypot(previous.x - b.x, previous.z - b.z) < 2);
  }
});

void test('walls block movement from ground while rooftops remain walkable', () => {
  const world = createWorld(seededRandom(2));
  const b = world.buildings[0];
  assert.equal(canMove(world, { y: 0, radius: 0.4 }, b.x, b.z), false);
  assert.equal(canMove(world, { y: b.h, radius: 0.4 }, b.x, b.z), true);
});

void test('a shot hits a visible enemy but cannot pass through a building', () => {
  const world = createWorld(seededRandom(2));
  const m = createMatch(world);
  const enemy = { ...m.enemies[0], x: 0, y: 0, z: -8 };
  assert.equal(
    traceShot(world, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, [enemy], 50)
      ?.actor?.id,
    enemy.id,
  );
  const b = world.buildings[0];
  enemy.x = b.x;
  enemy.z = b.z - b.d / 2 - 3;
  assert.equal(
    traceShot(
      world,
      { x: b.x, y: 1, z: b.z + b.d / 2 + 3 },
      { x: 0, y: 0, z: -1 },
      [enemy],
      50,
    )?.actor,
    undefined,
  );
});

void test('melee cannot hit a distant enemy and laser has separated pulse timing', () => {
  const world = createWorld(seededRandom(2));
  const enemy = { ...createMatch(world).enemies[0], x: 0, y: 0, z: -8 };
  assert.equal(
    traceShot(
      world,
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: -1 },
      [enemy],
      WEAPONS.katana.range,
    )?.actor,
    undefined,
  );
  assert.ok(
    WEAPONS.laser.speed * WEAPONS.laser.interval > WEAPONS.laser.length,
  );
});

void test('friendly fire does no damage; wins and losses are terminal', () => {
  const m = createMatch(createWorld(seededRandom(2)));
  applyDamage(m.buddy, 100, m.player.team);
  assert.equal(m.buddy.hp, 100);
  assert.equal(outcome(m), 'playing');
  m.enemies.forEach((e) => applyDamage(e, 1000, m.player.team));
  assert.equal(outcome(m), 'won');
  applyDamage(m.player, 1000, 'enemy');
  assert.equal(outcome(m), 'lost');
});
