import THREE from './three.js';
import { clamp } from './math.js';

/** Keyboard camera translation, arrow-key orbit, drag orbit and wheel dolly. */
export class ForestControls {
  constructor(camera, canvas, onClick) {
    this.camera = camera; this.canvas = canvas; this.keys = new Set();
    this.target = new THREE.Vector3(0, 4.1, 0); this.theta = .69; this.phi = 1.08; this.radius = 78;
    this.drag = null; this.tour = false; this.onClick = onClick;
    this.initial = { theta: this.theta, phi: this.phi, radius: this.radius, target: this.target.clone() };
    window.addEventListener('keydown', e => {
      if (this.isEditing(e.target) || document.querySelector('dialog[open]')) return;
      const relevant = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'];
      if (relevant.includes(e.code)) { e.preventDefault(); this.keys.add(e.code); this.tour = false; }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.keys.clear(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      this.tour = false; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.theta -= dx * .005; this.phi = clamp(this.phi - dy * .004, .2, 1.48);
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved ||= Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 5;
    });
    const release = e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const clicked = !this.drag.moved && e.type === 'pointerup';
      this.drag = null; canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (clicked) this.onClick();
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.radius = clamp(this.radius * Math.exp(e.deltaY * .001), 13, 115); this.tour = false; }, { passive: false });
    this.update(0);
  }
  isEditing(target) { return target instanceof HTMLElement && (target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(target.tagName)); }
  reset() { this.theta = this.initial.theta; this.phi = this.initial.phi; this.radius = this.initial.radius; this.target.copy(this.initial.target); this.tour = false; this.keys.clear(); this.update(0); }
  closeView() { this.radius = 38; this.phi = 1.20; this.theta = .50; this.target.set(0, 4.5, 3); this.tour = false; this.update(0); }
  update(dt) {
    const k = this.keys, speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 18 : 7.5) * dt;
    let forward = Number(k.has('KeyW')) - Number(k.has('KeyS'));
    let right = Number(k.has('KeyD')) - Number(k.has('KeyA'));
    const length = Math.hypot(forward, right);
    if (length > 1) { forward /= length; right /= length; }
    this.target.x += (-Math.sin(this.theta) * forward + Math.cos(this.theta) * right) * speed;
    this.target.z += (-Math.cos(this.theta) * forward - Math.sin(this.theta) * right) * speed;
    this.target.y += (Number(k.has('KeyE')) - Number(k.has('KeyQ'))) * speed;
    this.target.x = clamp(this.target.x, -25, 25); this.target.z = clamp(this.target.z, -25, 25); this.target.y = clamp(this.target.y, .4, 20);
    this.theta += (Number(k.has('ArrowLeft')) - Number(k.has('ArrowRight'))) * dt * .85;
    this.phi = clamp(this.phi + (Number(k.has('ArrowDown')) - Number(k.has('ArrowUp'))) * dt * .65, .2, 1.48);
    if (this.tour) this.theta += dt * .085;
    const r = this.radius * Math.sin(this.phi);
    this.camera.position.set(this.target.x + Math.sin(this.theta) * r, this.target.y + this.radius * Math.cos(this.phi), this.target.z + Math.cos(this.theta) * r);
    this.camera.lookAt(this.target);
  }
}
