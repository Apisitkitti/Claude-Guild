import { useCallback, useEffect, useRef, useState } from "react";

import { Sfx } from "@/lib/office/audio";

import type { OfficeRef } from "../types";

const ON_KEY = "guild.sound";
const VOLUME_KEY = "guild.soundVolume";
const DEFAULT_VOLUME = 0.6;
const DRAIN_MS = 100;

export type Sound = { on: boolean; volume: number; toggle: () => void; setVolume: (volume: number) => void };

const readStored = (): { on: boolean; volume: number } => {
  try {
    const volume = Number(localStorage.getItem(VOLUME_KEY));
    return {
      on: localStorage.getItem(ON_KEY) === "1",
      volume: Number.isFinite(volume) && localStorage.getItem(VOLUME_KEY) !== null ? volume : DEFAULT_VOLUME,
    };
  } catch {
    return { on: false, volume: DEFAULT_VOLUME };
  }
};

const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

/**
 * Chiptune sound, off by default. The AudioContext is only created from the toggle click (a user gesture); after a
 * reload the saved "on" waits for the first click/key press anywhere before it makes any noise. While off the engine's
 * cue queue is cleared so nothing piles up.
 */
export const useSound = (officeRef: OfficeRef): Sound => {
  const [on, setOn] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const sfxRef = useRef<Sfx | null>(null);

  const getSfx = useCallback(() => (sfxRef.current ??= new Sfx()), []);
  const toggle = useCallback(() => {
    const next = !on;
    store(ON_KEY, next ? "1" : "0");
    if (next) getSfx().start(); // inside the click: this is the user gesture that allows audio
    setOn(next);
  }, [on, getSfx]);
  const setVolume = useCallback(
    (next: number) => {
      setVolumeState(next);
      store(VOLUME_KEY, String(next));
      getSfx().setVolume(next);
    },
    [getSfx],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStored();
      setOn(stored.on);
      setVolumeState(stored.volume);
      getSfx().setVolume(stored.volume);
    });
  }, [getSfx]);

  useEffect(() => {
    if (!on) return;
    // a saved "on" after reload: browsers only let audio start after a gesture, so start on the first one
    const sfx = getSfx();
    const unlock = () => sfx.start();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [on, getSfx]);

  useEffect(() => {
    const sfx = getSfx();
    const timer = setInterval(() => {
      const office = officeRef.current;
      if (!office) return;
      if (!on || !sfx.started || document.hidden) {
        office.sfxQueue.length = 0;
        sfx.setAmbient(null);
        return;
      }
      for (const cue of office.sfxQueue.splice(0)) sfx.play(cue);
      sfx.setAmbient(office.scene === "dungeon" ? "dungeon" : office.bardOn ? "tavern" : null);
      sfx.tick();
    }, DRAIN_MS);
    return () => {
      clearInterval(timer);
      sfx.setAmbient(null);
    };
  }, [on, officeRef, getSfx]);

  useEffect(() => {
    if (!on) sfxRef.current?.stop();
  }, [on]);

  useEffect(() => () => sfxRef.current?.stop(), []); // unmount: release the AudioContext

  return { on, volume, toggle, setVolume };
};
