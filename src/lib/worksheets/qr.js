// Pure QR-matrix computation for the worksheet footer's QR code (brief §1:
// "add ONE small, dependency-free MIT library ... lazy-loaded only on the
// worksheets route; render as SVG"). qrcode-generator is genuinely zero
// transitive dependencies (unlike the `qrcode` package already used
// elsewhere for BackMatterPages, which pulls in pngjs et al and is always
// in the main bundle already) — this wraps it in one place so the React
// side just draws <rect>s from plain coordinates. No dangerouslySetInnerHTML
// anywhere in this codebase, and this isn't the place to start.
//
// The `import()` here — not a static import — is what lets Vite split
// qrcode-generator into its own chunk, fetched only when a QR is actually
// requested (i.e. once WorksheetsPage renders), rather than being paid for
// on every page load. Same technique src/i18n/index.js uses for the
// Italian catalogue.
export async function computeQrModules(text, { typeNumber = 0, errorCorrectionLevel = 'M' } = {}) {
  const { default: qrcode } = await import('qrcode-generator')
  const qr = qrcode(typeNumber, errorCorrectionLevel)
  qr.addData(text)
  qr.make()

  const size = qr.getModuleCount()
  const cells = []
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) cells.push([row, col])
    }
  }
  return { size, cells }
}
