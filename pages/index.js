'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getSlots, fmtDate, dateKey, DAY_NAMES, DAY_FULL, MONTHS } from '../lib/schedule'
import styles from '../styles/app.module.css'

const ADMIN_PWD_KEY = 'admin_pwd'

// ─── Helpers ────────────────────────────────────────────────
function getWeekDates(offset) {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isPastSlot(date, slot) {
  const now = new Date()
  const [hStr] = slot.split(' - ')
  const [h, m] = hStr.split(':').map(Number)
  const sd = new Date(date)
  sd.setHours(h, m, 0, 0)
  return sd <= now
}

// ─── Components ─────────────────────────────────────────────

function ClientView() {
  const [weekOffset, setWeekOffset]     = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [taken, setTaken]               = useState({})   // { "2025-06-14": ["14:00 - 15:00"] }
  const [form, setForm]                 = useState({ nombre: '', email: '', telefono: '' })
  const [view, setView]                 = useState('calendar') // calendar | sending | success
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState('')

  const days = getWeekDates(weekOffset)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Cargar disponibilidad cuando cambia la semana
  useEffect(() => {
    const dates = getWeekDates(weekOffset)
    const desde = dateKey(dates[0])
    const hasta  = dateKey(dates[6])
    fetch(`/api/disponibilidad?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setTaken(prev => ({ ...prev, ...data })) })
  }, [weekOffset])

  async function handleConfirm() {
    if (!form.nombre || !form.email || !selectedDate || !selectedSlot) return
    setView('sending'); setError('')
    const body = { nombre: form.nombre, email: form.email, telefono: form.telefono, fecha: dateKey(selectedDate), turno: selectedSlot }
    const res = await fetch('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Error al reservar'); setView('calendar'); return }
    setResult(data)
    setTaken(prev => {
      const dk = dateKey(selectedDate)
      return { ...prev, [dk]: [...(prev[dk] || []), selectedSlot] }
    })
    setView('success')
  }

  function reset() {
    setView('calendar'); setSelectedDate(null); setSelectedSlot(null)
    setForm({ nombre: '', email: '', telefono: '' }); setResult(null); setError('')
  }

  if (view === 'sending') return (
    <div className={styles.successCard}>
      <div className={styles.loadingDots}><span/><span/><span/></div>
      <p>Guardando tu turno y generando email de confirmación...</p>
    </div>
  )

  if (view === 'success') return (
    <div className={styles.successCard}>
      <div className={styles.successIcon}>✓</div>
      <h2>¡Turno confirmado!</h2>
      <p className={styles.muted}>Te esperamos en la cancha</p>
      <div className={styles.bookingDetail}>
        <div className={styles.muted} style={{ fontSize: 13, marginBottom: 4 }}>{result?.reserva?.nombre}</div>
        <div>{fmtDate(result?.reserva?.fecha)}</div>
        <div className={styles.teal} style={{ marginTop: 4, fontSize: 18, fontWeight: 600 }}>{result?.reserva?.turno} hs</div>
      </div>
      {result?.emailBody && (
        <div style={{ textAlign: 'left' }}>
          <p className={styles.muted} style={{ fontSize: 12, marginBottom: 4 }}>
            📧 Email enviado a <strong>{result?.reserva?.email}</strong>:
          </p>
          <div className={styles.emailPreview}>{result.emailBody}</div>
        </div>
      )}
      <button className={styles.newBtn} onClick={reset}>Reservar otro turno</button>
    </div>
  )

  const slotsTaken = selectedDate ? (taken[dateKey(selectedDate)] || []) : []

  return (
    <div>
      <div className={styles.header}>
        <h1>Reservá tu turno <span className={styles.subtitle}>· Tenis de mesa</span></h1>
        <p className={styles.muted}>Turnos de 1 hora · Lun–Vie 14–19:30 · Sáb 8–17 · Dom 9–14</p>
      </div>

      <div className={styles.weekNav}>
        <button onClick={() => { setWeekOffset(o => o - 1); setSelectedDate(null); setSelectedSlot(null) }}>‹</button>
        <span className={styles.weekLabel}>
          {days[0].getDate()} {MONTHS[days[0].getMonth()]} – {days[6].getDate()} {MONTHS[days[6].getMonth()]} {days[6].getFullYear()}
        </span>
        <button onClick={() => { setWeekOffset(o => o + 1); setSelectedDate(null); setSelectedSlot(null) }}>›</button>
      </div>

      <div className={styles.daysGrid}>
        {days.map(d => {
          const dk = dateKey(d)
          const dd = new Date(d); dd.setHours(0, 0, 0, 0)
          const disabled = dd < today
          const hasSched = [0,1,2,3,4,5,6].includes(d.getDay())
          const isSel = selectedDate && dateKey(selectedDate) === dk
          const isToday = dd.getTime() === today.getTime()
          const slots = getSlots(d)
          const takenCount = (taken[dk] || []).length
          const avail = slots.length - takenCount

          return (
            <div
              key={dk}
              className={`${styles.dayBtn} ${disabled ? styles.disabled : ''} ${isSel ? styles.daySelected : ''} ${isToday ? styles.dayToday : ''}`}
              onClick={() => { if (!disabled && slots.length) { setSelectedDate(new Date(dk + 'T12:00:00')); setSelectedSlot(null) } }}
            >
              <div className={styles.dayName}>{DAY_NAMES[d.getDay()]}</div>
              <div className={styles.dayNum}>{d.getDate()}</div>
              {!disabled && slots.length > 0 && <div className={styles.availCount}>{avail} libre{avail !== 1 ? 's' : ''}</div>}
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <div className={styles.slotsSection}>
          <div className={styles.slotsTitle}>
            Horarios — {DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
          </div>
          <div className={styles.slotsGrid}>
            {getSlots(selectedDate).map(slot => {
              const isTaken = slotsTaken.includes(slot) || isPastSlot(selectedDate, slot)
              const isSel = selectedSlot === slot
              return (
                <div
                  key={slot}
                  className={`${styles.slot} ${isTaken ? styles.slotTaken : ''} ${isSel && !isTaken ? styles.slotSelected : ''}`}
                  onClick={() => { if (!isTaken) setSelectedSlot(slot) }}
                >
                  {slot.replace(' - ', '–')}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedDate && selectedSlot && (
        <>
          <div className={styles.summaryBar}>
            📅 <strong>{DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</strong>
            &nbsp;·&nbsp;{selectedSlot.replace(' - ', ' a ')} hs
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Tus datos</div>
            {[
              { label: 'Nombre completo *', key: 'nombre', type: 'text', placeholder: 'Ej: María González' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'tu@email.com' },
              { label: 'Teléfono (opcional)', key: 'telefono', type: 'tel', placeholder: '+54 11 1234-5678' },
            ].map(f => (
              <div key={f.key} className={styles.formRow}>
                <label>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <button
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={!form.nombre || !form.email}
            >
              Confirmar y enviar email de confirmación
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AdminView() {
  const [authed, setAuthed]   = useState(false)
  const [pwd, setPwd]         = useState('')
  const [bookings, setBookings] = useState([])
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(false)
  const [actionState, setActionState] = useState({}) // { [id]: { loading, emailBody } }

  function headers() { return { 'Content-Type': 'application/json', 'x-admin-password': localStorage.getItem(ADMIN_PWD_KEY) || '' } }

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ estado: filter })
    if (search) params.set('busqueda', search)
    const res = await fetch(`/api/admin?${params}`, { headers: headers() })
    const data = await res.json()
    if (res.ok) setBookings(data)
    setLoading(false)
  }, [filter, search])

  function login() {
    localStorage.setItem(ADMIN_PWD_KEY, pwd)
    setAuthed(true)
  }

  useEffect(() => { if (authed) fetchBookings() }, [authed, fetchBookings])

  async function doAction(id, accion) {
    setActionState(p => ({ ...p, [id]: { loading: true } }))
    const res = await fetch('/api/admin', { method: 'PATCH', headers: headers(), body: JSON.stringify({ id, accion }) })
    const data = await res.json()
    setActionState(p => ({ ...p, [id]: { loading: false, emailBody: data.emailBody } }))
    if (accion === 'cancelar') fetchBookings()
  }

  if (!authed) return (
    <div className={styles.formCard} style={{ maxWidth: 360, margin: '2rem auto' }}>
      <div className={styles.formTitle}>Acceso administrador</div>
      <div className={styles.formRow}>
        <label>Contraseña</label>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} placeholder="••••••••" />
      </div>
      <button className={styles.confirmBtn} onClick={login}>Entrar</button>
    </div>
  )

  const confirmed = bookings.filter(b => b.estado === 'confirmado').length
  const cancelled = bookings.filter(b => b.estado === 'cancelado').length
  const today = new Date().toISOString().split('T')[0]
  const todayCount = bookings.filter(b => b.fecha === today && b.estado === 'confirmado').length

  return (
    <div className={styles.adminWrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}><div className={styles.statNum}>{bookings.length}</div><div className={styles.statLabel}>Total</div></div>
        <div className={styles.statCard}><div className={`${styles.statNum} ${styles.teal}`}>{confirmed}</div><div className={styles.statLabel}>Confirmados</div></div>
        <div className={styles.statCard}><div className={styles.statNum}>{todayCount}</div><div className={styles.statLabel}>Hoy</div></div>
        <div className={styles.statCard}><div className={`${styles.statNum} ${styles.red}`}>{cancelled}</div><div className={styles.statLabel}>Cancelados</div></div>
      </div>

      <div className={styles.filterRow}>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="confirmado">Confirmados</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <input type="text" placeholder="Buscar nombre, email..." value={search}
          onChange={e => setSearch(e.target.value)} />
        <button onClick={fetchBookings} className={styles.refreshBtn}>↻ Actualizar</button>
      </div>

      {loading && <div className={styles.muted} style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}

      {!loading && bookings.length === 0 && (
        <div className={styles.emptyAdmin}>🏓 No hay reservas todavía</div>
      )}

      {!loading && bookings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.bookingTable}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const as = actionState[b.id] || {}
                return (
                  <>
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.nombre}</div>
                        <div className={styles.muted} style={{ fontSize: 12 }}>{b.email}{b.telefono ? ` · ${b.telefono}` : ''}</div>
                        <div className={styles.muted} style={{ fontSize: 11 }}>{b.created_at ? new Date(b.created_at).toLocaleString('es-AR') : ''}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{fmtDate(b.fecha)}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{b.turno?.replace(' - ', '–')} hs</td>
                      <td>
                        <span className={`${styles.badge} ${b.estado === 'confirmado' ? styles.badgeOk : styles.badgeCancel}`}>
                          {b.estado === 'confirmado' ? 'Confirmado' : 'Cancelado'}
                        </span>
                      </td>
                      <td>
                        {b.estado === 'confirmado' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className={styles.reminderBtn} disabled={as.loading} onClick={() => doAction(b.id, 'recordatorio')}>
                              📧 Recordatorio
                            </button>
                            <button className={styles.delBtn} disabled={as.loading} onClick={() => doAction(b.id, 'cancelar')}>
                              ✕ Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {as.loading && (
                      <tr key={`${b.id}-loading`}>
                        <td colSpan={5}>
                          <div className={styles.loadingDots} style={{ justifyContent: 'flex-start', padding: '6px 0' }}><span/><span/><span/></div>
                        </td>
                      </tr>
                    )}
                    {as.emailBody && (
                      <tr key={`${b.id}-email`}>
                        <td colSpan={5}>
                          <p className={styles.muted} style={{ fontSize: 11, marginBottom: 4 }}>📨 Email generado y enviado:</p>
                          <div className={styles.emailPreview}>{as.emailBody}</div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState('client')

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'client' ? styles.tabActive : ''}`} onClick={() => setTab('client')}>
            🏓 Reservar turno
          </button>
          <button className={`${styles.tab} ${tab === 'admin' ? styles.tabActive : ''}`} onClick={() => setTab('admin')}>
            ⚙️ Panel admin
          </button>
        </div>
        {tab === 'client' ? <ClientView /> : <AdminView />}
      </div>
    </div>
  )
}

