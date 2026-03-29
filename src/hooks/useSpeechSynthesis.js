import { useState, useRef, useCallback, useEffect } from 'react'

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [words, setWords] = useState([])
  const utteranceRef = useRef(null)
  const startPositionsRef = useRef([])

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text.trim()) return
    window.speechSynthesis.cancel()

    // Precompute each word and its start character position
    const wordList = []
    const startPositions = []
    const regex = /\S+/g
    let match
    while ((match = regex.exec(text)) !== null) {
      wordList.push(match[0])
      startPositions.push(match.index)
    }
    startPositionsRef.current = startPositions
    setWords(wordList)
    setCurrentWordIndex(-1)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.85
    utterance.pitch = 1.1

    utterance.onboundary = (e) => {
      if (e.name !== 'word') return
      const positions = startPositionsRef.current
      let idx = -1
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] <= e.charIndex) idx = i
        else break
      }
      setCurrentWordIndex(idx)
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => { setIsSpeaking(false); setCurrentWordIndex(-1) }
    utterance.onerror = () => { setIsSpeaking(false); setCurrentWordIndex(-1) }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    setCurrentWordIndex(-1)
  }, [])

  // Cancel on unmount
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  return { speak, stop, isSpeaking, currentWordIndex, words, isSupported }
}
