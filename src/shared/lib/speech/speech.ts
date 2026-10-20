// Озвучка встроенным синтезом речи браузера (Web Speech API): бесплатно, без сети,
// голоса — системные (iOS, Android, macOS, Windows).

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
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

/** Произнести английское слово или фразу. Вызывать по касанию: iOS не говорит без жеста. */
export function speak(text: string) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  synth.speak(utterance);
}
