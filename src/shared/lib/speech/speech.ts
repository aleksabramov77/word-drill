// Озвучка встроенным синтезом речи браузера (Web Speech API): бесплатно, без сети,
// голоса — системные (iOS, Android, macOS, Windows).
//
// Первое слово раньше звучало с запинкой: список голосов браузер отдаёт не сразу, а движок речи
// загружается на первой фразе. Поэтому голоса грузим при запуске, движок «разогреваем» беззвучной
// фразой по первому касанию, а слово ждёт, пока голос готов.

/** Дольше голоса не ждём: говорим голосом по умолчанию. */
const VOICES_TIMEOUT_MS = 1500;

let voicesReady: Promise<void> | null = null;
let warmedUp = false;

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Голоса загружены (или ждать больше нечего). */
function loadVoices(): Promise<void> {
  if (voicesReady) return voicesReady;
  const synth = window.speechSynthesis;
  voicesReady = new Promise((resolve) => {
    if (synth.getVoices().length > 0) return resolve();
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, VOICES_TIMEOUT_MS);
    synth.addEventListener("voiceschanged", done);
  });
  return voicesReady;
}

/** Пустая фраза: iOS разрешает речь только после жеста, а движок успевает загрузиться заранее. */
function warmUp() {
  if (warmedUp) return;
  warmedUp = true;
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}

/** Подготовить озвучку при запуске приложения: голоса сразу, движок — по первому касанию. */
export function prepareSpeech() {
  if (!canSpeak()) return;
  loadVoices();
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
    warmUp();
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}

/** Лучший английский голос: сначала американский, потом любой английский. */
function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US" && v.localService) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

/**
 * Произнести английское слово или фразу. Вызывать по касанию: iOS не говорит без жеста.
 * Промис выполняется, когда голос начал говорить (или не смог) — до этого кнопка показывает ожидание.
 */
export async function speak(text: string): Promise<void> {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  // Ещё в жесте: дальше будет ожидание голосов, а после него iOS может уже не дать говорить.
  warmUp();
  if (synth.speaking || synth.pending) synth.cancel();
  await loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  await new Promise<void>((resolve) => {
    utterance.onstart = () => resolve();
    utterance.onerror = () => resolve();
    utterance.onend = () => resolve();
    synth.speak(utterance);
  });
}

/** Для тестов: забыть загруженные голоса и разогрев. */
export function resetSpeechForTests() {
  voicesReady = null;
  warmedUp = false;
}
