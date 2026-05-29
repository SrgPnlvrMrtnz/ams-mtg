# AMS MTG — Aplicación Web Todo-en-Uno de Magic: The Gathering

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Scryfall API](https://img.shields.io/badge/Scryfall-API-1a1a2e?style=for-the-badge)

> Aplicación web académica diseñada para centralizar todas las herramientas necesarias para jugar y gestionar Magic: The Gathering: buscador de cartas, creación y administración de mazos, un completo sistema de seguimiento de partidas, y un asistente de recomendación de cartas basado en clustering.

---

## Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Asistente de Mazos con Clustering](#asistente-de-mazos-con-clustering)
- [Arquitectura Objetivo](#arquitectura-objetivo)
- [Tecnologías](#tecnologías)
- [Integración con la API de Scryfall](#integración-con-la-api-de-scryfall)
- [Instalación y Desarrollo](#instalación-y-desarrollo)
- [Despliegue en Cloudflare Pages](#despliegue-en-cloudflare-pages)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Roadmap](#roadmap)
- [Equipo](#equipo)

---

## Descripción del Proyecto

**AMS MTG** es una aplicación web todo-en-uno para jugadores de Magic: The Gathering, desarrollada como proyecto académico con el objetivo de sustituir el uso de múltiples herramientas dispersas por una única plataforma centralizada.

El proyecto combina cuatro grandes módulos en una sola aplicación:

1. **Buscador de cartas** — Consulta en tiempo real la base de datos completa de Scryfall con filtros avanzados por color de maná, tipo de carta y nombre.
2. **Gestor de mazos** — Creación, edición y organización de mazos con persistencia local y, en versiones futuras, en la nube.
3. **Modo combate / Battle Arena** — Sistema de seguimiento de partidas multijugador con control de vidas, contadores, dado y moneda animados, rastreo de daño de comandante y registro histórico de acciones.
4. **Asistente de mazos** — Módulo avanzado de recomendación de cartas basado en clustering (Python), que detecta desequilibrios en el mazo y sugiere cartas similares o complementarias.

---

## Funcionalidades

### Buscador de Cartas

- Búsqueda por nombre integrada con la **API de Scryfall** en tiempo real.
- **Filtros por color de maná**: Blanco ☀️, Azul 💧, Negro 💀, Rojo 🔥, Verde 🌳.
- Botón de carta **aleatoria** para explorar el catálogo de Magic.
- **Paginación** de resultados con navegación entre páginas.
- Visualización de imagen, nombre y tipo de carta en cuadrícula responsiva.

### Gestión de Mazos y Favoritos

- Marcar cartas como **favoritas** (guardadas en local).
- Crear **múltiples mazos** con nombre personalizado.
- Agregar y eliminar cartas de cualquier mazo.
- Persistencia automática: los datos se conservan entre sesiones del navegador.

### Modo Combate (Battle Arena)

- Agregar cualquier número de **jugadores** con nombre y vida inicial (20 o 40).
- Botones +/− con pulsación sostenida para cambio rápido de vida.
- Animación de **vibración** al recibir daño.
- Detección automática de **derrota** al llegar a 0 vidas, 10 de veneno, o 21 de daño de comandante.
- Indicador de **victoria** con animación especial al quedar un solo jugador en pie.

**Sistemas de contadores:**
- Veneno (0–10, derrota automática a 10)
- Daño de Comandante (por oponente, derrota a 21)
- Monarca (único por partida, efecto visual dorado)
- Tax (contador de impuesto, +2 incremental)

**Herramientas de aleatoriedad:**
- Dado D20 con animación de rotación 3D.
- Moneda con animación de lanzamiento 3D (cara/cruz).

**Búsqueda de Comandante:**
- Autocompletado integrado con Scryfall usando el filtro `is:commander`.
- La imagen del comandante elegido se aplica como fondo de la tarjeta del jugador.

**Historial de partida:**
- Panel flotante con las últimas 50 acciones registradas.
- Cada entrada incluye timestamp y descripción de la acción.
- Reinicio de partida sin borrar la configuración de jugadores.

---

## Asistente de Mazos con Clustering

Como mejora avanzada sobre el MVP, AMS MTG incluirá un módulo de recomendación de cartas construido en **Python** mediante técnicas de **clustering**. El objetivo no es construir automáticamente "el mejor mazo", sino asistir al jugador detectando desequilibrios y sugiriendo cartas afines a su estrategia.

### ¿Qué hace el sistema?

El script de clustering analiza el catálogo de cartas y las agrupa según sus características jugables, generando grupos como:

- Cartas de coste bajo y juego rápido.
- Criaturas grandes y de coste alto.
- Instantáneos y conjuros de apoyo.
- Tierras y cartas sin coste de maná.
- Cartas defensivas o de protección.
- Cartas multicolor.

El algoritmo **no entiende Magic** como un jugador experto: detecta patrones en los datos y asigna a cada carta un identificador de cluster. La lógica de negocio (colores compatibles, curva de maná, legalidad en formato) se aplica por separado en las reglas de la aplicación.

### Campos usados para el agrupamiento

De la API de Scryfall y del JSON de cartas se utilizan los siguientes campos:

| Campo | Descripción |
|---|---|
| `cmc` | Coste convertido de maná |
| `colors` / `color_identity` | Colores de la carta |
| `card_types` | Criatura, instantáneo, conjuro, tierra, artefacto... |
| `keywords` | Habilidades y palabras clave |
| `power` / `toughness` | Fuerza y resistencia (criaturas) |
| `rarity` | Común, infrecuente, rara, mítica |
| `legalities` | Formatos en los que la carta es legal |

> Campos como artista, imagen o número de colección se usan solo para presentación visual, no para el clustering.

### Funcionalidades del asistente

- **Cartas similares**: al ver una carta, mostrar otras del mismo cluster.
- **Variedad controlada**: sugerir cartas de clusters no representados en el mazo.
- **Análisis del mazo**: detectar exceso de cartas caras, falta de hechizos baratos o escasez de tierras.
- **Recomendaciones por estilo**: filtrar sugerencias por perfil agresivo, defensivo o de apoyo.
- **Comparación de mazos**: indicar si dos mazos tienen perfiles jugables similares.

Un ejemplo de mensaje que podría mostrar la aplicación:

```
Tu mazo tiene muchas criaturas de coste alto.
Faltan cartas de coste 1-2.
No tienes casi instantáneos de respuesta rápida.
Sugerencia: revisa cartas de los clusters de coste bajo y apoyo defensivo.
```

### Flujo técnico

```
Scryfall JSON
     │
     ▼
script Python (clustering)
 · limpieza de campos
 · normalización numérica
 · algoritmo de clustering (K-Means / DBSCAN)
 · exportación: cards_with_clusters.json
     │
     ▼
Base de datos / JSON estático
     │
     ▼
API Routes (SvelteKit)  ──►  Componente Asistente (frontend)
```

### Prioridad y alcance

| Funcionalidad | Viabilidad | Prioridad |
|---|---|---|
| MVP (búsqueda, usuarios, mazos) | Alta | Primera fase |
| Clustering básico de cartas | Alta | Segunda fase |
| Recomendador de cartas similares | Media-alta | Segunda fase |
| Constructor automático de mazos competitivos | Baja-media | Fuera de alcance |

---

## Arquitectura Objetivo

La versión final del proyecto migrará a una arquitectura moderna basada en **SvelteKit** y **TypeScript**, con las siguientes capas:

```
┌─────────────────────────────────────────────────┐
│                   Cliente                        │
│         SvelteKit + TypeScript + Tailwind        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Buscador│ │  Mazos   │ │  Battle Arena    │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└───────────────────┬─────────────────────────────┘
                    │ fetch / SvelteKit API routes
┌───────────────────▼─────────────────────────────┐
│             API Routes (SvelteKit)               │
│  /api/cards · /api/decks · /api/sessions         │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼──────┐     ┌──────────▼──────────┐
│ Scryfall API │     │  Base de Datos       │
│ (externa)    │     │  (SQLite / Prisma)   │
└──────────────┘     └─────────────────────┘
```

### Decisiones de diseño

**SvelteKit** fue elegido como framework frontend por su rendimiento nativo sin virtual DOM, su sistema de enrutamiento basado en archivos, y la integración directa de SSR (Server-Side Rendering) y API routes en un único proyecto. Esto simplifica la arquitectura al eliminar la necesidad de un backend separado para operaciones básicas.

**TypeScript** garantiza tipado estático en todo el proyecto, facilitando el mantenimiento y la detección temprana de errores, especialmente al trabajar con la respuesta de la API de Scryfall, que devuelve objetos JSON complejos y variados según el tipo de carta.

---

## Tecnologías

| Tecnología | Rol | Justificación |
|---|---|---|
| **SvelteKit** | Framework web (objetivo) | SSR, routing, API routes integradas |
| **TypeScript** | Lenguaje principal | Tipado estático, seguridad en desarrollo |
| **Tailwind CSS** | Estilos | Utilidad, consistencia, rapid prototyping |
| **Scryfall API** | Fuente de datos de cartas | Base de datos completa y gratuita de MTG |
| **Python** | Clustering y análisis de cartas | Preprocesamiento de datos y agrupamiento (K-Means / DBSCAN) |
| **SQLite + Prisma** | Base de datos local | Ligera, sin servidor; pendiente de migrar a D1 para producción |
| **Cloudflare Pages** | Plataforma de despliegue | Edge global, tier gratuito, preview URLs por PR |
| **HTML / CSS / JS** | Prototipo actual | Prueba de concepto funcional sin dependencias |

---

## Integración con la API de Scryfall

[Scryfall](https://scryfall.com/docs/api) es la base de datos pública más completa de Magic: The Gathering. AMS MTG utiliza los siguientes endpoints:

| Endpoint | Uso en la app |
|---|---|
| `GET /cards/search?q={query}` | Búsqueda de cartas por nombre |
| `GET /cards/search?q=color:{c}` | Filtrado por color de maná |
| `GET /cards/search?q=is:commander` | Búsqueda específica de comandantes |
| `GET /cards/random` | Carta aleatoria |
| `GET /cards/autocomplete?q={query}` | Autocompletado de nombres |

La API es **gratuita, sin autenticación** y devuelve objetos JSON con imagen, nombre, tipo, coste de maná, texto de reglas y metadatos de cada carta.

---

## Instalación y Desarrollo

### Requisitos

- Node.js >= 18
- npm >= 9

### Clonar e instalar

```bash
git clone https://github.com/tu-usuario/ams-mtg.git
cd ams-mtg
npm install
```

### Desarrollo local

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Construir para producción

```bash
npm run build
npm run preview
```

### Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
# Obligatoria para firmar/verificar JWT de login.
JWT_SECRET="cambia-esto-por-un-secreto-largo-y-aleatorio"

# Scryfall no requiere API key.
# Variables necesarias para la integración con SQLite (roadmap):
DATABASE_URL="file:./dev.db"
```

---

## Despliegue en Cloudflare Pages

AMS MTG se despliega en **Cloudflare Pages**, que ejecuta el servidor SvelteKit como un Worker en el edge global de Cloudflare. Los activos estáticos se sirven desde el CDN y las API routes se ejecutan como funciones serverless sin necesidad de un servidor dedicado.

### Flujo de despliegue

```
git push → GitHub
    │
    └─► Cloudflare Pages detecta el push
            │
            ├─ npm install
            ├─ npm run build
            └─► despliega en https://ams-mtg.pages.dev
```

Cada pull request genera automáticamente una **preview URL** independiente para revisar cambios antes de mergear.

### Cambios necesarios respecto al desarrollo local

**1. Cambiar el adapter de SvelteKit**

```bash
npm install -D @sveltejs/adapter-cloudflare
```

En `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
```

**2. Añadir `wrangler.toml`** en la raíz del proyecto:

```toml
name = "ams-mtg"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
```

El flag `nodejs_compat` es necesario para que `bcryptjs` y Prisma Client funcionen en el entorno Workers, que no incluye todas las APIs de Node.js por defecto.

**3. Variables de entorno**

En producción las variables no se leen desde `.env`. Se configuran desde el dashboard de Cloudflare Pages (*Settings → Environment variables*) o con la CLI de Wrangler:

```bash
wrangler secret put DATABASE_URL
```

### Limitación actual: base de datos

SQLite utiliza el sistema de archivos local, lo que **no es compatible con el entorno Workers** (sin acceso a disco). La solución es migrar a **Cloudflare D1**, la base de datos SQLite distribuida de Cloudflare, que es compatible con Prisma y no requiere cambios en el esquema.

Esta migración está pendiente y se realizará una vez que el resto de funcionalidades estén estables. Hasta entonces, la aplicación se puede desplegar en Cloudflare Pages pero las rutas que dependen de la base de datos no funcionarán en producción.

### Conectar el repositorio a Cloudflare Pages

1. Acceder a [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages → Create**.
2. Conectar la cuenta de GitHub y seleccionar el repositorio `ams-mtg`.
3. Configurar el build:

| Parámetro | Valor |
|---|---|
| Framework preset | SvelteKit |
| Build command | `npm run build` |
| Build output directory | `.svelte-kit/cloudflare` |
| Node.js version | 18 |

4. Añadir la variable de entorno `DATABASE_URL` (aunque actualmente no funcional en Workers).
5. Desplegar.

---

## Estructura del Proyecto

Estructura objetivo del proyecto en SvelteKit:

```
ams-mtg/
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   └── scryfall.ts        # Cliente tipado para Scryfall API
│   │   ├── components/
│   │   │   ├── CardGrid.svelte    # Cuadrícula de cartas
│   │   │   ├── DeckPanel.svelte   # Panel de gestión de mazos
│   │   │   ├── PlayerCard.svelte  # Tarjeta de jugador en Battle Arena
│   │   │   ├── DiceRoller.svelte  # Dado D20 animado
│   │   │   └── CoinFlip.svelte    # Moneda animada
│   │   ├── stores/
│   │   │   ├── decks.ts           # Estado global de mazos
│   │   │   ├── favorites.ts       # Estado global de favoritos
│   │   │   └── battle.ts          # Estado global de partida
│   │   └── types/
│   │       ├── card.ts            # Tipos de la API de Scryfall
│   │       ├── deck.ts            # Tipos de mazos
│   │       └── player.ts          # Tipos de jugadores
│   ├── routes/
│   │   ├── +layout.svelte         # Layout principal
│   │   ├── +page.svelte           # Página principal (buscador)
│   │   ├── battle/
│   │   │   └── +page.svelte       # Modo combate
│   │   └── api/
│   │       ├── decks/
│   │       │   └── +server.ts     # API REST de mazos
│   │       └── sessions/
│   │           └── +server.ts     # API REST de partidas
│   └── app.html
├── static/
├── tests/
├── .env
├── svelte.config.js
├── tsconfig.json
└── package.json
```

---

## Roadmap

### Fase 1 — MVP (prioridad)
- Sistema de registro e inicio de sesión (usuarios privados).
- Perfil de usuario con mazos asociados.
- Migración de `localStorage` a base de datos SQLite local.
- CRUD completo de mazos desde cualquier dispositivo.
- Historial de partidas guardado por usuario.

### Fase 2 — Asistente de mazos con clustering (Python)
- Script Python para limpiar y normalizar los campos jugables del JSON de Scryfall.
- Aplicar algoritmo de clustering (K-Means u otro) sobre el conjunto de cartas.
- Exportar el resultado (`cards_with_clusters.json`) e integrarlo en la base de datos.
- Endpoint en SvelteKit para servir recomendaciones por cluster.
- Componente frontend "Asistente de mazos" con:
  - Cartas similares a la seleccionada.
  - Análisis de desequilibrios del mazo actual.
  - Sugerencias de cartas de clusters no representados.

---

## Equipo

Proyecto desarrollado por el **Grupo AMS** como proyecto académico.

| Nombre | Contacto |
|---|---|
| Equipo AMS | amsgrupoproyecto26@gmail.com |

---

> *AMS MTG no está afiliado ni es patrocinado por Wizards of the Coast. Magic: The Gathering es una marca registrada de Wizards of the Coast LLC.*
