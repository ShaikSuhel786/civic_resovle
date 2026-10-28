// Civic Resolve AI: Voice-Based Civic Assistant Module (PRD F6)
// Provides bilingual (English and Telugu) Speech-to-Text (STT) dictation and Text-to-Speech (TTS) readouts.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CivicVoice = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {

  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const isSpeechSupported = Boolean(SpeechRecognition);
  const isTtsSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);

  let currentLang = 'en-IN'; // Default: English (India). Alternative: 'te-IN' (Telugu)
  let activeRecognition = null;
  let activeListeningButton = null;
  let activeStatusEl = null;

  const MESSAGES = {
    'en-IN': {
      listening: '🎙️ Listening... Speak now',
      stop: 'Stop Listening',
      notSupported: 'Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.',
      permissionDenied: 'Microphone permission was denied. Please allow microphone access in your browser settings.',
      noSpeech: 'No speech detected. Please try speaking again.',
      ttsReading: '🔊 Reading aloud...',
      ttsFinished: 'Finished reading',
      ttsStopped: 'Audio stopped'
    },
    'te-IN': {
      listening: '🎙️ వింటున్నాను... ఇప్పుడు మాట్లాడండి',
      stop: 'ఆపండి',
      notSupported: 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ సపోర్ట్ చేయదు. దయచేసి Chrome లేదా Edge ఉపయోగించండి.',
      permissionDenied: 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి బ్రౌజర్ సెట్టింగ్‌లలో మైక్ అనుమతించండి.',
      noSpeech: 'మాటలు గుర్తించబడలేదు. దయచేసి మళ్లీ మాట్లాడండి.',
      ttsReading: '🔊 చదువుతున్నాము...',
      ttsFinished: 'పూర్తయింది',
      ttsStopped: 'ఆపబడింది'
    }
  };

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (lang === 'te' || lang === 'te-IN') {
      currentLang = 'te-IN';
    } else {
      currentLang = 'en-IN';
    }
    return currentLang;
  }

  function isSupported() {
    return isSpeechSupported;
  }

  function isTts() {
    return isTtsSupported;
  }

  /**
   * Toggle dictation on a specific input/textarea
   */
  function toggleDictation(options = {}) {
    const {
      targetInput,
      button,
      statusElement,
      lang = currentLang,
      onResult = null,
      onError = null,
      onEnd = null
    } = options;

    const inputEl = typeof targetInput === 'string' ? document.getElementById(targetInput) : targetInput;
    const btnEl = typeof button === 'string' ? document.getElementById(button) : button;
    const statEl = typeof statusElement === 'string' ? document.getElementById(statusElement) : statusElement;

    const dictLang = (lang === 'te' || lang === 'te-IN') ? 'te-IN' : 'en-IN';
    const langMsgs = MESSAGES[dictLang] || MESSAGES['en-IN'];

    // If already listening on this session, stop it
    if (activeRecognition) {
      stopDictation();
      return;
    }

    if (!isSpeechSupported) {
      const msg = langMsgs.notSupported;
      if (statEl) {
        statEl.textContent = msg;
        statEl.style.display = 'block';
        statEl.style.color = '#B91C1C';
      } else {
        alert(msg);
      }
      if (onError) onError(msg);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = dictLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      activeRecognition = recognition;
      activeListeningButton = btnEl;
      activeStatusEl = statEl;

      const initialBtnHtml = btnEl ? btnEl.innerHTML : '';
      if (btnEl) {
        btnEl.dataset.originalHtml = initialBtnHtml;
        btnEl.classList.add('voice-listening-active');
        btnEl.setAttribute('aria-pressed', 'true');
        btnEl.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:6px;color:#DC2626;font-weight:700;">
            <span style="display:inline-block;width:9px;height:9px;background:#DC2626;border-radius:50%;animation:voicePulse 1s infinite;"></span>
            ${langMsgs.stop}
          </span>
        `;
      }

      if (statEl) {
        statEl.textContent = langMsgs.listening;
        statEl.style.display = 'inline-flex';
        statEl.style.alignItems = 'center';
        statEl.style.color = '#DC2626';
        statEl.style.fontWeight = '600';
      }

      let baselineText = inputEl ? inputEl.value : '';
      if (baselineText && !baselineText.endsWith(' ') && !baselineText.endsWith('\n')) {
        baselineText += ' ';
      }

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const combined = (finalTranscript || interimTranscript).trim();
        if (inputEl && combined) {
          inputEl.value = baselineText + combined;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (onResult) {
          onResult(combined, Boolean(finalTranscript));
        }
      };

      recognition.onerror = (event) => {
        console.warn('[CivicVoice Error]:', event.error);
        let errorMsg = `Voice error: ${event.error}`;
        if (event.error === 'not-allowed') {
          errorMsg = langMsgs.permissionDenied;
        } else if (event.error === 'no-speech') {
          errorMsg = langMsgs.noSpeech;
        }

        if (statEl) {
          statEl.textContent = errorMsg;
          statEl.style.color = '#B91C1C';
        }
        if (onError) onError(errorMsg);
        stopDictation();
      };

      recognition.onend = () => {
        stopDictation();
        if (onEnd) onEnd();
      };

      recognition.start();

    } catch (err) {
      console.error('[CivicVoice Init Error]:', err);
      stopDictation();
      if (onError) onError(err.message);
    }
  }

  function stopDictation() {
    if (activeRecognition) {
      try {
        activeRecognition.stop();
      } catch (_) {}
      activeRecognition = null;
    }

    if (activeListeningButton) {
      activeListeningButton.classList.remove('voice-listening-active');
      activeListeningButton.setAttribute('aria-pressed', 'false');
      if (activeListeningButton.dataset.originalHtml) {
        activeListeningButton.innerHTML = activeListeningButton.dataset.originalHtml;
      }
      activeListeningButton = null;
    }

    if (activeStatusEl) {
      setTimeout(() => {
        if (activeStatusEl) {
          activeStatusEl.style.display = 'none';
          activeStatusEl = null;
        }
      }, 2000);
    }
  }

  /**
   * Text-to-Speech (TTS): Reads text aloud in English or Telugu
   */
  function speakText(text, lang = currentLang, onStart = null, onEnd = null) {
    if (!isTtsSupported || !text) {
      return false;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance

      const utterance = new SpeechSynthesisUtterance(text);
      const isTe = (lang === 'te' || lang === 'te-IN');
      utterance.lang = isTe ? 'te-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Try finding preferred voice
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        let matchedVoice = null;
        if (isTe) {
          matchedVoice = voices.find(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
        } else {
          matchedVoice = voices.find(v => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india')) ||
                         voices.find(v => v.lang.startsWith('en'));
        }
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      if (onStart) utterance.onstart = onStart;
      if (onEnd) utterance.onend = onEnd;
      utterance.onerror = (e) => {
        console.warn('[CivicVoice TTS Error]:', e);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      console.warn('[CivicVoice TTS Failure]:', e);
      return false;
    }
  }

  function stopSpeaking() {
    if (isTtsSupported) {
      window.speechSynthesis.cancel();
    }
  }

  function isSpeaking() {
    return isTtsSupported && window.speechSynthesis.speaking;
  }

  return {
    isSupported,
    isTtsSupported: isTts,
    getLanguage: getLang,
    setLanguage: setLang,
    toggleDictation,
    stopDictation,
    speakText,
    stopSpeaking,
    isSpeaking,
    messages: MESSAGES
  };
});

