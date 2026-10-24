import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareSpeech, resetSpeechForTests, speak } from "./index.ts";

class FakeUtterance {
  lang = "";
  rate = 1;
  volume = 1;
  voice?: { name: string };
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
  constructor(public text: string) {}
}

/** Синтез речи, у которого голоса появляются не сразу — как в Safari и Chrome. */
function fakeSynth() {
  const spoken: { text: string; voice?: string; volume: number }[] = [];
  let voices: { lang: string; name: string; localService: boolean }[] = [];
  const listeners = new Set<() => void>();
  const windowListeners = new Map<string, () => void>();
  const synth = {
    speaking: false,
    pending: false,
    cancel: vi.fn(),
    getVoices: () => voices,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    speak: (u: FakeUtterance) => {
      spoken.push({ text: u.text, voice: u.voice?.name, volume: u.volume });
      queueMicrotask(() => u.onstart?.());
    },
  };
  return {
    spoken,
    window: {
      speechSynthesis: synth,
      addEventListener: (type: string, fn: () => void) =>
        windowListeners.set(type, fn),
      removeEventListener: (type: string) => windowListeners.delete(type),
    },
    loadVoices() {
      voices = [{ lang: "en-US", name: "Samantha", localService: true }];
      for (const fn of [...listeners]) fn();
    },
    tap: () => windowListeners.get("pointerdown")?.(),
  };
}

describe("озвучка", () => {
  let fake: ReturnType<typeof fakeSynth>;
  beforeEach(() => {
    resetSpeechForTests();
    fake = fakeSynth();
    vi.stubGlobal("window", fake.window);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("первое слово ждёт голоса и звучит выбранным голосом, после беззвучного разогрева", async () => {
    const done = speak("blood");
    expect(fake.spoken).toEqual([{ text: "", voice: undefined, volume: 0 }]);
    fake.loadVoices();
    await done;
    expect(fake.spoken[1]).toEqual({
      text: "blood",
      voice: "Samantha",
      volume: 1,
    });
  });

  it("разогрев — один раз, по первому касанию экрана", async () => {
    prepareSpeech();
    fake.tap();
    fake.loadVoices();
    await speak("blood");
    expect(fake.spoken.map((s) => s.text)).toEqual(["", "blood"]);
  });

  it("голоса так и не пришли — говорит голосом по умолчанию", async () => {
    vi.useFakeTimers();
    const done = speak("blood");
    await vi.advanceTimersByTimeAsync(1500);
    await done;
    expect(fake.spoken[1]).toMatchObject({ text: "blood", voice: undefined });
  });
});
