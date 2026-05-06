-- ============================================================
--  SCHEMA: Sistema de Turnos – Tenis de Mesa
--  Ejecutar en: Supabase → SQL Editor → New Query → Run
-- ============================================================

-- Tabla principal de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  telefono    TEXT,
  fecha       DATE NOT NULL,           -- Ej: 2025-06-14
  turno       TEXT NOT NULL,           -- Ej: "14:00 - 15:00"
  estado      TEXT NOT NULL DEFAULT 'confirmado'
                CHECK (estado IN ('confirmado', 'cancelado')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_reservas_fecha  ON reservas (fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_email  ON reservas (email);

-- Evitar doble reserva del mismo horario el mismo día
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_fecha_turno
  ON reservas (fecha, turno)
  WHERE estado = 'confirmado';

-- ─── Row Level Security ──────────────────────────────────────
-- Habilitamos RLS: el anon key solo puede INSERT y SELECT limitado
-- El service_role key (usado en el backend) puede todo
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede leer los turnos tomados (para mostrar disponibilidad)
CREATE POLICY "Ver turnos tomados" ON reservas
  FOR SELECT USING (true);

-- Política: cualquiera puede crear una reserva
CREATE POLICY "Crear reserva" ON reservas
  FOR INSERT WITH CHECK (true);

-- Política: solo service_role puede actualizar (cancelar)
-- Las actualizaciones se hacen desde el backend con SUPABASE_SERVICE_ROLE_KEY
CREATE POLICY "Actualizar reserva (admin)" ON reservas
  FOR UPDATE USING (auth.role() = 'service_role');

-- ─── Vista útil para el admin ────────────────────────────────
CREATE OR REPLACE VIEW vista_reservas AS
SELECT
  id,
  nombre,
  email,
  telefono,
  TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha_display,
  fecha,
  turno,
  estado,
  TO_CHAR(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS registrado_el
FROM reservas
ORDER BY fecha DESC, turno ASC;
