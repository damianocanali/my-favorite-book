export default function BookPage({ page, book }) {
  const colors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#1E293B' }

  return (
    <div className="w-full h-full bg-[#FFF8F0] flex flex-col relative overflow-hidden">
      {/* Decorative top border */}
      <div className="h-1.5" style={{ backgroundColor: colors.accent + '40' }} />

      {/* Illustration area */}
      <div
        className="h-2/5 flex items-center justify-center relative overflow-hidden"
        style={
          page.illustrationData
            ? undefined
            : { background: `linear-gradient(135deg, ${colors.cover}10, ${colors.accent}10)` }
        }
      >
        {page.illustrationData ? (
          <img
            src={page.illustrationData}
            alt={`Page ${page.pageNumber} illustration`}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Emoji fallback */
          <div className="text-center">
            {book.setting && (
              <span className="text-6xl block mb-2">{book.setting.emoji}</span>
            )}
            <div className="flex justify-center gap-2">
              {book.characters?.slice(0, 3).map((char) => (
                <span key={char.id} className="text-3xl">
                  {char.emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Corner decoration (only without illustration) */}
        {!page.illustrationData && (
          <>
            <div className="absolute top-2 right-3 text-xs opacity-30" style={{ color: colors.cover }}>
              ✦
            </div>
            <div className="absolute bottom-2 left-3 text-xs opacity-30" style={{ color: colors.cover }}>
              ✦
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center px-6">
        <div className="flex-1 h-px" style={{ backgroundColor: colors.accent + '30' }} />
        <div className="px-2 text-xs" style={{ color: colors.accent + '80' }}>✦</div>
        <div className="flex-1 h-px" style={{ backgroundColor: colors.accent + '30' }} />
      </div>

      {/* Text content */}
      <div className="flex-1 px-6 py-4 overflow-auto">
        <p
          className="font-body text-base leading-relaxed"
          style={{ color: '#2D3748' }}
        >
          {page.text || (
            <span className="italic opacity-40">This page is blank...</span>
          )}
        </p>
      </div>

      {/* Page number */}
      <div className="pb-3 text-center">
        <span
          className="font-heading text-xs font-bold px-3 py-1 rounded-full"
          style={{
            backgroundColor: colors.cover + '15',
            color: colors.cover,
          }}
        >
          {page.pageNumber}
        </span>
      </div>

      {/* Decorative bottom border */}
      <div className="h-1" style={{ backgroundColor: colors.accent + '20' }} />
    </div>
  )
}
