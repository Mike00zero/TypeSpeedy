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
  victoryModern: require("../../assets/music/victory-modern.wav"),
};

/**
 * Two soundtracks: chiptune for the Retro look and a synth score for the Modern look
 * (see scripts/make-music.mjs and scripts/make-music-modern.mjs).
 */
const MUSIC_SOURCES = {
  retro: {
    main: require("../../assets/music/music-main.wav"),
    boss: require("../../assets/music/music-boss.wav"),
  },
  modern: {
    main: require("../../assets/music/music-main-modern.wav"),
    boss: require("../../assets/music/music-boss-modern.wav"),
  },
};

export type SoundName = keyof typeof SOURCES;
export type MusicTrack = "main" | "boss";
export type MusicStyle = keyof typeof MUSIC_SOURCES;

const MUSIC_VOLUME = 0.35; // music sits under the sound effects
const CHECK_AFTER_MS = 450; // if a track still isn't playing this long after starting it, start it again

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let musicPlayers: Partial<Record<`${MusicStyle}:${MusicTrack}`, AudioPlayer>> = {};
let musicStyle: MusicStyle = "modern";
const musicPlayer = (track: MusicTrack) => musicPlayers[`${musicStyle}:${track}`];
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
  for (const style of Object.keys(MUSIC_SOURCES) as MusicStyle[]) {
    for (const track of ["main", "boss"] as MusicTrack[]) {
      try {
        const p = createAudioPlayer(MUSIC_SOURCES[style][track]);
        p.loop = true;
        p.volume = MUSIC_VOLUME;
        musicPlayers[`${style}:${track}`] = p;
      } catch {}
    }
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
  if (m) {
    players.victory?.pause();
    players.victoryModern?.pause();
  }
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
  const p = musicPlayer(track);
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
  const p = track ? musicPlayer(track) : null;
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
  const p = musicStyle === "modern" ? players.victoryModern : players.victory;
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

/** Picks the soundtrack to match the look; whatever is playing switches over from the top. */
export function setMusicStyle(style: MusicStyle) {
  if (style === musicStyle) return;
  musicStyle = style;
  musicRequest++;
  stopLoops();
  startCurrent(true);
}

export function setMusicEnabled(on: boolean) {
  musicOn = on;
  musicRequest++;
  if (!on) stopLoops();
  else startCurrent(false);
}
