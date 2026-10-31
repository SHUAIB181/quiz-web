// Small touches of feedback: a phone vibration and an optional tick sound.
// The sound is OFF until the student turns it on with the speaker button.

let audio;

export const isSoundOn = () => {
  try {
    return localStorage.getItem("examSound") === "on";
  } catch (error) {
    return false;
  }
};

export const setSoundOn = (on) => {
  try {
    localStorage.setItem("examSound", on ? "on" : "off");
  } catch (error) {
    // storage can be blocked; the toggle just will not be remembered
  }
};

// A very short, soft click made with the browser's own audio (no sound files)
export const tick = (force = false) => {
  if (!force && !isSoundOn()) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    audio = audio || new AudioContext();
    if (audio.state === "suspended") audio.resume();

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) {
    // no sound is fine
  }
};

// A tiny buzz on phones that support it (Android; iPhones ignore it)
export const buzz = (ms = 10) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};