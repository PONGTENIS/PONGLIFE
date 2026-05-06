export const SCHEDULE = {
  1: { start: '14:00', end: '19:30' }, // Lunes
  2: { start: '14:00', end: '19:30' }, // Martes
  3: { start: '14:00', end: '19:30' }, // Miércoles
  4: { start: '14:00', end: '19:30' }, // Jueves
  5: { start: '14:00', end: '19:30' }, // Viernes
  6: { start: '08:00', end: '17:00' }, // Sábado
  0: { start: '09:00', end: '14:00' }, // Domingo
}

export const DAY_NAMES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
export const DAY_FULL   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export const MONTHS     = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

/** Genera los turnos de 1 hora para un día dado (objeto Date) */
export function getSlots(date) {
  const dow = date.getDay()
  const sched = SCHEDULE[dow]
  if (!sched) return []

  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const fmt   = min => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')

  const start = toMin(sched.start)
  const end   = toMin(sched.end)
  const slots = []
  for (let t = start; t + 60 <= end; t += 60) {
    slots.push(`${fmt(t)} - ${fmt(t + 60)}`)
  }
  return slots
}

/** Formatea una fecha ISO (YYYY-MM-DD) como texto legible */
export function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Devuelve YYYY-MM-DD de un objeto Date */
export function dateKey(d) {
  return d.toISOString().split('T')[0]
}
