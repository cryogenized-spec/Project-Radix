
// Language definitions
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

// Extended list for "downloadable" languages
export const EXTRA_LANGUAGES = [
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

class TranslationService {
  private hasNativeAPI: boolean = false;
  private downloadedLanguages: Set<string> = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'zh', 'ru', 'ja']);

  constructor() {
    // Check for Chrome's experimental Translation API
    // @ts-ignore
    if (window.translation) {
      this.hasNativeAPI = true;
    }
  }

  isNativeSupported(): boolean {
    return this.hasNativeAPI;
  }

  getAvailableLanguages() {
    return LANGUAGES.filter(l => this.downloadedLanguages.has(l.code));
  }

  getDownloadableLanguages() {
    return EXTRA_LANGUAGES.filter(l => !this.downloadedLanguages.has(l.code));
  }

  async downloadLanguage(code: string): Promise<void> {
    // Simulate download delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    this.downloadedLanguages.add(code);
    
    // If native API is present, we would trigger the actual download here
    // But since it's experimental and complex to mock perfectly without the browser support,
    // we just manage the list state.
  }

  // Simple stop word based detection for common Latin script languages
  private detectLatinLanguage(text: string): string {
    const words = text.toLowerCase().split(/\s+/).slice(0, 20); // Check first 20 words
    const scores: Record<string, number> = {
      'en': 0, 'es': 0, 'fr': 0, 'de': 0, 'it': 0, 'pt': 0, 'nl': 0
    };

    const STOP_WORDS: Record<string, string[]> = {
      'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'ser', 'se', 'no', 'por', 'con', 'su'],
      'fr': ['le', 'la', 'les', 'de', 'des', 'un', 'une', 'et', 'est', 'pas', 'que', 'qui'],
      'de': ['der', 'die', 'das', 'und', 'sein', 'in', 'ein', 'zu', 'haben', 'ich', 'nicht'],
      'it': ['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'da', 'in', 'su', 'per', 'con'],
      'pt': ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para'],
      'nl': ['de', 'het', 'een', 'en', 'van', 'ik', 'te', 'dat', 'die', 'in', 'is'],
      'en': ['the', 'is', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it', 'for', 'not']
    };

    for (const word of words) {
      for (const [lang, stopWords] of Object.entries(STOP_WORDS)) {
        if (stopWords.includes(word.replace(/[^\w]/g, ''))) {
          scores[lang]++;
        }
      }
    }

    // Find highest score
    let maxScore = 0;
    let detected = 'en'; // Default to English

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detected = lang;
      }
    }

    return detected;
  }

  private detectLanguage(text: string): string {
    // 1. Check scripts
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    
    // 2. If Latin, try to guess based on stop words
    return this.detectLatinLanguage(text);
  }

  async translate(text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> {
    // Resolve auto source language
    let resolvedSource = sourceLang;
    if (sourceLang === 'auto') {
        resolvedSource = this.detectLanguage(text);
        console.log(`[Translation] Detected language: ${resolvedSource} for text: "${text.substring(0, 20)}..."`);
    }

    // 1. Try Native Chrome AI API
    if (this.hasNativeAPI) {
      try {
        // @ts-ignore
        const canTranslate = await window.translation.canTranslate({
          sourceLanguage: resolvedSource,
          targetLanguage: targetLang,
        });

        if (canTranslate !== 'no') {
          // @ts-ignore
          const translator = await window.translation.createTranslator({
            sourceLanguage: resolvedSource,
            targetLanguage: targetLang,
          });
          return await translator.translate(text);
        }
      } catch (e) {
        console.warn('Native translation failed, falling back to API', e);
      }
    }

    // 2. Fallback to Free API (MyMemory)
    // Note: This is a free API and has rate limits/limitations.
    try {
      const pair = `${resolvedSource}|${targetLang}`;
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`);
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        return data.responseData.translatedText;
      } else {
        // If we failed with a specific pair (maybe detection was wrong), try English as source if we didn't already
        if (resolvedSource !== 'en' && (data.responseDetails || '').includes('INVALID SOURCE')) {
             console.warn('Retrying translation with source=en');
             const retryPair = `en|${targetLang}`;
             const retryResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${retryPair}`);
             const retryData = await retryResponse.json();
             if (retryData.responseStatus === 200) {
                 return retryData.responseData.translatedText;
             }
        }
        throw new Error(data.responseDetails || 'Translation failed');
      }
    } catch (e) {
      console.error('Translation API error:', e);
      return `[Translation Error] ${text}`;
    }
  }
}

export const translationService = new TranslationService();
