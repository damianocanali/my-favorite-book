import { useMemo } from 'react'
import { useBookStore } from '../stores/useBookStore'

const youngConfig = {
  fontSize: {
    body: 'text-xl',
    heading: 'text-4xl',
    input: 'text-2xl',
  },
  touchTarget: 'min-h-16 min-w-16',
  buttonSize: 'px-8 py-4 text-xl',
  maxPages: 6,
  charLimit: 100,
  mode: 'young',
}

const olderConfig = {
  fontSize: {
    body: 'text-base',
    heading: 'text-2xl',
    input: 'text-lg',
  },
  touchTarget: 'min-h-10 min-w-10',
  buttonSize: 'px-6 py-3 text-base',
  maxPages: 20,
  charLimit: 500,
  mode: 'older',
}

export function useAgeAdaptive() {
  const authorAge = useBookStore((state) => state.book?.authorAge ?? 8)

  return useMemo(() => {
    return authorAge <= 7 ? youngConfig : olderConfig
  }, [authorAge])
}
