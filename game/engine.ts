import * as THREE from 'three';
import { ArenaView, makeWeapon, disposeObject } from './scene';
import {
  createWorld,
  WEAPONS,
  WEAPON_ORDER,
  type WeaponId,
  distance,
} from './rules';
import { Simulation, type GameStatus, type GameEvent } from './simulation';
import { GameInput, type Action } from './input';
import { GameAudio } from './audio';

export type HUD = {
  status: GameStatus;
  hp: number;
  buddyHp: number;
  remaining: number;
  time: number;
  kills: number;
  buddyKills: number;
  weapon: WeaponId;
  mode: 'follow' | 'cover';
  hit: boolean;
  hurt: boolean;
  scoped: boolean;
  touch: boolean;
  muted: boolean;
  toast: string;
  buddyDistance: number;
  spawn: number;
};
type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  max: number;
};
export class GameEngine {
  view: ArenaView;
  sim: Simulation;
  input: GameInput;
  audio = new GameAudio();
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private lastHud = 0;
  private hudStatus: GameStatus = 'menu';
  private weapon: THREE.Group;
  private beams = new Map<number, THREE.Group>();
  private particles: Particle[] = [];
  private kick = 0;
  private hitTimer = 0;
  private hurtTimer = 0;
  private toast = '';
  private toastUntil = 0;
  private disposed = false;
  private minimap: HTMLCanvasElement | null = null;
  private particleGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  private particleMat = new THREE.MeshBasicMaterial({ color: 0xffe4a7 });
  constructor(
    canvas: HTMLCanvasElement,
    private onHud: (hud: HUD) => void,
  ) {
    this.sim = new Simulation(createWorld());
    this.view = new ArenaView(canvas, this.sim.world);
    this.input = new GameInput(canvas, (action, index) =>
      this.action(action, index),
    );
    this.weapon = makeWeapon('laser', true);
    this.view.camera.add(this.weapon);
    this.view.scene.add(this.view.camera);
    this.weapon.visible = false;
    this.view.syncActors([this.sim.match.buddy, ...this.sim.match.enemies], 0);
    this.frame = requestAnimationFrame((t) => this.loop(t));
    this.publish();
    canvas.addEventListener('webglcontextlost', this.contextLost);
  }
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.say('画面暂时中断，请刷新页面重新进入。', 60);
  };
  start() {
    this.clearEffects();
    this.sim = new Simulation(createWorld());
    this.view.setWorld(this.sim.world);
    this.sim.start();
    const p = this.sim.match.player;
    this.input.reset();
    this.input.yaw = Math.atan2(p.x, p.z);
    this.input.pitch = -0.14;
    this.input.enabled = true;
    this.input.scoped = false;
    this.equip('laser');
    this.weapon.visible = true;
    this.audio.unlock();
    this.input.requestLock();
    this.accumulator = 0;
    this.say('阿光：我就在你身边！沿坡道下楼，或者直接跳下去。', 7);
    this.publish();
  }
  pause() {
    if (this.sim.status !== 'playing') return;
    this.sim.pause();
    this.input.enabled = false;
    this.input.reset();
    this.input.releaseLock();
    this.publish();
  }
  resume() {
    if (this.sim.status !== 'paused') return;
    this.sim.resume();
    this.input.enabled = true;
    this.accumulator = 0;
    this.input.requestLock();
    this.audio.unlock();
    this.publish();
  }
  home() {
    this.sim.status = 'menu';
    this.input.enabled = false;
    this.input.reset();
    this.input.releaseLock();
    this.weapon.visible = false;
    this.clearEffects();
    this.publish();
  }
  command() {
    this.sim.command(this.sim.buddyMode === 'follow' ? 'cover' : 'follow');
    this.say(
      this.sim.buddyMode === 'cover'
        ? '阿光：收到！我留在这里，替你掩护。'
        : '阿光：跟上你了，我们一起走！',
      4,
    );
    this.publish();
  }
  equip(id: WeaponId) {
    if (this.weapon) {
      this.view.camera.remove(this.weapon);
      disposeObject(this.weapon);
    }
    this.sim.match.player.weapon = id;
    this.sim.match.player.cooldown = Math.max(
      this.sim.match.player.cooldown,
      0.18,
    );
    this.weapon = makeWeapon(id, true);
    this.weapon.visible = this.sim.status !== 'menu';
    this.view.camera.add(this.weapon);
    this.input.scoped = false;
    this.publish();
  }
  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.audio.unlock();
    this.publish();
  }
  scope() {
    this.input.scoped = !this.input.scoped;
    this.publish();
  }
  jump() {
    if (this.sim.status === 'playing') this.input.jump = true;
  }
  private action(action: Action, index?: number) {
    if (action === 'pause') {
      this.pause();
      return;
    }
    if (this.sim.status !== 'playing') return;
    if (action === 'weapon')
      this.equip(
        WEAPON_ORDER[
          index ?? (WEAPON_ORDER.indexOf(this.sim.match.player.weapon) + 1) % 6
        ],
      );
    if (action === 'command') this.command();
    if (action === 'scope') this.scope();
    if (action === 'jump') this.jump();
  }
  setMinimap(canvas: HTMLCanvasElement | null) {
    this.minimap = canvas;
    if (canvas) this.drawMap();
  }
  private say(text: string, duration: number) {
    this.toast = text;
    this.toastUntil = performance.now() / 1000 + duration;
  }
  snapshot(): HUD {
    const m = this.sim.match;
    return {
      status: this.sim.status,
      hp: Math.ceil(m.player.hp),
      buddyHp: Math.ceil(m.buddy.hp),
      remaining: m.enemies.filter((e) => e.hp > 0).length,
      time: m.time,
      kills: m.player.kills,
      buddyKills: m.buddy.kills,
      weapon: m.player.weapon,
      mode: this.sim.buddyMode,
      hit: this.hitTimer > 0,
      hurt: this.hurtTimer > 0,
      scoped: this.input.scoped,
      touch: this.input.touch,
      muted: this.audio.muted,
      toast: performance.now() / 1000 < this.toastUntil ? this.toast : '',
      buddyDistance: Math.round(distance(m.player, m.buddy)),
      spawn: this.sim.world.spawnBuilding + 1,
    };
  }
  private publish() {
    this.onHud(this.snapshot());
    this.hudStatus = this.sim.status;
  }
  private loop(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.previous || now)) / 1000);
    this.previous = now;
    if (this.sim.status === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) {
        this.sim.update(1 / 60, this.input.sample());
        for (const e of this.sim.events) this.event(e);
        this.accumulator -= 1 / 60;
        if (this.sim.status !== 'playing') {
          this.accumulator = 0;
          break;
        }
      }
      this.hitTimer = Math.max(0, this.hitTimer - dt);
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      this.kick = Math.max(0, this.kick - dt * 4.5);
      this.updateEffects(dt);
      this.syncBeams();
    }
    const m = this.sim.match;
    this.view.syncActors([m.buddy, ...m.enemies], m.time);
    if (this.sim.status === 'menu') this.view.orbit(now * 0.001);
    else {
      const camera = this.view.camera;
      camera.position.set(m.player.x, m.player.y + 1.62, m.player.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(
        this.input.pitch + this.kick * 0.006,
        this.input.yaw,
        0,
      );
      const fov = this.input.scoped
        ? m.player.weapon === 'sniper'
          ? 31
          : 47
        : 68;
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(
          camera.fov,
          fov,
          Math.min(1, dt * 14),
        );
        camera.updateProjectionMatrix();
      }
      this.weapon.position.set(
        this.input.scoped ? 0.06 : 0.32,
        -0.29 - Math.sin(m.time * 2) * 0.003,
        -0.57 + this.kick * 0.055,
      );
      this.weapon.rotation.set(
        this.kick * (WEAPONS[m.player.weapon].melee ? -0.65 : 0.08),
        this.kick * (WEAPONS[m.player.weapon].melee ? 0.6 : 0),
        -0.025 - this.kick * 0.1,
      );
    }
    this.view.render();
    if (this.sim.status !== this.hudStatus) {
      if (this.sim.status === 'won' || this.sim.status === 'lost') {
        this.input.enabled = false;
        this.input.reset();
        this.input.releaseLock();
        if (this.sim.status === 'won') this.audio.tone('win');
      }
      this.publish();
    }
    if (now - this.lastHud > 90) {
      this.publish();
      this.drawMap();
      this.lastHud = now;
    }
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }
  private event(e: GameEvent) {
    if (e.type === 'shot' && e.owner === 'player') {
      this.kick = 1;
      this.audio.tone(
        WEAPONS[e.weapon!].melee
          ? 'swing'
          : e.weapon === 'laser'
            ? 'laser'
            : 'shot',
      );
    }
    if (
      e.type === 'shot' &&
      e.owner !== 'player' &&
      distance(e.point, this.sim.match.player) < 22
    )
      this.audio.tone(e.weapon === 'laser' ? 'laser' : 'shot', 0.25);
    if (e.type === 'hit') {
      if (e.target && e.owner === 'player') {
        this.hitTimer = 0.16;
        this.audio.tone('hit');
      }
      this.burst(e.point, 3);
    }
    if (e.type === 'defeat') {
      this.burst(e.point, 13);
      if (e.owner === 'buddy') this.say('阿光：解决一个！继续前进。', 2.5);
    }
    if (e.type === 'hurt') {
      this.hurtTimer = 0.35;
      this.audio.tone('hurt');
    }
    if (e.type === 'revive')
      this.say('阿光：修复完成，我又可以和你一起战斗了！', 4);
  }
  private syncBeams() {
    const live = new Set(this.sim.projectiles.map((p) => p.id));
    for (const [id, mesh] of this.beams) {
      if (!live.has(id)) {
        this.view.scene.remove(mesh);
        disposeObject(mesh);
        this.beams.delete(id);
      }
    }
    for (const p of this.sim.projectiles) {
      let g = this.beams.get(p.id);
      if (!g) {
        g = new THREE.Group();
        const w = WEAPONS[p.weapon],
          len = w.length;
        const color = p.owner === 'buddy' ? 0x8cfff0 : w.color;
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.065, len),
          new THREE.MeshBasicMaterial({ color }),
        );
        g.add(core);
        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, len + 0.12),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        g.add(glow);
        this.beams.set(p.id, g);
        this.view.scene.add(g);
      }
      g.position.set(p.x, p.y, p.z);
      g.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(p.direction.x, p.direction.y, p.direction.z),
      );
    }
  }
  private burst(p: { x: number; y: number; z: number }, count: number) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 100) break;
      const mesh = new THREE.Mesh(this.particleGeo, this.particleMat);
      mesh.position.set(p.x, p.y, p.z);
      const life = 0.25 + Math.random() * 0.4;
      this.view.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
        life,
        max: life,
      });
    }
  }
  private updateEffects(dt: number) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        this.view.scene.remove(p.mesh);
        return false;
      }
      p.velocity.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(p.life / p.max);
      return true;
    });
  }
  private clearEffects() {
    for (const b of this.beams.values()) {
      this.view.scene.remove(b);
      disposeObject(b);
    }
    this.beams.clear();
    this.particles.forEach((p) => this.view.scene.remove(p.mesh));
    this.particles = [];
    this.hitTimer = 0;
    this.hurtTimer = 0;
    this.kick = 0;
  }
  private drawMap() {
    const canvas = this.minimap;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width,
      scale = w / 108,
      map = (v: number) => (v + 54) * scale;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#263e35';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#ffffff09';
    ctx.lineWidth = 1;
    for (let i = 0; i < 108; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, w);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * scale);
      ctx.lineTo(w, i * scale);
      ctx.stroke();
    }
    for (const b of this.sim.world.buildings) {
      ctx.fillStyle = '#9bad87';
      ctx.fillRect(
        map(b.x - b.w / 2),
        map(b.z - b.d / 2),
        b.w * scale,
        b.d * scale,
      );
      ctx.fillStyle = '#697e60';
      ctx.fillRect(map(b.x + b.w / 2), map(b.z - 2), b.ramp * scale, 4 * scale);
    }
    for (const r of this.sim.world.rocks) {
      ctx.fillStyle = '#6b7d6a';
      ctx.beginPath();
      ctx.arc(map(r.x), map(r.z), r.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    const m = this.sim.match;
    for (const e of m.enemies) {
      if (e.hp <= 0) continue;
      ctx.fillStyle = '#ff9982';
      ctx.beginPath();
      ctx.arc(map(e.x), map(e.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.buddy.hp > 0) {
      ctx.fillStyle = '#79e4d3';
      ctx.beginPath();
      ctx.arc(map(m.buddy.x), map(m.buddy.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = m.player;
    ctx.save();
    ctx.translate(map(p.x), map(p.z));
    ctx.rotate(-p.yaw);
    ctx.fillStyle = '#f0f2bb';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.view.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.input.dispose();
    this.audio.dispose();
    this.clearEffects();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.view.dispose();
  }
}
