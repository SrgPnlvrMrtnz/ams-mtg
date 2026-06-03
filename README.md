# AMS MTG — Aplicación Web para Magic: The Gathering

Proyecto académico desarrollado con **SvelteKit + TypeScript**. Es una plataforma web para jugadores de Magic: The Gathering que centraliza el buscador de cartas y la gestión de mazos en una sola interfaz.

---

## Estado actual de la rama `backend`

Esta rama contiene la aplicación funcional con las siguientes características implementadas:

| Módulo | Estado |
|---|---|
| Buscador de cartas con filtros por color | Implementado |
| Paginación de resultados | Implementado |
| Carta aleatoria | Implementado |
| Modal de detalle de carta | Implementado |
| Lista de cartas favoritas | Implementado |
| Crear y eliminar mazos | Implementado |
| Añadir y quitar cartas de un mazo | Implementado |
| Página de detalle de mazo | Implementado |
| Modo batalla (`/partida`) | Pendiente (enlace sin ruta) |
| Autenticación de usuarios | Pendiente (botón sin backend) |
| Módulo de recomendación con clustering (Python) | Pendiente |

---

## Stack tecnológico

| Tecnología | Rol |
|---|---|
| SvelteKit 2 + Svelte 5 | Framework web (SSR + cliente) |
| TypeScript | Tipado estático |
| Vite | Build tool |
| Tailwind CSS v4 | Estilos utilitarios |
| Prisma + SQLite | ORM configurado (preparado, sin uso activo en esta versión) |
| Scryfall API | Base de datos pública de cartas MTG |

---

## Estructura del proyecto

```
ams-mtg/
├── src/
│   ├── lib/
│   │   └── assets/
│   │       └── favicon.svg
│   └── routes/
│       ├── +layout.svelte          # Layout raíz: envuelve todas las páginas
│       ├── +page.svelte            # Página principal: buscador + favoritos + mazos
│       ├── layout.css              # Importación de Tailwind CSS
│       ├── mazo/
│       │   └── [nombre]/
│       │       ├── +page.svelte    # Detalle de un mazo concreto
│       │       └── +page.ts        # Función load: decodifica el parámetro de URL
│       └── verMazo/
│           └── +page.svelte        # Versión anterior del visor (obsoleta, sin uso)
├── prisma/
│   └── dev.db                      # Base de datos SQLite (preparada para backend futuro)
├── static/                         # Recursos estáticos públicos
├── .env                            # Variables de entorno (JWT_SECRET, DATABASE_URL)
├── estilos.css                     # CSS de la etapa anterior (sin uso, sustituido por Tailwind)
├── svelte.config.js                # Configuración SvelteKit (Svelte 5 runes habilitadas)
├── vite.config.ts                  # Plugins de Vite
├── tsconfig.json                   # TypeScript en modo estricto
└── package.json                    # Dependencias y scripts
```

---

## Rutas y páginas

### `/` — Página principal

**Archivo:** `src/routes/+page.svelte`

La página central de la aplicación. Divide la interfaz en cuatro zonas:

- **Cabecera:** barra de búsqueda, pastillas de filtro por color de maná (blanco, azul, negro, rojo, verde), botón de carta aleatoria y accesos a batalla y logout.
- **Panel izquierdo:** lista de cartas favoritas con contador y controles de paginación (Anterior / Siguiente).
- **Área central:** cuadrícula de cartas con imágenes de Scryfall, indicador de carga, y botones de acción al pasar el cursor (añadir a favoritos, añadir al mazo activo).
- **Panel derecho:** campo para crear un nuevo mazo, selector de mazo activo, y listado de las cartas que contiene con botones para añadir/quitar copias y enlace a la vista de detalle.

Al hacer clic en la imagen de cualquier carta se abre un **modal de detalle** con su imagen completa, coste de maná, tipo, texto de reglas, fuerza/resistencia, lealtad, rareza y nombre del set.

Toda la lógica reactiva usa **Svelte 5 Runes** (`$state`, `$derived`).

### `/mazo/[nombre]` — Detalle de mazo

**Archivos:** `src/routes/mazo/[nombre]/+page.svelte` y `+page.ts`

Muestra el contenido completo de un mazo:

- Listado de cartas agrupadas por nombre con contador de copias.
- Botones `+` / `−` para ajustar cantidades de cada carta.
- Buscador interno para añadir nuevas cartas al mazo usando la API de Scryfall.
- Cabecera editable para renombrar el mazo.
- Botón de eliminar mazo completo.
- Modal de detalle de carta al hacer clic en una imagen.
- Botón de volver a la página principal.

El parámetro `[nombre]` de la URL está codificado con `encodeURIComponent` para soportar espacios y caracteres especiales. La función `load` en `+page.ts` lo decodifica antes de usarlo. Si el nombre no corresponde a ningún mazo existente, redirige al inicio.

### `/verMazo` — Vista antigua (obsoleta)

Iteración anterior del visor de mazos. Se conserva en el repositorio pero no se usa ni está enlazada desde ninguna parte.

---

## Integración con Scryfall API

Todas las llamadas son peticiones `fetch` del lado del cliente (sin proxy) a `https://api.scryfall.com/`. No requiere autenticación.

