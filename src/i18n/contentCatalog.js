// The display/prompt firewall.
//
// Five catalogue fields used to do double duty: they were shown to the child
// AND concatenated into the FLUX image prompt. Translating them would have
// quietly wrecked illustration quality, because the image models are trained
// overwhelmingly on English captions.
//
// So each catalogue entry now carries a frozen English `promptEn` alongside
// its id. Display text lives in the `content` namespace keyed by id; the
// prompt builder reads `promptEn` and never sees a translation.
//
// This mirrors the pattern already in AvatarPage.jsx, where options are
// `{ id: 'star-shaped glasses', label: 'Star Glasses' }` — id is the prompt
// fragment, label is display-only.
//
// BACKWARD COMPATIBILITY matters here: books are persisted to Supabase with a
// snapshot of the catalogue entry inside them, so books saved before this
// change carry `name`/`description`/`label` and no `promptEn`. Both helpers
// fall back to those legacy fields, and to whatever the child typed for
// custom entries that were never in a catalogue at all.

/// What to SHOW for a catalogue entry. Prefers the translated catalogue entry,
/// falls back to the entry's own text (legacy books, child-authored entries).
export function displayName(entity, t, kind) {
    if (!entity) return ''
    const legacy = entity.name ?? entity.label ?? ''
    if (!entity.id || !kind || typeof t !== 'function') return legacy
    return t(`content:${kind}.${entity.id}.name`, { defaultValue: legacy })
}

/// What to SHOW as the longer description.
export function displayDescription(entity, t, kind) {
    if (!entity) return ''
    const legacy = entity.description ?? ''
    if (!entity.id || !kind || typeof t !== 'function') return legacy
    return t(`content:${kind}.${entity.id}.description`, { defaultValue: legacy })
}

/// What to SEND to the image model. ALWAYS English.
///
/// Never route this through t() — a translated prompt term is the bug this
/// module exists to prevent.
export function promptName(entity, fallback = '') {
    if (!entity) return fallback
    return entity.promptEn?.name ?? entity.name ?? entity.label ?? fallback
}

export function promptDescription(entity, fallback = '') {
    if (!entity) return fallback
    return entity.promptEn?.description ?? entity.description ?? fallback
}

/// timePeriods use `label` rather than `name`.
export function promptLabel(entity, fallback = '') {
    if (!entity) return fallback
    return entity.promptEn?.label ?? entity.label ?? fallback
}
