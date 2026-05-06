# 🏓 Sistema de Turnos – Tenis de Mesa

App completa para que los clientes agenden sus propios turnos, con panel de admin y emails automáticos generados por IA.

**Stack:** Next.js · Supabase · Resend · Anthropic

---

## ⚡ Guía de instalación paso a paso

### 1. Clonar y configurar el proyecto

```bash
# Descomprimí el zip o copiá la carpeta
cd tenis-turnos
npm install
cp .env.local.example .env.local
```

---

### 2. Crear la base de datos en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratuita
2. Creá un nuevo proyecto (elegí la región más cercana)
3. Esperá que termine de configurarse (~1 minuto)
4. Andá a **SQL Editor → New Query**
5. Copiá y pegá todo el contenido de `supabase_schema.sql`
6. Hacé clic en **Run** → deberías ver "Success"

**Obtener las claves:**
- Andá a **Settings → API**
- Copiá `Project URL` → es tu `NEXT_PUBLIC_SUPABASE_URL`
- Copiá `anon public` → es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copiá `service_role` (secret) → es tu `SUPABASE_SERVICE_ROLE_KEY`

---

### 3. Configurar Resend (envío de emails)

1. Entrá a [resend.com](https://resend.com) y creá una cuenta gratuita
2. El plan gratuito incluye **3.000 emails/mes** — más que suficiente para empezar
3. Andá a **API Keys → Create API Key** → copiá la clave → es tu `RESEND_API_KEY`
4. **Verificar el dominio del email:**
   - Andá a **Domains → Add Domain**
   - Agregá tu dominio (ej: `tuclub.com`)
   - Seguí los pasos para agregar los registros DNS
   - Una vez verificado, podés usar `turnos@tuclub.com` como `FROM_EMAIL`
   - **Si no tenés dominio propio:** podés usar `onboarding@resend.dev` para pruebas

---

### 4. Obtener la API key de Anthropic

1. Entrá a [console.anthropic.com](https://console.anthropic.com)
2. Andá a **API Keys → Create Key**
3. Copiá la clave → es tu `ANTHROPIC_API_KEY`

---

### 5. Completar el archivo `.env.local`

Abrí `.env.local` y completá todos los valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

RESEND_API_KEY=re_123abc...
FROM_EMAIL=turnos@tuclub.com
FROM_NAME=Club Tenis de Mesa

ANTHROPIC_API_KEY=sk-ant-api03-...

ADMIN_PASSWORD=elegí-una-contraseña-segura
```

---

### 6. Probar localmente

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) — deberías ver la app funcionando.

---

### 7. Deploy en Vercel

1. Subí el proyecto a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Creá un repo en github.com y seguí las instrucciones para subirlo
   ```

2. Entrá a [vercel.com](https://vercel.com) y conectá tu cuenta de GitHub
3. Clic en **New Project** → importá el repositorio
4. En **Environment Variables**, agregá todas las variables de `.env.local`
5. Clic en **Deploy** → en 2 minutos tenés la URL pública

> ⚠️ **Importante:** Vercel no lee el archivo `.env.local` — tenés que cargar las variables manualmente en el dashboard de Vercel.

---

## 📁 Estructura del proyecto

```
tenis-turnos/
├── pages/
│   ├── index.js          ← App completa (cliente + admin)
│   └── api/
│       ├── reservas.js   ← POST: crear reserva + email de confirmación
│       ├── disponibilidad.js ← GET: turnos tomados por rango de fechas
│       └── admin.js      ← GET/PATCH: listar, cancelar, enviar recordatorio
├── lib/
│   ├── supabase.js       ← Clientes de Supabase (público y admin)
│   └── schedule.js       ← Horarios y helpers de fecha
├── styles/
│   ├── app.module.css    ← Estilos de la app
│   └── globals.css       ← Reset global
├── supabase_schema.sql   ← Script SQL para crear la base de datos
├── .env.local.example    ← Template de variables de entorno
└── package.json
```

---

## 🔧 Personalización

### Cambiar los horarios
Editá `lib/schedule.js` → objeto `SCHEDULE`. Las claves son el día de la semana (0=Dom, 1=Lun, ..., 6=Sáb).

### Cambiar la duración de los turnos
En `lib/schedule.js`, en la función `getSlots`, cambiá `t += 60` por la cantidad de minutos que querés (ej: `t += 30` para turnos de 30 minutos).

### Cambiar el tono de los emails
En `pages/api/reservas.js` y `pages/api/admin.js`, modificá los prompts de Anthropic para personalizar el estilo de los emails.

### Cambiar la contraseña del admin
Modificá `ADMIN_PASSWORD` en `.env.local` y en las variables de entorno de Vercel.

---

## 🚀 Funcionalidades

**Vista del cliente:**
- Calendario semanal con navegación
- Muestra cuántos turnos quedan disponibles por día
- Horarios bloqueados automáticamente si están tomados o ya pasaron
- Formulario de reserva (nombre, email, teléfono)
- Email de confirmación generado por IA y enviado automáticamente

**Panel de administración (protegido por contraseña):**
- Métricas: total, confirmados, cancelados, turnos del día
- Tabla completa de reservas con filtros y búsqueda
- Enviar recordatorio por email (generado por IA) a cualquier cliente
- Cancelar un turno → envía email de cancelación automáticamente

---

## 📧 Soporte

Si algo no funciona, revisá los logs en:
- **Vercel:** Dashboard → tu proyecto → Functions → logs
- **Supabase:** Dashboard → Logs → API logs
