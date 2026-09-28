// Shared header for every worksheet sheet (brief §1: "Every sheet: a
// header with Name ____ Date ____"), plus the optional class/teacher name
// the Customize panel (or the teacher-hook deep link) can add.
export default function WorksheetHeader({ t, className, teacherName, studentName }) {
  return (
    <div className="worksheet-header mb-3 pb-2 border-b-2 border-black">
      <div className="flex items-end gap-4 text-sm">
        <span className="flex items-end gap-1 flex-1">
          {t('sheet.header.name')}:
          <span className="flex-1 border-b border-black h-4">{studentName || ''}</span>
        </span>
        <span className="flex items-end gap-1 flex-1">
          {t('sheet.header.date')}:
          <span className="flex-1 border-b border-black h-4" />
        </span>
      </div>
      {(className || teacherName) && (
        <div className="flex items-end gap-4 text-xs mt-1 text-black/80">
          {className && (
            <span className="flex items-end gap-1">
              {t('sheet.header.class')}: <strong>{className}</strong>
            </span>
          )}
          {teacherName && (
            <span className="flex items-end gap-1">
              {t('sheet.header.teacher')}: <strong>{teacherName}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
