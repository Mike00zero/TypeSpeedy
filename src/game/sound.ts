import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const SOURCES = {
  key: require("../../assets/sounds/key.wav"),
  miss: require("../../assets/sounds/miss.wav"),
  word: require("../../assets/sounds/word.wav"),
  timeout: require("../../assets/sounds/timeout.wav"),
  round: require("../../assets/sounds/round.wav"),
  over: require("../../assets/sounds/over.wav"),
};

export type SoundName = keyof typeof SOURCES;

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let muted = false;

export function initSounds() {
  // Respect the silent switch on iOS and mix with other audio, as a game should.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      players[name] = createAudioPlayer(SOURCES[name]);
    } catch {}
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function play(name: SoundName) {
  if (muted) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}
