# AMS MTG — Aplicación Web Todo-en-Uno de Magic: The Gathering

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

> Aplicación web académica (TFG) para centralizar las herramientas de Magic: The Gathering: buscador de cartas con catálogo propio, creación y análisis de mazos con IA, y seguimiento de partidas multijugador.

---

## Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Módulo de Inteligencia Artificial](#módulo-de-inteligencia-artificial)
- [Tecnologías](#tecnologías)
- [Instalación y Puesta en Marcha](#instalación-y-puesta-en-marcha)
- [Scripts disponibles](#scripts-disponibles)
- [API REST](#api-rest)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Despliegue](#despliegue)

---

## Descripción del Proyecto

**AMS MTG** es una aplicación web todo-en-uno desarrollada como Trabajo de Fin de Grado. Combina cuatro módulos principales:

1. **Buscador de cartas** — Búsqueda sobre un catálogo propio (~34 000 cartas) con imágenes servidas desde Scryfall.
2. **Gestor de mazos** — Creación, edición y análisis inteligente de mazos.
3. **Asistente de mazos con IA** — Etiquetado funcional de cartas mediante reglas sobre `oracle_text` y análisis de equilibrio del mazo.
4. **Battle Arena** — Seguimiento completo de partidas multijugador.

---

## Funcionalidades

### Buscador de Cartas

- Búsqueda por nombre contra el **catálogo propio** en SQLite (no depende de Scryfall para los datos).
- Filtros por **color de identidad** (Blanco, Azul, Negro, Rojo, Verde).
- Imágenes cargadas en lote desde Scryfall (`/cards/collection`) tras obtener los resultados: las cartas aparecen todas a la vez, sin parpadeos.
- Carta **aleatoria** (Scryfall).
- Paginación de 20 cartas por página.

### Gestor de Mazos

- Crear múltiples mazos con nombre personalizado.
- Añadir y eliminar cartas.
- Persistencia en `localStorage`.
- Botón **"Analizar mazo"** que muestra:
  - Distribución de etiquetas funcionales (barras de progreso).
  - Alertas accionables: falta de destrucción, robo de cartas, ramp, jugadas tempranas, exceso de cartas caras.

### Battle Arena

- Cualquier número de jugadores con nombre y vida inicial (20 o 40).
- Botones +/− con pulsación sostenida para cambio rápido de vida.
- Contadores: veneno, daño de comandante, monarca, tax.
- Derrota automática (0 vidas / 10 veneno / 21 daño de comandante).
- Dado D20 y moneda animados en 3D.
- Búsqueda de comandante con autocompletado (Scryfall).
- Historial de las últimas 50 acciones con timestamp.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                     Cliente (SvelteKit)                  │
│   Buscador · Gestor de Mazos · Battle Arena              │
└───────────────────────┬─────────────────────────────────┘
                        │ fetch
┌───────────────────────▼─────────────────────────────────┐
│                  API Routes (SvelteKit)                   │
│  /api/cards · /api/decks · /api/decks/analyze            │
│  /api/auth/login · /api/auth/register · /api/auth/logout │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
  ┌────────▼────────┐        ┌────────▼────────────┐
  │   SQLite (Prisma)│        │   Scryfall API       │
  │  ~34k cartas     │        │  (solo imágenes)     │
  │  usuarios, mazos │        └─────────────────────┘
  └─────────────────┘

  Python (offline)
  └─ tag_cards.py → escribe tags en SQLite
```

### Flujo de datos al buscar una carta

1. El frontend llama a `GET /api/cards?q=nombre&colors=W&page=1`.
2. La API consulta SQLite con Prisma y devuelve los 20 resultados.
3. El frontend llama a `POST https://api.scryfall.com/cards/collection` con los 20 nombres para obtener las imágenes en una sola petición.
4. Las cartas aparecen completas de golpe.

---

## Módulo de Inteligencia Artificial

El módulo de IA utiliza **etiquetado basado en reglas** (multi-label) en lugar de clustering no supervisado, porque permite asignar roles funcionales precisos y una carta puede pertenecer a múltiples categorías simultáneamente.

### Tags asignados a cada carta

| Categoría | Tags |
|-----------|------|
| **Coste de maná** | `bajo-coste` (cmc ≤ 2), `coste-medio` (3–4), `alto-coste` (≥ 5) |
| **Tipo de carta** | `criatura`, `instantaneo`, `conjuro`, `artefacto`, `encantamiento`, `tierra`, `planeswalker` |
| **Rol funcional** | `destruccion`, `robo-cartas`, `ramp`, `contrahechizo`, `tokens`, `evasion`, `proteccion`, `vida`, `daño-directo` |

Las reglas se aplican sobre `oracle_text`, `type_line`, `keywords` y `cmc` de cada carta.

### Script de etiquetado (`python/tag_cards.py`)

Lee las ~34 000 cartas del SQLite y escribe el array de tags en la columna `tags` de cada carta. Ejemplos reales:

- *Lightning Bolt* → `["instantaneo", "bajo-coste", "daño-directo"]`
- *Llanowar Elves* → `["criatura", "bajo-coste", "ramp"]`
- *Counterspell* → `["instantaneo", "bajo-coste", "contrahechizo"]`
- *Sol Ring* → `["artefacto", "bajo-coste", "ramp"]`

### Analizador de mazos

El endpoint `POST /api/decks/analyze` recibe la lista de cartas del mazo y devuelve:

- **Distribución** de tags (cuántas cartas tiene cada categoría).
- **Alertas** accionables, por ejemplo:
  - "Tu mazo no tiene destrucción."
  - "Tu mazo no tiene aceleración de maná."
  - "Demasiadas cartas de alto coste (62%). Considera añadir más ramp."

---

## Tecnologías

| Tecnología | Versión | Rol |
|------------|---------|-----|
| SvelteKit | 2.x | Framework web (SSR + API routes) |
| TypeScript | 6.x | Lenguaje principal |
| Tailwind CSS | 4.x | Estilos |
| Prisma | 5.x | ORM para SQLite |
| SQLite | — | Base de datos local |
| Python | 3.13 | Script de etiquetado de cartas |
| pandas | 2.x | Manipulación de datos en Python |
| Scryfall API | — | Fuente de imágenes y carta aleatoria |
| bcryptjs | 3.x | Hash de contraseñas |
| jose | 6.x | Autenticación JWT |

---

## Instalación y Puesta en Marcha

### Requisitos

- Node.js >= 18
- Python >= 3.10
- npm >= 9

### Primer arranque (tras clonar)

**1. Genera un JWT_SECRET** y cópialo en `.env`:

```powershell
npm run generate-secret
```

```env
JWT_SECRET="el-valor-generado"
DATABASE_URL="file:./dev.db"
```

**2. Instala las dependencias Python** (solo la primera vez):

```powershell
cd python
pip install -r requirements.txt
cd ..
```

**3. Ejecuta el setup completo:**

```powershell
npm run setup
```

Este script realiza todo el proceso en orden:

1. Crea `.env` desde `.env.example` si no existe, y para para que lo edites.
2. Ejecuta las migraciones de Prisma y crea la tabla de cartas en SQLite.
3. Descarga el catálogo `oracle_cards` de Scryfall (~165 MB, ~34 000 cartas) e inserta las cartas en la base de datos.
4. Ejecuta `python/tag_cards.py` para etiquetar todas las cartas con sus roles funcionales (destrucción, ramp, robo de cartas, etc.).

### Iniciar el servidor de desarrollo

```powershell
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run setup` | Configuración inicial post-clonado |
| `npm run import-cards` | Importar catálogo de Scryfall a SQLite |
| `npm run tag-cards` | Ejecutar el etiquetado de cartas con IA |
| `npm run generate-secret` | Generar un JWT_SECRET aleatorio |
| `npm run check` | Comprobación de tipos TypeScript |
| `npm run lint` | Linting y formato |

---

## API REST

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Inicio de sesión (devuelve cookie JWT) |
| POST | `/api/auth/logout` | Cierre de sesión |

### Cartas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cards?q=&colors=W,U&page=1` | Búsqueda paginada (20 por página) |
| GET | `/api/cards/:id` | Detalle de una carta |

### Mazos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/decks` | Listar mazos del usuario |
| POST | `/api/decks` | Crear mazo |
| PUT | `/api/decks/:id` | Actualizar mazo |
| DELETE | `/api/decks/:id` | Eliminar mazo |
| GET | `/api/decks/:id/analysis` | Análisis de un mazo guardado en BD |
| POST | `/api/decks/analyze` | Análisis ad-hoc (acepta lista de nombres) |

---

## Estructura del Proyecto

```
ams-mtg/
├── src/
│   ├── lib/
│   │   └── server/
│   │       ├── db.ts              # Cliente Prisma
│   │       └── auth.ts            # JWT, bcrypt, sesiones
│   ├── routes/
│   │   ├── +layout.svelte         # Guard de autenticación
│   │   ├── +page.svelte           # Buscador + gestor de mazos
│   │   ├── login/                 # Registro e inicio de sesión
│   │   ├── partida/               # Battle Arena
│   │   └── api/
│   │       ├── auth/              # login, register, logout
│   │       ├── cards/             # búsqueda y detalle
│   │       └── decks/             # CRUD + analyze
│   └── hooks.server.ts            # Middleware de autenticación
├── prisma/
│   ├── schema.prisma              # Modelos: User, Session, Deck, Card
│   └── migrations/                # Historial de migraciones
├── python/
│   ├── tag_cards.py               # Etiquetado de cartas con reglas
│   └── requirements.txt           # pandas, scikit-learn
├── scripts/
│   ├── setup.ps1                  # Configuración inicial
│   ├── import-cards.js            # Importador de Scryfall
│   └── generate-secret.ps1        # Generador de JWT_SECRET
├── .env.example                   # Plantilla de variables de entorno
├── package.json
└── svelte.config.js
```

---

## Despliegue

La aplicación está diseñada para desplegarse en **Cloudflare Pages** con **Cloudflare D1** como base de datos (SQLite distribuido). El esquema Prisma es compatible con D1 sin cambios — solo se necesita actualizar el adapter de SvelteKit y el `DATABASE_URL`.

Para desarrollo local se usa SQLite en archivo (`prisma/dev.db`), que está excluido del repositorio.

---

> *AMS MTG no está afiliado ni patrocinado por Wizards of the Coast. Magic: The Gathering es marca registrada de Wizards of the Coast LLC.*