| Endpoint | Uso |
|---|---|
| `/cards/search?q={query}` | Búsqueda por nombre |
| `/cards/search?q=c:{color}` | Filtro por color de maná |
| `/cards/search?q={query}&page=N` | Paginación de resultados |
| `/cards/random` | Carta aleatoria |
| `/cards/named?exact={nombre}` | Carga de imagen para cartas del mazo |

Los colores de maná usan la notación estándar de MTG: `w` (blanco), `u` (azul), `b` (negro), `r` (rojo), `g` (verde).

Las cartas de doble cara almacenan su imagen en `card_faces[0].image_uris.png` en lugar de `image_uris.png`. Se usa una función auxiliar que comprueba ambas rutas y devuelve la primera disponible.

---

## Persistencia de datos

Toda la información del usuario se guarda en **localStorage** del navegador. No hay llamadas a base de datos activas en esta versión.

| Clave localStorage | Tipo | Contenido |
|---|---|---|
| `mtg_favs` | `string[]` | Nombres de cartas favoritas |
| `mtg_mazos` | `Record<string, string[]>` | Mazos del usuario: nombre del mazo → lista de nombres de cartas (con duplicados para indicar copias) |

**Ejemplo:**
```json
{
  "Mi Mazo Rojo": ["Lightning Bolt", "Lightning Bolt", "Goblin Guide"],
  "Control Azul": ["Counterspell", "Island", "Island", "Island"]
}
```

Prisma y SQLite están configurados (`prisma/dev.db`, `DATABASE_URL` en `.env`) para cuando se implemente la persistencia en servidor.

---

## Gestión del estado con Svelte 5 Runes

La aplicación usa el sistema de reactividad de Svelte 5 en lugar de stores:

```typescript
// Estado reactivo en +page.svelte
let colorSeleccionado = $state('');
let textoBusqueda    = $state('');
let numPagina        = $state(1);
let cartas           = $state<any[]>([]);
let favoritos        = $state<string[]>([]);
let mazos            = $state<Record<string, string[]>>({});
let mazoSeleccionado = $state('');
let cartaSeleccionada = $state<any>(null);

// Estado derivado en /mazo/[nombre]/+page.svelte
// Reagrupa las cartas del mazo contando copias
const cartasAgrupadas = $derived.by(() => {
  const conteo: Record<string, number> = {};
  for (const c of mazos[deckName] || []) {
    conteo[c] = (conteo[c] || 0) + 1;
  }
  return Object.entries(conteo).map(([nombre, cantidad]) => ({ nombre, cantidad }));
});
```

`$derived.by()` recalcula automáticamente cada vez que cambia el mazo, manteniendo la UI siempre sincronizada sin lógica de actualización manual.

---

## Diseño visual

Tema oscuro con acento púrpura, implementado con variables CSS como sistema de tokens:

```css
--bg:             #0c0c10   /* Fondo principal */
--surface:        #14141c   /* Paneles */
--surface-2:      #1c1c28   /* Elementos secundarios */
--text-primary:   #f0eff6
--text-secondary: #8e8da8
--accent:         #7c5cf6   /* Morado — botones y énfasis */
--gold:           #c9a840   /* Rareza / detalles dorados */
--danger:         #e0434a   /* Eliminar / error */
--green:          #3db37a   /* Añadir / éxito */
```

Los estilos están encapsulados en cada componente `.svelte` con bloques `<style>`. Tailwind CSS v4 se importa globalmente desde `layout.css` para utilidades de maquetación.

---

## Instalación y uso

### Requisitos

- Node.js >= 18

### Pasos

```bash
# 1. Clonar el repositorio y situarse en la rama backend
git clone <url-del-repo>
cd ams-mtg
git checkout backend

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

### Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo con hot-reload
npm run build     # Compilar para producción
npm run preview   # Vista previa del build de producción
npm run check     # Verificación de tipos (TypeScript + Svelte)
npm run lint      # Comprobar formato y reglas ESLint
npm run format    # Aplicar formato automático (Prettier)
```

### Variables de entorno

El archivo `.env` incluido contiene:

```
JWT_SECRET="cambia-esto-por-un-secreto-largo-y-aleatorio"
DATABASE_URL="file:./dev.db"
```

Estas variables están preparadas para cuando se implemente la autenticación y el acceso a base de datos. No afectan al funcionamiento actual de la aplicación.

---

## Funcionalidades pendientes

Las siguientes características están planificadas pero no están implementadas en esta rama:

- **Modo batalla** (`/partida`): Contador de vida, daño de comandante, contadores de veneno y herramientas de aleatoriedad para partidas multijugador. La ruta no existe aún.
- **Autenticación**: El botón de logout referencia `/api/auth/logout`, pero no hay rutas de API implementadas. Se planea usar JWT con `JWT_SECRET`.
- **Persistencia en servidor**: Migrar los datos de localStorage a SQLite vía Prisma.
- **Módulo de recomendación con clustering**: Script Python (K-Means) que analiza el catálogo de Scryfall, agrupa cartas por características jugables y expone recomendaciones desde un endpoint de SvelteKit.

---

## Autores

Proyecto desarrollado para la asignatura de Aplicaciones Multimedia y Servicios (AMS).

| Nombre | Contacto |
|---|---|
| Equipo AMS | amsgrupoproyecto26@gmail.com |
