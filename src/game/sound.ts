import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const SOURCES = {
  key: require("../../assets/sounds/key.wav"),
  miss: require("../../assets/sounds/miss.wav"),
  word: require("../../assets/sounds/word.wav"),
  timeout: require("../../assets/sounds/timeout.wav"),
  round: require("../../assets/sounds/round.wav"),
  over: require("../../assets/sounds/over.wav"),
  achieve: require("../../assets/sounds/achieve.wav"),
  victory: require("../../assets/music/victory.wav"),
};

const MUSIC_SOURCES = {
  main: require("../../assets/music/music-main.wav"),
  boss: require("../../assets/music/music-boss.wav"),
};

export type SoundName = keyof typeof SOURCES;
export type MusicTrack = keyof typeof MUSIC_SOURCES;

const MUSIC_VOLUME = 0.35; // music sits under the sound effects
const CHECK_AFTER_MS = 450; // if a track still isn't playing this long after starting it, start it again

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let musicPlayers: Partial<Record<MusicTrack, AudioPlayer>> = {};
let muted = false; // sound effects
let musicOn = true;
let currentTrack: MusicTrack | null = null; // what should be playing (even while paused or turned off)
let musicPaused = false;
let musicRequest = 0; // bumps on every music change, so a slow start can't override a newer one

export function initSounds() {
  // Respect the silent switch on iOS and mix with other audio, as a game should.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      players[name] = createAudioPlayer(SOURCES[name]);
    } catch {}
  }
  for (const track of Object.keys(MUSIC_SOURCES) as MusicTrack[]) {
    try {
      const p = createAudioPlayer(MUSIC_SOURCES[track]);
      p.loop = true;
      p.volume = MUSIC_VOLUME;
      musicPlayers[track] = p;
    } catch {}
  }
}

/**
 * Rewinds and plays. On phones, rewinding finishes a moment after it's asked for, and calling
 * play() before then can leave a sound that already played to the end silent. So wait for the
 * rewind, then play.
 */
async function restart(p: AudioPlayer, stillWanted: () => boolean = () => true) {
  try {
    await p.seekTo(0);
  } catch {}
  if (!stillWanted()) return;
  try {
    p.play();
  } catch {}
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) players.victory?.pause();
}

export function play(name: SoundName) {
  if (muted) return;
  const p = players[name];
  if (!p) return;
  restart(p);
}

/* ---------- music ---------- */

function stopLoops() {
  for (const p of Object.values(musicPlayers)) {
    try {
      p?.pause();
    } catch {}
  }
}

function startCurrent(fromStart: boolean) {
  if (!musicOn || musicPaused || !currentTrack) return;
  const track = currentTrack;
  const p = musicPlayers[track];
  if (!p) return;
  const request = ++musicRequest;
  const stillWanted = () => request === musicRequest && musicOn && !musicPaused && currentTrack === track;
  p.loop = true;
  p.volume = MUSIC_VOLUME;
  if (fromStart) restart(p, stillWanted);
  else {
    try {
      p.play();
    } catch {}
  }
  // Safety net: if the track didn't actually start, start it again.
  setTimeout(() => {
    if (!stillWanted() || p.playing) return;
    try {
      p.play();
    } catch {}
  }, CHECK_AFTER_MS);
}

/** Switches the background loop ("main", "boss", or null for silence). Same track keeps playing. */
export function playMusic(track: MusicTrack | null) {
  const p = track ? musicPlayers[track] : null;
  if (track === currentTrack && !musicPaused && (!p || p.playing || !musicOn)) return;
  const changed = track !== currentTrack;
  musicRequest++; // cancel any start still in flight
  stopLoops();
  currentTrack = track;
  musicPaused = false;
  startCurrent(changed);
}

export function pauseMusic() {
  musicPaused = true;
  musicRequest++;
  stopLoops();
}

export function resumeMusic() {
  if (!musicPaused) return;
  musicPaused = false;
  startCurrent(false);
}

/** Stops the loop and plays the boss-victory fanfare (a sound effect, so it follows the Sound toggle). */
export function playVictory() {
  musicRequest++;
  stopLoops();
  currentTrack = null;
  if (muted) return;
  const p = players.victory;
  if (!p) return;
  restart(p);
  setTimeout(() => {
    if (!muted && !p.playing && p.currentTime < 0.2) {
      try {
        p.play();
      } catch {}
    }
  }, CHECK_AFTER_MS);
}

export function setMusicEnabled(on: boolean) {
  musicOn = on;
  musicRequest++;
  if (!on) stopLoops();
  else startCurrent(false);
}
