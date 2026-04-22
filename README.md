# AMS MTG — Aplicación Web Todo-en-Uno de Magic: The Gathering

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Scryfall API](https://img.shields.io/badge/Scryfall-API-1a1a2e?style=for-the-badge)

> Aplicación web académica diseñada para centralizar todas las herramientas necesarias para jugar y gestionar Magic: The Gathering: buscador de cartas, creación y administración de mazos, y un completo sistema de seguimiento de partidas.

---

## Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Arquitectura Objetivo](#arquitectura-objetivo)
- [Tecnologías](#tecnologías)
- [Integración con la API de Scryfall](#integración-con-la-api-de-scryfall)
- [Instalación y Desarrollo](#instalación-y-desarrollo)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Roadmap](#roadmap)
- [Equipo](#equipo)

---

## Descripción del Proyecto

**AMS MTG** es una aplicación web todo-en-uno para jugadores de Magic: The Gathering, desarrollada como proyecto académico con el objetivo de sustituir el uso de múltiples herramientas dispersas por una única plataforma centralizada.

El proyecto combina tres grandes módulos en una sola aplicación:

1. **Buscador de cartas** — Consulta en tiempo real la base de datos completa de Scryfall con filtros avanzados por color de maná, tipo de carta y nombre.
2. **Gestor de mazos** — Creación, edición y organización de mazos con persistencia local y, en versiones futuras, en la nube.
3. **Modo combate / Battle Arena** — Sistema de seguimiento de partidas multijugador con control de vidas, contadores, dado y moneda animados, rastreo de daño de comandante y registro histórico de acciones.

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
│ (externa)    │     │  (Supabase / Prisma) │
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
| **Supabase** *(roadmap)* | Base de datos + Auth | PostgreSQL gestionado con SDK de JS/TS |
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
# Scryfall no requiere API key.
# Variables necesarias para la integración con Supabase (roadmap):
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
```

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

### Autenticación de usuarios
- Sistema de registro e inicio de sesión.
- Perfil de usuario con mazos asociados.
- Sincronización entre dispositivos.

### Persistencia en base de datos
- Migración de `localStorage` a base de datos en la nube.
- CRUD completo de mazos desde cualquier dispositivo.
- Historial de partidas guardado por usuario.

---

## Equipo

Proyecto desarrollado por el **Grupo AMS** como proyecto académico.

| Nombre | Contacto |
|---|---|
| Equipo AMS | amsgrupoproyecto26@gmail.com |

---

> *AMS MTG no está afiliado ni es patrocinado por Wizards of the Coast. Magic: The Gathering es una marca registrada de Wizards of the Coast LLC.*
