import { supabaseAdmin } from '../../lib/supabase'
import { fmtDate } from '../../lib/schedule'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend    = new Resend(process.env.RESEND_API_KEY)

function checkAdmin(req) {
  const pwd = req.headers['x-admin-password']
  return pwd === process.env.ADMIN_PASSWORD
}

export default async function handler(req, res) {
  if (!checkAdmin(req)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  // ── GET: listar todas las reservas ──────────────────────────
  if (req.method === 'GET') {
    const { estado, busqueda, desde, hasta } = req.query
    let query = supabaseAdmin
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('turno',  { ascending: true })

    if (estado && estado !== 'all') query = query.eq('estado', estado)
    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)
    if (busqueda) {
      query = query.or(`nombre.ilike.%${busqueda}%,email.ilike.%${busqueda}%`)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── PATCH: cancelar una reserva ──────────────────────────────
  if (req.method === 'PATCH') {
    const { id, accion } = req.body

    if (accion === 'cancelar') {
      // Obtener la reserva
      const { data: reserva } = await supabaseAdmin
        .from('reservas').select('*').eq('id', id).single()
      if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

      // Actualizar estado
      const { error } = await supabaseAdmin
        .from('reservas').update({ estado: 'cancelado' }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })

      // Generar y enviar email de cancelación
      let emailBody = ''
      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Generá un email de cancelación de turno de tenis de mesa.
Datos: Nombre: ${reserva.nombre}, Fecha: ${fmtDate(reserva.fecha)}, Horario: ${reserva.turno} hs.
En español argentino, tuteo, breve (máximo 4 líneas), amigable, sin markdown.
Invitalo a reservar otro turno. Solo el cuerpo del email, sin asunto ni firma.`
          }]
        })
        emailBody = aiRes.content?.[0]?.text || ''
      } catch (e) {
        emailBody = `Hola ${reserva.nombre},\n\nTu turno del ${fmtDate(reserva.fecha)} a las ${reserva.turno} hs fue cancelado.\n\nCuando quieras podés volver a reservar desde nuestro sistema. ¡Hasta pronto!`
      }

      try {
        await resend.emails.send({
          from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
          to:   reserva.email,
          subject: `Turno cancelado – ${fmtDate(reserva.fecha)} ${reserva.turno} hs`,
          text: emailBody,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
            <h2 style="color:#E24B4A">Turno cancelado</h2>
            <p style="white-space:pre-line;color:#333;line-height:1.6">${emailBody}</p>
          </div>`
        })
      } catch (e) {
        console.error('Email cancelación error:', e)
      }

      return res.status(200).json({ ok: true, emailBody })
    }

    // ── Enviar recordatorio ────────────────────────────────────
    if (accion === 'recordatorio') {
      const { data: reserva } = await supabaseAdmin
        .from('reservas').select('*').eq('id', id).single()
      if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

      let emailBody = ''
      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Generá un email recordatorio de turno de tenis de mesa para mañana.
Datos: Nombre: ${reserva.nombre}, Fecha: ${fmtDate(reserva.fecha)}, Horario: ${reserva.turno} hs.
En español argentino, tuteo, breve (máximo 4 líneas), amigable, sin markdown.
Solo el cuerpo del email, sin asunto ni firma.`
          }]
        })
        emailBody = aiRes.content?.[0]?.text || ''
      } catch (e) {
        emailBody = `Hola ${reserva.nombre},\n\nTe recordamos tu turno de tenis de mesa mañana ${fmtDate(reserva.fecha)} a las ${reserva.turno} hs.\n\n¡No te olvides! Te esperamos en la cancha.`
      }

      try {
        await resend.emails.send({
          from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
          to:   reserva.email,
          subject: `Recordatorio: mañana tenés turno a las ${reserva.turno} hs`,
          text: emailBody,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
            <h2 style="color:#1D9E75">🏓 Recordatorio de turno</h2>
            <p style="white-space:pre-line;color:#333;line-height:1.6">${emailBody}</p>
          </div>`
        })
      } catch (e) {
        console.error('Email recordatorio error:', e)
      }

      return res.status(200).json({ ok: true, emailBody })
    }

    return res.status(400).json({ error: 'Acción no reconocida' })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
