// On-screen touch controls, shown only on touch devices, mirroring the
// keyboard's ArrowLeft/ArrowRight/ArrowUp/Space handling in main.ts.

export function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
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
