import { motion } from 'motion/react'

// Presentational: a grid of "find yourself" tiles for the class roster.
// Pre-literate children lean on the avatar emoji to recognise their own
// tile; the name underneath is for everyone else. Sorted here rather than
// trusted to arrive sorted — a presentational component shouldn't assume
// anything about what its caller passes in.
export default function NameTiles({ students, onSelect }) {
  const sorted = [...(students ?? [])].sort((a, b) =>
    (a.display_name ?? '').localeCompare(b.display_name ?? '')
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list">
      {sorted.map((student, i) => (
        <motion.button
          key={student.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(student)}
          aria-label={student.display_name}
          className="min-w-[96px] min-h-[96px] flex flex-col items-center justify-center gap-1 rounded-card glass border border-galaxy-text-muted/10 hover:border-galaxy-primary/50 hover:bg-white/[0.08] active:scale-[0.97] transition-all p-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.3) }}
        >
          <span className="text-4xl leading-none" aria-hidden="true">
            {student.avatar_emoji}
          </span>
          <span className="font-heading font-semibold text-galaxy-text text-sm text-center line-clamp-1">
            {student.display_name}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
