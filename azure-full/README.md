# Línea 1.5 v3 — Migración completa a Azure (sin Supabase)

## Servicios Azure que reemplaza a Supabase

| Supabase           | Azure                                  | Para qué                        |
|--------------------|----------------------------------------|---------------------------------|
| PostgreSQL         | Azure Database for PostgreSQL Flexible | BD principal                    |
| Supabase Auth      | JWT propio (jsonwebtoken + bcrypt)     | Login, tokens, roles            |
| Supabase Storage   | Azure Blob Storage                     | Archivos adjuntos de evidencias |

---

## 1. Crear los recursos en Azure Portal

### A) Azure Database for PostgreSQL — Flexible Server
1. Portal → Crear recurso → **Azure Database for PostgreSQL Flexible Server**
2. Configuración mínima:
   - **SKU**: Burstable, B1ms (1 vCore, 2 GB) — suficiente para empezar (~$15/mes)
   - **PostgreSQL version**: 16
   - **Admin username**: `adminlinea15`
   - **Password**: [genera uno seguro]
   - **Region**: East US 2 (o la más cercana)
3. En **Networking**: habilitar "Allow public access from Azure services"
4. Guarda el hostname: `linea15.postgres.database.azure.com`

### B) Azure Blob Storage
1. Portal → Crear recurso → **Storage Account**
2. Nombre: `linea15storage` (debe ser único globalmente)
3. **Performance**: Standard, **Redundancy**: LRS (mínimo costo)
4. Ir a la cuenta → **Containers** → crear contenedor `evidencias`
5. **Public access level**: Blob (para URLs públicas de archivos)
6. Ir a **Access keys** → copiar `Key1`

### C) Azure Static Web Apps
1. Portal → Crear recurso → **Static Web App**
2. Plan: **Free**
3. Conectar a tu repositorio GitHub
4. Build settings:
   - App location: `/`
   - Api location: `/api`
   - Output location: `dist`

---

## 2. Variables de entorno en Azure Static Web Apps

Portal → tu Static Web App → **Configuration** → agregar:

```
# PostgreSQL
PG_HOST       = linea15.postgres.database.azure.com
PG_PORT       = 5432
PG_DATABASE   = linea15
PG_USER       = adminlinea15
PG_PASSWORD   = [tu password]

# JWT (genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET    = [mínimo 64 caracteres aleatorios]

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT   = linea15storage
AZURE_STORAGE_KEY       = [Key1 de tu Storage Account]
AZURE_STORAGE_CONTAINER = evidencias

# App
FRONTEND_URL  = https://tu-app.azurestaticapps.net

# Email (para recuperación de contraseña — opcional)
SMTP_HOST     = smtp.office365.com   (o smtp.gmail.com)
SMTP_PORT     = 587
SMTP_USER     = noreply@tuorg.com
SMTP_PASS     = [password del correo]
SMTP_FROM     = noreply@tuorg.com
```

---

## 3. Inicializar la base de datos

Conéctate a tu PostgreSQL de Azure y ejecuta el schema:

```bash
psql "host=linea15.postgres.database.azure.com dbname=linea15 user=adminlinea15 sslmode=require" \
     -f schema.sql
```

O desde Azure Portal → tu servidor PostgreSQL → **Databases** → Query editor.

---

## 4. Crear el primer usuario admin

```bash
cd api
npm install

PG_HOST=linea15.postgres.database.azure.com \
PG_DATABASE=linea15 \
PG_USER=adminlinea15 \
PG_PASSWORD=tu_password \
node scripts/seed-admin.js
```

Edita `scripts/seed-admin.js` primero para cambiar el email y la contraseña.

---

## 5. Instalar dependencias y hacer deploy

```bash
cd api && npm install
cd ..
git add .
git commit -m "chore: migración completa a Azure sin Supabase"
git push
```

Azure despliega automáticamente al detectar el push.

---

## 6. El frontend no cambia nada

`src/api/client.js` sigue llamando a `/api/...` — exactamente igual.
Los componentes React, los roles, los permisos, el dashboard — todo igual.

---

## Estructura de archivos que cambia

```
raíz/
└── staticwebapp.config.json    ← reemplaza vercel.json

api/
├── host.json
├── package.json                ← nuevas dependencias (pg, bcryptjs, jsonwebtoken...)
├── scripts/
│   └── seed-admin.js           ← crea el primer admin
├── lib/
│   ├── db.js                   ← conexión a PostgreSQL (reemplaza supabase.js)
│   ├── storage.js              ← Azure Blob Storage (reemplaza Supabase Storage)
│   └── auth.js                 ← JWT + CORS guards (reemplaza Supabase Auth)
├── auth/        index.js + function.json
├── projects/    index.js + function.json
├── projectsId/  index.js + function.json  ← maneja /api/projects/{id}
├── controls/    index.js + function.json
├── evidences/   index.js + function.json
├── users/       index.js + function.json
├── logs/        index.js + function.json
└── archive/     index.js + function.json

schema.sql                      ← ejecutar UNA VEZ en la BD de Azure
```

---

## Costo mensual estimado

| Servicio                        | Plan mínimo     | Costo aprox. |
|---------------------------------|-----------------|--------------|
| Azure Static Web Apps           | Free            | $0           |
| Azure Database for PostgreSQL   | B1ms Burstable  | ~$15–25      |
| Azure Blob Storage              | LRS Standard    | ~$2–5        |
| JWT + bcrypt                    | Código propio   | $0           |
| **Total**                       |                 | **~$17–30/mes** |

---

## Si tienes datos en Supabase y quieres migrarlos

```bash
# 1. Exportar desde Supabase (obtén la connection string desde Supabase → Settings → Database)
pg_dump "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
        --no-owner --no-acl \
        -t profiles -t projects -t controls -t evidences -t evidence_files -t audit_logs \
        > dump_supabase.sql

# 2. Ajustar nombres de tabla en el dump (profiles → users, project_perms → project_perms)
# (La tabla profiles de Supabase es equivalente a users aquí)

# 3. Restaurar en Azure PostgreSQL
psql "host=linea15.postgres.database.azure.com dbname=linea15 user=adminlinea15 sslmode=require" \
     < dump_supabase.sql
```

Los archivos de evidencias en Supabase Storage se pueden migrar descargándolos y re-subiéndolos
a Azure Blob Storage con `az storage blob upload-batch`.
