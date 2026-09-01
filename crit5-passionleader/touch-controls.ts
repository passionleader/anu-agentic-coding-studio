// On-screen touch controls, shown only on phone-sized touch devices,
// mirroring the keyboard's ArrowLeft/ArrowRight/ArrowUp/Space handling in
// main.ts. A touch-capable but wide viewport (a touchscreen laptop, a
// tablet in landscape) keeps the keyboard-only layout instead --- 899px
// matches the site's own mobile/desktop breakpoint in styles.css.
export function isTouchDevice(): boolean {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isPhoneSized = window.matchMedia("(max-width: 899px)").matches;
  return hasTouch && isPhoneSized;
}

function bind(button: HTMLElement, onDown: () => void, onUp?: () => void): void {
  button.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      onDown();
    },
    { passive: false },
  );
  if (onUp) {
    button.addEventListener("pointerup", onUp);
    button.addEventListener("pointercancel", onUp);
    button.addEventListener("pointerleave", onUp);
  }
}

export function setupTouchControls(keys: Set<string>, fire: () => void, jump: () => void): void {
  const left = document.querySelector<HTMLElement>("#touch-left");
  const right = document.querySelector<HTMLElement>("#touch-right");
  const jumpBtn = document.querySelector<HTMLElement>("#touch-jump");
  const fireBtn = document.querySelector<HTMLElement>("#touch-fire");
  if (!left || !right || !jumpBtn || !fireBtn) return;

  bind(
    left,
    () => keys.add("ArrowLeft"),
    () => keys.delete("ArrowLeft"),
  );
  bind(
    right,
    () => keys.add("ArrowRight"),
    () => keys.delete("ArrowRight"),
  );
  bind(jumpBtn, () => jump());
  bind(fireBtn, () => fire());
}
