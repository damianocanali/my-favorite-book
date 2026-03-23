export default function BookCover({ book }) {
  const colors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: colors.cover }}
    >
      {/* AI-generated cover image */}
      {book.coverImage && (
        <img
          src={book.coverImage}
          alt="Book cover"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Overlay for text readability when there's a cover image */}
      {book.coverImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
      )}

      {/* Decorative elements (only show without cover image) */}
      {!book.coverImage && (
        <>
          <div
            className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-20"
            style={{ backgroundColor: colors.accent }}
          />
          <div
            className="absolute bottom-8 left-4 w-12 h-12 rounded-full opacity-15"
            style={{ backgroundColor: colors.accent }}
          />
          <div
            className="absolute top-1/3 left-6 w-6 h-6 rounded-full opacity-20"
            style={{ backgroundColor: colors.text }}
          />
          <div className="absolute top-6 left-8 text-lg opacity-40">✦</div>
          <div className="absolute top-12 right-12 text-sm opacity-30">✦</div>
          <div className="absolute bottom-16 right-8 text-lg opacity-40">✦</div>
        </>
      )}

      {/* Title and author */}
      <div className="relative text-center z-10 p-8">
        <div
          className="w-16 h-0.5 mx-auto mb-4 opacity-50"
          style={{ backgroundColor: book.coverImage ? '#fff' : colors.text }}
        />
        <h1
          className="font-heading text-2xl sm:text-3xl font-bold leading-tight mb-4 drop-shadow-lg"
          style={{ color: book.coverImage ? '#fff' : colors.text }}
        >
          {book.title}
        </h1>
        <div
          className="w-16 h-0.5 mx-auto mb-6 opacity-50"
          style={{ backgroundColor: book.coverImage ? '#fff' : colors.text }}
        />

        {/* Characters (only without cover image) */}
        {!book.coverImage && (
          <div className="flex justify-center gap-2 mb-6">
            {book.characters?.slice(0, 4).map((char) => (
              <span key={char.id} className="text-3xl">
                {char.emoji}
              </span>
            ))}
          </div>
        )}

        {/* Author */}
        <p
          className="font-body text-sm opacity-80 drop-shadow"
          style={{ color: book.coverImage ? '#fff' : colors.text }}
        >
          Written by
        </p>
        <p
          className="font-heading text-lg font-bold drop-shadow-lg"
          style={{ color: book.coverImage ? '#fff' : colors.text }}
        >
          {book.authorName}
        </p>
      </div>

      {/* Bottom decoration */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2"
        style={{ backgroundColor: (book.coverImage ? '#000' : colors.accent) + '60' }}
      />
    </div>
  )
}
