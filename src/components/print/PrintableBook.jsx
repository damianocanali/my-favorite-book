/**
 * PrintableBook — hidden on screen, shown only during window.print().
 * Each page uses .print-page which triggers a page break in @media print.
 */
export default function PrintableBook({ book }) {
  if (!book) return null

  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'

  return (
    <div className="printable-book hidden">

      {/* ── Cover page ── */}
      <div
        className="print-page items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${cover}, ${accent})` }}
      >
        {book.coverImage ? (
          <img
            src={book.coverImage}
            alt="Book cover"
            style={{ width: '100%', height: '60%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: '8rem', textAlign: 'center', paddingTop: '4rem' }}>
            {book.characters?.[0]?.emoji ?? '📖'}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: textColor }}>
          <h1 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '3rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.75rem' }}>
            {book.title}
          </h1>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.25rem' }}>
            by {book.authorName}
          </p>
        </div>
      </div>

      {/* ── Story pages ── */}
      {book.pages.map((page) => (
        <div key={page.id} className="print-page" style={{ background: 'white' }}>
          {/* Illustration area — top half */}
          <div
            style={{
              height: page.illustrationData ? '55%' : '40%',
              background: page.illustrationData
                ? undefined
                : `linear-gradient(135deg, ${cover}30, ${accent}30)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderBottom: `4px solid ${accent}`,
            }}
          >
            {page.illustrationData ? (
              <img
                src={page.illustrationData}
                alt={`Page ${page.pageNumber} illustration`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                {book.setting && <span style={{ fontSize: '5rem' }}>{book.setting.emoji}</span>}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                  {book.characters?.map((c) => (
                    <span key={c.id} style={{ fontSize: '3rem' }}>{c.emoji}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Text area — bottom half */}
          <div style={{ flex: 1, padding: '2rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <p style={{
              fontFamily: 'Nunito, sans-serif',
              fontSize: '1.4rem',
              lineHeight: 1.8,
              color: '#1E293B',
              whiteSpace: 'pre-wrap',
            }}>
              {page.text || ' '}
            </p>

            {/* Page number */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <span style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: cover,
                color: textColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Fredoka, sans-serif',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}>
                {page.pageNumber}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* ── Back cover / The End ── */}
      <div
        className="print-page items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${accent}, ${cover})` }}
      >
        <div style={{ textAlign: 'center', color: textColor, padding: '4rem' }}>
          <p style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '4rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            The End
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.5rem', opacity: 0.85 }}>
            {book.title}
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.1rem', opacity: 0.7, marginTop: '0.5rem' }}>
            Written and illustrated by {book.authorName}
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.9rem', opacity: 0.5, marginTop: '3rem' }}>
            Created with My Book Lab ✨
          </p>
        </div>
      </div>

    </div>
  )
}
