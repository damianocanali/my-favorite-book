import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable, closestCenter,
} from '@dnd-kit/core'
import { ArrowLeft, Shuffle, X } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import {
  STORY_FRAMES, STORY_CARDS, CARD_KINDS, cardById,
  cardWord, cardKindLabel, cardKindHint, localizedFrame,
} from '../data/storyCards'
import {
  segmentsForPage, slotsForFrame, canDrop, place, clearSlot,
  missingSlots, isComplete, progress, renderStory, randomPlacements,
  buildBookFromCards,
} from '../lib/storyBuilder'
import { formatNumber } from '../i18n/formats'
import { useBookStore } from '../stores/useBookStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { useRewardsStore } from '../stores/useRewardsStore'
import { useMilestoneStore } from '../stores/useMilestoneStore'
import { celebrateBig } from '../lib/celebrate'
import SparkleButton from '../components/ui/SparkleButton'
import Mascot from '../components/ui/Mascot'

// "Story Builder" — drag picture-and-word cards into a sentence.
//
// Drag is the headline interaction, but it is NOT the only one. Tapping a
// card then tapping a slot does the same job, and dnd-kit's KeyboardSensor
// covers keyboard users. That matters more than usual here: dragging is
// genuinely hard for small hands on a small screen, and a game a
// five-year-old cannot physically complete is not a game.

