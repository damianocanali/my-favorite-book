// Shared footer for every worksheet sheet (brief §1): "Make it a real book
// at mybooklab.app" plus a QR code to https://mybooklab.app/?ref=worksheet-<id>.
// `ref` is a fixed, known-safe value derived from our own template registry
// (never user text), so it needs none of params.js's sanitising.
import QrCode from './QrCode'

export default function WorksheetFooter({ t, templateId }) {
  const url = `https://mybooklab.app/?ref=worksheet-${templateId}`
  return (
    <div className="worksheet-footer mt-auto pt-2 border-t border-black/40 flex items-center justify-between gap-3">
      <p className="text-[10px] text-black/70 max-w-[70%]">{t('sheet.footer')}</p>
      <QrCode text={url} size={56} />
    </div>
  )
}
