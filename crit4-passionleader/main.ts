import { AudioEngine } from "./audio-engine.ts";
import { mountInstrument } from "./ui.ts";

const root = document.querySelector<HTMLElement>(".app");
if (!root) {
  throw new Error("Missing .app root element.");
}

mountInstrument(root, new AudioEngine());
