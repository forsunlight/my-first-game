import type { Controls } from './simulation';
export type Action = 'pause' | 'weapon' | 'command' | 'jump' | 'scope';
export class GameInput {
  enabled = false;
  fire = false;
  jump = false;
  yaw = 0;
  pitch = -0.1;
  scoped = false;
  touch =
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0;
  private keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private lookId: number | null = null;
  private look = { x: 0, y: 0 };
  private locked = false;
  private cleanup: (() => void)[] = [];
  constructor(
    private canvas: HTMLCanvasElement,
    private action: (action: Action, index?: number) => void,
  ) {
    const listen = <K extends keyof DocumentEventMap>(
      type: K,
      fn: (e: DocumentEventMap[K]) => void,
    ) => {
      document.addEventListener(type, fn);
      this.cleanup.push(() => document.removeEventListener(type, fn));
    };
    listen('keydown', (e) => {
      if (!this.enabled) return;
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Tab',
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.jump = true;
      if (e.code === 'KeyQ') action('weapon');
      if (e.code === 'KeyC') action('command');
      if (e.code === 'Escape' || e.code === 'KeyP') action('pause');
      if (e.code === 'KeyE') action('scope');
      if (/^Digit[1-6]$/.test(e.code))
        action('weapon', Number(e.code.slice(-1)) - 1);
    });
    listen('keyup', (e) => this.keys.delete(e.code));
    listen('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.enabled) action('pause');
    });
    listen('mousemove', (e) => {
      if (this.enabled && this.locked) this.rotate(e.movementX, e.movementY);
    });
    const down = (e: PointerEvent) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (e.pointerType === 'mouse') {
        if (e.button === 2) {
          action('scope');
          return;
        }
        if (e.button !== 0) return;
        this.fire = true;
        this.requestLock();
      }
      if (!this.locked) {
        this.lookId = e.pointerId;
        this.look = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (this.enabled && !this.locked && this.lookId === e.pointerId) {
        this.rotate(e.clientX - this.look.x, e.clientY - this.look.y);
        this.look = { x: e.clientX, y: e.clientY };
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.fire = false;
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const context = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', context);
    const blur = () => {
      this.reset();
      if (this.enabled) action('pause');
    };
    window.addEventListener('blur', blur);
    const hidden = () => {
      if (document.hidden) blur();
    };
    document.addEventListener('visibilitychange', hidden);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    });
  }
  rotate(dx: number, dy: number) {
    const sensitivity = this.scoped ? 0.0011 : 0.0033;
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - dy * sensitivity));
  }
  requestLock() {
    if (
      this.touch ||
      !this.enabled ||
      document.pointerLockElement === this.canvas
    )
      return;
    try {
      const result = this.canvas.requestPointerLock?.();
      result?.catch(() => {});
    } catch {
      /* Drag-to-look remains available when pointer lock is unsupported. */
    }
  }
  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  reset() {
    this.keys.clear();
    this.fire = false;
    this.jump = false;
    this.joystick = { x: 0, y: 0 };
    this.lookId = null;
  }
  sample(): Controls {
    const k = this.keys;
    const result = {
      forward:
        (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) -
        (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) -
        this.joystick.y,
      strafe:
        (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
        (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) +
        this.joystick.x,
      yaw: this.yaw,
      pitch: this.pitch,
      fire: this.fire,
      jump: this.jump,
      assist: true,
    };
    this.jump = false;
    return result;
  }
  bindJoystick(element: HTMLElement, knob: HTMLElement) {
    let active: number | null = null;
    let origin = { x: 0, y: 0 };
    const update = (e: PointerEvent) => {
      const dx = e.clientX - origin.x,
        dy = e.clientY - origin.y,
        max = element.clientWidth * 0.32;
      const mag = Math.hypot(dx, dy),
        scale = mag > max ? max / mag : 1;
      this.joystick = { x: (dx * scale) / max, y: (dy * scale) / max };
      knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    };
    const down = (e: PointerEvent) => {
      if (active !== null) return;
      e.preventDefault();
      e.stopPropagation();
      active = e.pointerId;
      const rect = element.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      element.setPointerCapture(e.pointerId);
      update(e);
    };
    const move = (e: PointerEvent) => {
      if (active === e.pointerId) {
        e.preventDefault();
        update(e);
      }
    };
    const end = (e: PointerEvent) => {
      if (active === e.pointerId) {
        active = null;
        this.joystick = { x: 0, y: 0 };
        knob.style.transform = 'translate(0px, 0px)';
      }
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', end);
      element.removeEventListener('pointercancel', end);
      element.removeEventListener('lostpointercapture', end);
      this.joystick = { x: 0, y: 0 };
    };
  }
  dispose() {
    this.enabled = false;
    this.releaseLock();
    this.reset();
    this.cleanup.forEach((fn) => fn());
  }
}
