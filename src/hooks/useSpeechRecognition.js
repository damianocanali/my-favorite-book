import { useState, useRef, useCallback, useEffect } from 'react'
import i18next from '../i18n'
import { speechLocale } from '../lib/speechLocale'

// `lang` (optional): the language to listen for — the book's, else the app's.
export function useSpeechRecognition({ onResult, lang }) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)

  // Keep ref in sync so the recognition handler always calls the latest callback
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = speechLocale(lang, i18next.language)

    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          onResultRef.current(transcript)
          setInterimText('')
        } else {
          interim += transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }
    recognition.onerror = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setInterimText('')
  }, [])

  // Stop on unmount
  useEffect(() => () => recognitionRef.current?.stop(), [])

  return { start, stop, isListening, interimText, isSupported }
}
