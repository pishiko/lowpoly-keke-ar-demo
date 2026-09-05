export function createControls({ joystick, knob, onAction, onInteract }) {
  const keys = new Set();
  const stick = { x: 0, y: 0 };
  let pointer = null, previousButtons = [], gamepadId = null;
  const map = { Digit1: 'squish', Digit2: 'jump', Digit3: 'fall', Digit4: 'spin', Space: 'jump' };
  const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const blocked = () => document.hidden || !!document.querySelector('dialog[open]');
  function release() {
    if (pointer !== null && joystick.hasPointerCapture(pointer)) joystick.releasePointerCapture(pointer);
    pointer = null; stick.x = stick.y = 0; knob.style.transform = ''; keys.clear();
  }
  function drag(event) {
    if (event.pointerId !== pointer) return;
    const rect = joystick.getBoundingClientRect(), radius = rect.width * 0.29;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    stick.x = x; stick.y = -y;
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  }
  joystick.addEventListener('pointerdown', (event) => {
    if (pointer !== null || blocked()) return;
    event.preventDefault(); onInteract(); pointer = event.pointerId;
    joystick.setPointerCapture(pointer); drag(event);
  });
  joystick.addEventListener('pointermove', drag);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, (event) => { if (event.pointerId === pointer) release(); });
  window.addEventListener('keydown', (event) => {
    if (blocked() || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (movementKeys.includes(event.code) || map[event.code]) {
      if (event.code === 'Space' && event.target.closest('button, a')) return;
      event.preventDefault(); onInteract(); keys.add(event.code);
      if (!event.repeat && map[event.code]) onAction(map[event.code]);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', release);
  return {
    release,
    read() {
      if (blocked()) { release(); previousButtons = []; return { x: 0, y: 0 }; }
      let x = stick.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let y = stick.y + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      let pad;
      try { pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected && p.mapping === 'standard'); } catch { /* Restricted embedding can disable gamepads. */ }
      if (pad) {
        if (gamepadId !== pad.index) previousButtons = [];
        gamepadId = pad.index;
        const deadzone = (v) => Math.abs(v) < 0.16 ? 0 : Math.sign(v) * (Math.abs(v) - 0.16) / 0.84;
        x += deadzone(pad.axes[0] ?? 0); y -= deadzone(pad.axes[1] ?? 0);
        ['jump', 'squish', 'fall', 'spin'].forEach((action, i) => { if (pad.buttons[i]?.pressed && !previousButtons[i]) { onInteract(); onAction(action); } });
        previousButtons = pad.buttons.map((b) => b.pressed);
      } else { previousButtons = []; gamepadId = null; }
      const length = Math.max(1, Math.hypot(x, y));
      return { x: x / length, y: y / length };
    },
  };
}
