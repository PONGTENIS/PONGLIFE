import { supabaseAdmin } from '../../lib/supabase'
import { fmtDate } from '../../lib/schedule'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend    = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { nombre, email, telefono, fecha, turno } = req.body

  // ── Validación básica ────────────────────────────────────────
  if (!nombre || !email || !fecha || !turno) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  // ── Verificar que el turno no esté ya tomado ─────────────────
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

  // ── Guardar en Supabase ──────────────────────────────────────
  const { data: reserva, error: dbError } = await supabaseAdmin
    .from('reservas')
    .insert({ nombre, email, telefono, fecha, turno, estado: 'confirmado' })
    .select()
    .single()

  if (dbError) {
    console.error('DB error:', dbError)
    return res.status(500).json({ error: 'Error al guardar la reserva' })
  }

  // ── Generar email con IA ─────────────────────────────────────
  let emailBody = ''
  try {
    const aiRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Generá un email de confirmación de turno de tenis de mesa.
Datos del turno:
- Nombre: ${nombre}
- Fecha: ${fmtDate(fecha)}
- Horario: ${turno} hs

Instrucciones:
- En español argentino, tuteo, tono amigable y cálido
- Máximo 6 líneas de texto corrido, sin markdown ni asteriscos
- Incluí: saludo, confirmación del turno, recordatorio de llegar 5 minutos antes, y despedida
- No incluyas asunto, firma ni aclaraciones extra, solo el cuerpo del email`
      }]
    })
    emailBody = aiRes.content?.[0]?.text || ''
  } catch (e) {
    console.error('AI error:', e)
    emailBody = `Hola ${nombre},\n\nTu turno de tenis de mesa quedó confirmado para el ${fmtDate(fecha)} de ${turno} hs.\n\nTe pedimos que llegues 5 minutos antes. ¡Nos vemos en la cancha!\n\nSaludos,\n${process.env.FROM_NAME}`
  }

  // ── Enviar email via Resend ──────────────────────────────────
  let emailSent = false
  try {
    await resend.emails.send({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to:   email,
      subject: `✅ Turno confirmado – ${fmtDate(fecha)} ${turno} hs`,
      text: emailBody,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1D9E75;margin-bottom:16px">✅ Turno confirmado</h2>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0;font-size:14px;color:#666">Fecha</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600">${fmtDate(fecha)}</p>
          <p style="margin:12px 0 0;font-size:14px;color:#666">Horario</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1D9E75">${turno} hs</p>
        </div>
        <p style="white-space:pre-line;color:#333;line-height:1.6">${emailBody}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="font-size:12px;color:#999">Este email fue enviado automáticamente. Por consultas respondé a ${process.env.FROM_EMAIL}</p>
      </div>`
    })
    emailSent = true
  } catch (e) {
    console.error('Email error:', e)
  }

  return res.status(200).json({ reserva, emailBody, emailSent })
}
