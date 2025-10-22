// utils/soundUtils.ts
import { SOUND_SETTINGS } from '../constants/yoga.constants';

export const playSuccessSound = (soundEnabled: boolean) => {
  if (!soundEnabled) return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.type = 'sine';
    osc.frequency.value = SOUND_SETTINGS.frequency;
    gain.gain.setValueAtTime(SOUND_SETTINGS.gain, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + SOUND_SETTINGS.duration
    );

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + SOUND_SETTINGS.duration + 0.05);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
};