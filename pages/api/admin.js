import { supabaseAdmin } from '../../lib/supabase'
import { fmtDate } from '../../lib/schedule'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD
}

export default async function handler(req, res) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'No autorizado' })

  if (req.method === 'GET') {
    const { estado, busqueda } = req.query
    let query = supabaseAdmin.from('reservas').select('*').order('fecha', { ascending: false }).order('turno', { ascending: true })
    if (estado && estado !== 'all') query = query.eq('estado', estado)
    if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%,email.ilike.%${busqueda}%`)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, accion } = req.body
    const { data: reserva } = await supabaseAdmin.from('reservas').select('*').eq('id', id).single()
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

    if (accion === 'cancelar') {
      const { error } = await supabaseAdmin.from('reservas').update({ estado: 'cancelado' }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })

      const emailBody = `Hola ${reserva.nombre},\n\nTu turno del ${fmtDate(reserva.fecha)} a las ${reserva.turno} hs fue cancelado.\n\nCuando quieras podés reservar un nuevo turno desde nuestro sistema. ¡Hasta pronto!\n\nSaludos,\n${process.env.FROM_NAME}`
      try {
        await resend.emails.send({
          from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
          to: reserva.email,
          subject: `Turno cancelado - ${fmtDate(reserva.fecha)} ${reserva.turno} hs`,
          text: emailBody,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#E24B4A">Turno cancelado</h2><p style="white-space:pre-line;color:#333;line-height:1.6">${emailBody}</p></div>`
        })
      } catch (e) { console.error('Email error:', e) }

      return res.status(200).json({ ok: true, emailBody })
    }

    if (accion === 'recordatorio') {
      const emailBody = `Hola ${reserva.nombre},\n\nTe recordamos que mañana tenés turno de tenis de mesa.\n\nFecha: ${fmtDate(reserva.fecha)}\nHorario: ${reserva.turno} hs\n\n¡No te olvides! Te esperamos en la cancha.\n\nSaludos,\n${process.env.FROM_NAME}`
      try {
        await resend.emails.send({
          from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
          to: reserva.email,
          subject: `Recordatorio: manana tenes turno a las ${reserva.turno} hs`,
          text: emailBody,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#1D9E75">Recordatorio de turno</h2><p style="white-space:pre-line;color:#333;line-height:1.6">${emailBody}</p></div>`
        })
      } catch (e) { console.error('Email error:', e) }

      return res.status(200).json({ ok: true, emailBody })
    }

    return res.status(400).json({ error: 'Acción no reconocida' })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
