import { Language } from './translations';

// Map our app languages to standard BCP 47 language codes for speech engines
export const LANGUAGE_BCP47_MAP: Record<Language, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
};

/**
 * Stop any ongoing speech synthesis
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak a text string in the specified language using Web Speech API
 */
export function speakText(text: string, lang: Language, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported on this platform/browser.');
    if (onEnd) onEnd();
    return;
  }

  // Cancel any active speaking before starting new one
  stopSpeaking();

  const bcp47 = LANGUAGE_BCP47_MAP[lang] || 'en-US';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47;
  
  // Try to find a high-quality native voice for the selected language
  const voices = window.speechSynthesis.getVoices();
  const matchingVoice = voices.find(
    (voice) => voice.lang.startsWith(bcp47) || voice.lang.includes(bcp47.split('-')[0])
  );
  
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }
  
  // Slower rate is ideal for rural clinics / laymen to understand easily
  utterance.rate = 0.9; 
  utterance.pitch = 1.0;

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Check if browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SpeechRecognition;
}

/**
 * Interface for speech recognition session
 */
export interface SpeechRecognitionSession {
  recognition: any;
  start: () => void;
  stop: () => void;
}

/**
 * Initialize native Speech Recognition for the selected language
 */
export function startSpeechToText(
  lang: Language,
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (error: string) => void
): SpeechRecognitionSession | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError('Speech recognition not supported in this browser.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = LANGUAGE_BCP47_MAP[lang] || 'en-US';

  recognition.onresult = (event: any) => {
    const results = event.results;
    if (results && results.length > 0) {
      const transcript = results[0][0].transcript;
      onResult(transcript);
    }
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    onError(event.error);
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  try {
    recognition.start();
    return {
      recognition,
      start: () => recognition.start(),
      stop: () => recognition.stop(),
    };
  } catch (err: any) {
    console.error('Failed to start speech recognition:', err);
    onError(err.message || 'Error starting voice capture.');
    return null;
  }
}