export default function StoryBuilderPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [rawFrame, setRawFrame] = useState(null)
  const [placements, setPlacements] = useState({})
  const [activeCardId, setActiveCardId] = useState(null)   // mid-drag
  const [selectedCardId, setSelectedCardId] = useState(null) // tap-to-place
  const [kindFilter, setKindFilter] = useState('who')

  const displayName = useAuthStore(selectDisplayName)
  const loadBook = useBookStore((s) => s.loadBook)
  const addBookToShelf = useBookshelfStore((s) => s.addBook)
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const recordWritingActivity = useRewardsStore((s) => s.recordWritingActivity)
  const fireMilestone = useMilestoneStore((s) => s.fire)

  const sensors = useSensors(
    // A small distance threshold so a tap isn't swallowed as a micro-drag —
    // without it, tap-to-place never fires on touch.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )

  // The whole frame — title, blurb and every sentence — comes from the
  // catalogue, so the slot parser below reads the LOCALISED sentence and the
  // book we build carries localised prose.
  const frame = useMemo(
    () => localizedFrame(rawFrame),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFrame, i18n.language]
  )

  const done = frame ? isComplete(frame, placements) : false
  const pct = frame ? Math.round(progress(frame, placements) * 100) : 0
  const remaining = frame ? missingSlots(frame, placements).length : 0
  const rendered = useMemo(
    () => (frame ? renderStory(frame, placements) : []),
    [frame, placements]
  )

  const handleDragEnd = ({ active, over }) => {
    setActiveCardId(null)
    if (!over) return
    const slotKind = over.data.current?.kind
    setPlacements((prev) => place(prev, over.id, active.id, slotKind))
  }

  /** Tap a card, then tap a slot. The path most young children take. */
  const tapSlot = (slotKey, slotKind) => {
    if (!selectedCardId) return
    if (!canDrop(slotKind, selectedCardId)) return
    setPlacements((prev) => place(prev, slotKey, selectedCardId, slotKind))
    setSelectedCardId(null)
  }

  const finish = () => {
    if (!done) return
    const book = buildBookFromCards({ frame, placements, authorName: displayName, makeId: nanoid })
    addBookToShelf(book)
    loadBook(book)
    recordWritingActivity()
    earnBadge('finished_blanks')
    earnBadge('first_page')
    earnBadge('first_book')
    fireMilestone({
      id: `builder:${book.id}`,
      title: t('games:builder.milestone_title'),
      sub: t('games:builder.milestone_sub'),
      mood: 'proud',
    })
    celebrateBig()
    navigate(`/preview/${book.id}`)
  }

  // ── Frame picker ───────────────────────────────────────────────────
  if (!frame) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="toolbar-btn mb-6"
          aria-label={t('games:actions.go_back')}
          title={t('games:actions.go_back')}
        >
          <ArrowLeft size={15} /> <span className="toolbar-btn__label">{t('common:actions.back')}</span>
        </button>
        <div className="text-center mb-8">
          <Mascot mood="think" size={92} className="mx-auto" />
          <h1 className="font-heading text-3xl font-bold mt-3">{t('games:builder.title')}</h1>
          <p className="font-body text-galaxy-text-muted mt-1">
            {t('games:builder.subtitle')}
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {STORY_FRAMES.map((raw) => {
            // Localised here too, so the gap count on the card matches the
            // sentences the child is about to see.
            const f = localizedFrame(raw)
            return (
              <li key={f.id}>
                <button
                  onClick={() => { setRawFrame(raw); setPlacements({}) }}
                  className="ios-card w-full text-left transition-transform hover:scale-[1.02] active:scale-[0.99]"
                >
                  <span className="text-4xl" aria-hidden>{f.emoji}</span>
                  <p className="font-heading text-lg font-bold mt-2">{f.title}</p>
                  <p className="font-body text-sm text-galaxy-text-muted">{f.blurb}</p>
                  <p className="font-body text-xs text-galaxy-text-muted/70 mt-2">
                    {t('games:builder.frame_meta', {
                      pages: formatNumber(f.pages.length),
                      gaps: formatNumber(slotsForFrame(f).length),
                    })}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const trayCards = STORY_CARDS.filter((c) => c.kind === kindFilter)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => { setActiveCardId(active.id); setSelectedCardId(null) }}
      onDragCancel={() => setActiveCardId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            t('games:builder.announce.picked_up', {
              card: cardWord(cardById(active.id)) || t('games:builder.announce.a_card'),
            }),
          onDragOver: ({ over }) =>
            over
              ? t('games:builder.announce.over_gap', { kind: cardKindLabel(over.data.current?.kind) })
              : t('games:builder.announce.not_over_gap'),
          onDragEnd: ({ active, over }) =>
            over
              ? t('games:builder.announce.placed', {
                  card: cardWord(cardById(active.id)),
                  kind: cardKindLabel(over.data.current?.kind),
                })
              : t('games:builder.announce.returned', { card: cardWord(cardById(active.id)) }),
          onDragCancel: () => t('games:builder.announce.cancelled'),
        },
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 pb-56">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setRawFrame(null)}
            className="toolbar-btn"
            aria-label={t('games:actions.stories_aria')}
            title={t('games:actions.stories_aria')}
          >
            <ArrowLeft size={15} /> <span className="toolbar-btn__label">{t('games:actions.stories')}</span>
          </button>
          <button
            onClick={() => setPlacements(randomPlacements(frame))}
            className="toolbar-btn toolbar-btn--cyan ml-auto"
            aria-label={t('games:builder.surprise_me_aria')}
            title={t('games:actions.surprise_me')}
          >
            <Shuffle size={15} /> <span className="toolbar-btn__label">{t('games:actions.surprise_me')}</span>
          </button>
        </div>

        <h1 className="font-heading text-2xl font-bold">{frame.title}</h1>

        <div className="mt-3 mb-5">
          <div className="h-2.5 rounded-full glass-recessed overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#FFD60A] to-[#FF9F0A]"
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            />
          </div>
          <p className="font-body text-xs text-galaxy-text-muted mt-1.5" aria-live="polite">
            {done
              ? t('games:builder.all_filled')
              : t('games:builder.gaps_left', { count: remaining })}
          </p>
        </div>

        {selectedCardId && (
          <p className="mb-3 rounded-xl bg-[#FFD60A]/15 px-3 py-2 font-body text-sm text-[#FFE68A]">
            <span aria-hidden>{cardById(selectedCardId)?.emoji}</span>{' '}
            {/* One whole sentence per kind. Italian cannot build this from a
                fragment plus a kind noun — the article has to agree. */}
            <Trans
              i18nKey={`games:builder.tap_hint.${cardById(selectedCardId)?.kind}`}
              components={{ b: <strong /> }}
            />
          </p>
        )}

        <ol className="space-y-4">
          {frame.pages.map((_, pageIndex) => (
            <li key={pageIndex} className="ios-card">
              <p className="font-body text-lg leading-loose">
                <span className="text-galaxy-text-muted text-xs mr-2">{formatNumber(pageIndex + 1)}</span>
                {segmentsForPage(frame, pageIndex).map((seg, i) =>
                  seg.type === 'text' ? (
                    <span key={i}>{seg.value}</span>
                  ) : (
                    <Slot
                      key={seg.key}
                      slot={seg}
                      cardId={placements[seg.key]}
                      selectedCardId={selectedCardId}
                      onTap={() => tapSlot(seg.key, seg.kind)}
                      onClear={() => setPlacements((p) => clearSlot(p, seg.key))}
                    />
                  )
                )}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <SparkleButton onClick={finish} disabled={!done}>
            {done ? t('games:actions.make_my_book') : t('games:builder.finish_hint')}
          </SparkleButton>
        </div>

        <p className="sr-only" aria-live="polite">{rendered.join(' ')}</p>
      </div>

      {/* Card tray */}
      <div className="fixed inset-x-0 bottom-[calc(56px+var(--sab,0px))] z-[56] ios-material border-t border-white/15">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex gap-1.5 mb-2" role="tablist" aria-label={t('games:builder.card_kinds_aria')}>
            {Object.entries(CARD_KINDS).map(([kind, meta]) => (
              <button
                key={kind}
                role="tab"
                aria-selected={kindFilter === kind}
                onClick={() => setKindFilter(kind)}
                className={`rounded-full px-3 py-1 font-body text-xs font-bold transition-colors ${
                  kindFilter === kind
                    ? 'bg-[#FFD60A] text-[#2A1055]'
                    : 'bg-white/10 text-galaxy-text-muted'
                }`}
              >
                <span aria-hidden>{meta.emoji}</span> {cardKindLabel(kind)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trayCards.map((card) => (
              <TrayCard
                key={card.id}
                card={card}
                selected={selectedCardId === card.id}
                onSelect={() =>
                  setSelectedCardId((cur) => (cur === card.id ? null : card.id))
                }
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCardId ? <CardFace card={cardById(activeCardId)} dragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function CardFace({ card, dragging = false, selected = false }) {
  if (!card) return null
  return (
    <span
      className={`flex w-[76px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2 ${
        selected ? 'border-[#FFD60A] bg-[#FFD60A]/20' : 'border-white/20 bg-white/10'
      } ${dragging ? 'scale-110 shadow-glow-modal' : ''}`}
    >
      <span className="text-2xl leading-none" aria-hidden>{card.emoji}</span>
      <span className="font-body text-[11px] font-semibold leading-tight text-center">
        {cardWord(card)}
      </span>
    </span>
  )
}

function TrayCard({ card, selected, onSelect }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      aria-label={t('games:builder.card_aria', {
        card: cardWord(card),
        kind: cardKindLabel(card.kind),
      })}
      aria-pressed={selected}
      className={`touch-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardFace card={card} selected={selected} />
    </button>
  )
}

function Slot({ slot, cardId, selectedCardId, onTap, onClear }) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: slot.key, data: { kind: slot.kind } })
  const card = cardById(cardId)
  // Highlight only the gaps the held card can actually go in, so a wrong
  // drop reads as "not that one" before it happens rather than after.
  const eligible = selectedCardId ? canDrop(slot.kind, selectedCardId) : false

  if (card) {
    return (
      <span ref={setNodeRef} className="mx-1 inline-flex items-center gap-1 align-middle">
        <span className="rounded-lg bg-[#FFD60A]/20 px-2 py-0.5 font-bold text-[#FFE68A]">
          <span aria-hidden>{card.emoji}</span> {cardWord(card)}
        </span>
        <button
          onClick={onClear}
          aria-label={t('games:builder.remove_card', { card: cardWord(card) })}
          className="rounded-full bg-white/10 p-0.5 text-galaxy-text-muted hover:bg-white/20"
        >
          <X size={12} />
        </button>
      </span>
    )
  }

  return (
    <button
      ref={setNodeRef}
      onClick={onTap}
      aria-label={t('games:builder.empty_slot_aria', {
        kind: cardKindLabel(slot.kind),
        hint: cardKindHint(slot.kind),
      })}
      className={`mx-1 inline-flex min-w-[92px] items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-0.5 align-middle font-body text-sm transition-colors ${
        isOver || eligible
          ? 'border-[#FFD60A] bg-[#FFD60A]/20 text-[#FFE68A]'
          : 'border-white/25 bg-white/5 text-galaxy-text-muted'
      }`}
    >
      <span aria-hidden>{CARD_KINDS[slot.kind]?.emoji}</span>
      {cardKindLabel(slot.kind)}
    </button>
  )
}
