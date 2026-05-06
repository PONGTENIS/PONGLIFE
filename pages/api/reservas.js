import { supabaseAdmin } from '../../lib/supabase'
import { fmtDate } from '../../lib/schedule'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function emailBody(nombre, fecha, turno) {
  return `Hola ${nombre},\n\n¡Tu turno de tenis de mesa quedó confirmado!\n\nFecha: ${fmtDate(fecha)}\nHorario: ${turno} hs\n\nTe pedimos que llegues 5 minutos antes. ¡Te esperamos en la cancha!\n\nSaludos,\n${process.env.FROM_NAME}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { nombre, email, telefono, fecha, turno } = req.body

  if (!nombre || !email || !fecha || !turno) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  const { data: existing } = await supabaseAdmin
    .from('reservas')
    .select('id')
    .eq('fecha', fecha)
    .eq('turno', turno)
    .eq('estado', 'confirmado')
    .maybeSingle()

  if (existing) {
    return res.status(409).json({ error: 'Este turno ya está reservado. Por favor elegí otro.' })
  }

  const { data: reserva, error: dbError } = await supabaseAdmin
    .from('reservas')
    .insert({ nombre, email, telefono, fecha, turno, estado: 'confirmado' })
    .select()
    .single()

  if (dbError) {
    console.error('DB error:', dbError)
    return res.status(500).json({ error: 'Error al guardar la reserva' })
  }

  const body = emailBody(nombre, fecha, turno)

  let emailSent = false
  try {
    await resend.emails.send({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `Turno confirmado - ${fmtDate(fecha)} ${turno} hs`,
      text: body,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1D9E75">Turno confirmado</h2>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0;font-size:14px;color:#666">Fecha</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600">${fmtDate(fecha)}</p>
          <p style="margin:12px 0 0;font-size:14px;color:#666">Horario</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1D9E75">${turno} hs</p>
        </div>
        <p style="white-space:pre-line;color:#333;line-height:1.6">${body}</p>
      </div>`
    })
    emailSent = true
  } catch (e) {
    console.error('Email error:', e)
  }

  return res.status(200).json({ reserva, emailBody: body, emailSent })
}
