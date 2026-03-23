import { motion } from 'motion/react'
import { Trash2, Pencil } from 'lucide-react'

export default function BookSpine({ book, onClick, onEdit, onDelete }) {
  const colors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  return (
    <div className="relative group">
      <motion.button
        onClick={onClick}
        className="w-full cursor-pointer"
        whileHover={{ scale: 1.05, y: -5 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Book cover */}
        <div
          className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-lg"
          style={{ backgroundColor: colors.cover }}
        >
          {/* Spine */}
          <div
            className="absolute left-0 top-0 bottom-0 w-4"
            style={{ backgroundColor: colors.accent + '60' }}
          />

          {/* Content */}
          <div className="flex flex-col items-center justify-center h-full px-6">
            {/* Characters */}
            <div className="flex gap-1 mb-3">
              {book.characters?.slice(0, 3).map((char) => (
                <span key={char.id} className="text-xl">
                  {char.emoji}
                </span>
              ))}
            </div>

            {/* Title */}
            <h3
              className="font-heading text-sm font-bold text-center leading-tight mb-2"
              style={{ color: colors.text }}
            >
              {book.title}
            </h3>

            {/* Divider */}
            <div
              className="w-8 h-0.5 mb-2 opacity-50"
              style={{ backgroundColor: colors.text }}
            />

            {/* Author */}
            <p
              className="font-body text-xs opacity-70"
              style={{ color: colors.text }}
            >
              {book.authorName}
            </p>

            {/* Page count */}
            <p
              className="font-body text-[10px] mt-2 opacity-50"
              style={{ color: colors.text }}
            >
              {book.pages?.length ?? 0} pages
            </p>
          </div>

          {/* Bottom decoration */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: colors.accent + '50' }}
          />
        </div>
      </motion.button>

      {/* Edit button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="absolute -top-2 -left-2 w-7 h-7 bg-galaxy-secondary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-10"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      >
        <Pencil size={12} />
      </motion.button>

      {/* Delete button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-10"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      >
        <Trash2 size={12} />
      </motion.button>
    </div>
  )
}
