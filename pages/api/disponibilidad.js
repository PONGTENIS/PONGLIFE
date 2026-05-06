import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  const { desde, hasta } = req.query

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Se requieren los parámetros desde y hasta (YYYY-MM-DD)' })
  }

  const { data, error } = await supabase
    .from('reservas')
    .select('fecha, turno')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .eq('estado', 'confirmado')

  if (error) {
    console.error('DB error:', error)
    return res.status(500).json({ error: 'Error al consultar disponibilidad' })
  }

  // Agrupar por fecha: { "2025-06-14": ["14:00 - 15:00", ...] }
  const porFecha = {}
  for (const row of data) {
    if (!porFecha[row.fecha]) porFecha[row.fecha] = []
    porFecha[row.fecha].push(row.turno)
  }

  return res.status(200).json(porFecha)
}
