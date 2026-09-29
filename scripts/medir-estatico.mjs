/**
 * Medicion estatica de calidad — Sprint N.
 *
 * Parte T5 del protocolo (`MEDICION.md` §2): magnitudes discretas y deterministas que no
 * necesitan navegador. Todo lo que se publica aqui sale de leer el repo y `dist/`, nunca de
 * un valor escrito a mano.
 *
 * Por que un script y no una hoja de calculo: `MEDICION.md` §1.7 exige que cada numero
 * publicado se regenere con un comando. Un informe con numeros pegados a mano es una
 * fotografia; esto es una medicion.
 *
 * Las claves de los objetos exportados son identificadores de requisito (`RNF-07`...), no
 * nombres de archivo. Si una cifra no se puede atribuir a un requisito, no se publica: asi se
 * evita elVERTIGO de metricas de vanidad (`MEDICION.md` §9).
 */

import { gzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { staticDir } from './lib/static.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = staticDir()

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = existsSync(DIST) ? walk(DIST) : []

/** Bytes raw y gzip de un fichero, o `null` si no existe. */
function sizeOf(path) {
  if (!existsSync(path)) return null
  const raw = readFileSync(path)
  return { raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length }
}

/** Presupuesto de `MEDICION.md` §4.2. `null` = la métrica aún no aplica (no hay material). */
const BUDGETS = [
  {
    id: 'RNF-07',
    label: 'Transfer 1ª carga sin vídeo',
    categoria: 'HTML + CSS + JS',
    maxKb: 350,
    kind: 'suma',
  },
  { id: 'RNF-08', label: 'JS ruta crítica', categoria: 'JavaScript', maxKb: 110, kind: 'suma' },
  { id: 'RNF-09', label: 'CSS total', categoria: 'CSS', maxKb: 24, kind: 'suma' },
  { id: 'RNF-10', label: 'Fuentes (3 ficheros)', categoria: 'Webfonts', maxKb: 90, kind: 'suma' },
  { id: 'RNF-11', label: 'Poster LCP', categoria: 'Imagen', maxKb: 70, kind: 'max' },
  { id: 'RNF-12', label: 'Primer segmento de vídeo', categoria: 'Vídeo', maxKb: 800, kind: 'max' },
]

/* ------------------------------------------------------------------ *
 * 1. Budgets de laboratorio — §4.2
 * ------------------------------------------------------------------ */

const html = sizeOf(join(DIST, 'index.html'))
const css = files.filter((f) => f.endsWith('.css'))
const js = files.filter((f) => f.endsWith('.js'))
const fonts = files.filter((f) => /\.(?:woff2?|ttf|otf)$/.test(f))
const posters = files.filter((f) => /\.(?:avif|webp|jpg|jpeg|png)$/.test(f))
const videos = files.filter((f) => /\.(?:mp4|webm|m4s)$/.test(f))

const sumKb = (list) =>
  list.length === 0 ? 0 : kb(list.reduce((n, f) => n + (sizeOf(f)?.gzip ?? 0), 0))
// `null` cuando no hay ficheros, no `0`. La diferencia es la misma que entre "el presupuesto
// se cumple con margen" y "no hay nada que medir todavia": RNF-10 a RNF-12 no tienen material
// en este sprint porque el contenido real no existe (SEG-30). Devolver 0 los contaria como
// APROBADOS con un 0% de uso, que es un aprobado inventado: un budget que nadie ha medido
// no es un budget que se cumple.
const sumKbM = (list) => (list.length === 0 ? null : sumKb(list))
const maxKbM = (list) =>
  list.length === 0 ? null : kb(Math.max(...list.map((f) => sizeOf(f)?.gzip ?? 0)))

const actual = {
  'RNF-07':
    html === null
      ? null
      : kb(css.reduce((n, f) => n + (sizeOf(f)?.gzip ?? 0), html.gzip) + sumKb(js)),
  'RNF-08': sumKb(js),
  'RNF-09': sumKb(css),
  'RNF-10': sumKbM(fonts),
  'RNF-11': maxKbM(posters),
  'RNF-12': maxKbM(videos),
}

const budgets = BUDGETS.map((b) => {
  const value = actual[b.id]
  return {
    id: b.id,
    label: b.label,
    categoria: b.categoria,
    maxKb: b.maxKb,
    // `null` = sin material. `0` = medido y vacío. La gráfica y el informe distinguen los dos.
    actualKb: value,
    presupuestoKb: b.maxKb,
    medible: value !== null,
    pct: value === null ? null : Math.round((value / b.maxKb) * 1000) / 10,
    usoPct: value === null ? null : Math.round((value / b.maxKb) * 1000) / 10,
    estado: value === null ? 'sin-medir' : value <= b.maxKb ? 'ok' : 'excedido',
  }
})

/* ------------------------------------------------------------------ *
 * 2. Composicion del bundle — RNF-07/08/09 en detalle
 * ------------------------------------------------------------------ */

const composicion = {
  html: html === null ? null : { raw: html.raw, gzip: html.gzip },
  css: css.map((f) => ({ file: relative(DIST, f), gzip: sizeOf(f).gzip })),
  js: js.map((f) => ({ file: relative(DIST, f), gzip: sizeOf(f).gzip })),
  总: 0,
}
composicion.总 =
  composicion.css.reduce((n, c) => n + c.gzip, 0) + composicion.js.reduce((n, c) => n + c.gzip, 0)

/* ------------------------------------------------------------------ *
 * 3. Tokens de diseno — RNF-87, RUI-70, RUI-24
 * ------------------------------------------------------------------ */

// Se cuenta sobre el FUENTE, no sobre `dist/`: el minificador aplana y renombra custom
// properties, asi que sobre el artefacto salen mas (o menos) tokens que los declarados, y la
// cifra no significaria nada.
const scanDirs = ['src/styles', 'src/components', 'src/pages', 'src/layouts']
const scanFiles = scanDirs
  .flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => f.endsWith('.css') || f.endsWith('.astro'))

/**
 * El gate distingue dos conjuntos y hay que distinguirlos aqui tambien, o las cifras parecen
 * contradecirse: `declarados` son los de `tokens.css` (el conjunto gobernado, el que da los
 * 71 de `pnpm gate:tokens`), y `locales` son los que un componente define para si mismo
 * (permitidos a proposito). Sumarlos mezcla dos cosas distintas.
 */
const declarados = new Set(
  [
    ...readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8').matchAll(
      /^\s*(--[a-z0-9-]+)\s*:/gm,
    ),
  ].map((m) => m[1]),
)
const todosLosTokens = scanFiles.flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
)
const unicos = [...new Set(todosLosTokens)]
const locales = unicos.filter((name) => !declarados.has(name))

/** Clasificacion por prefijo, para que la grafica diga algo y no sea una cuenta plana. */
const CATEGORIAS = {
  surface: /^--(?:surface|line|ink|accent|text|on-|muted)/,
  espacio: /^--space/,
  tipografia: /^--(?:font|text|leading|tracking|measure)/,
  radio: /^--(?:radius|radius-)/,
  motion: /^--(?:dur|ease)/,
  z: /^--z/,
  layout: /^--(?:gutter|rail|scene|header|bar)/,
}

const tokensPorCategoria = {}
for (const name of Object.keys(CATEGORIAS)) tokensPorCategoria[name] = 0
tokensPorCategoria.otros = 0
for (const token of declarados) {
  const categoria = Object.keys(CATEGORIAS).find((c) => CATEGORIAS[c].test(token)) ?? 'otros'
  tokensPorCategoria[categoria] += 1
}

// Literales de color o de escala fuera de tokens.css: RNF-87 en su forma dura.
const colorLiterals = []
for (const file of walk(join(ROOT, 'src'))) {
  if (!/\.(css|astro|ts)$/.test(file)) continue
  const rel = relative(ROOT, file)
  if (rel === 'src/styles/tokens.css') continue
  const text = readFileSync(file, 'utf8')
  const matches = text.matchAll(/(#[0-9a-fA-F]{3,8}\b|\b(?:oklch|oklab|rgb|hsl|lab|lch)\()/g)
  for (const m of matches) colorLiterals.push({ file: rel, match: m[0] })
}

/* ------------------------------------------------------------------ *
 * 4. Cobertura de requisitos — el indicador de proceso del sprint
 * ------------------------------------------------------------------ */

/**
 * La evidencia por requisito vive en `docs/TRACEABILITY.md` §12 bis, que es donde
 * `SCRUM.md` §5 punto 6 obliga a registrarla. Se lee de ahi en vez de re-declarar la lista:
 * dos copias de "que esta verificado" se separan en dos semanas.
 */
const PREFIXES = new Set(['RF', 'RNF', 'RUI', 'SEG', 'CHA', 'RND', 'RFU', 'RK', 'ABR', 'DEC'])
/** El prefijo va en un grupo de caracteres, no en una alternancia: `RF` "gana" a `RNF` en una
 *  alternancia sin limite de palabra y hace match massive donde no toca. */
const FILA_REQ = /^\|\s*`([A-Z]{3}-\d+[a-z]?)`\s*\|(.*)$/gm

const statusText = readFileSync(join(ROOT, 'docs/STATUS.md'), 'utf8')
const trace = readFileSync(join(ROOT, 'docs/TRACEABILITY.md'), 'utf8')

/**
 * Solo se cuenta la seccion §12 bis. Buscando el ID en todo el documento, la primera fila que
 * lo menciona suele ser la matriz ISO (§1..§11), donde aparece como referencia y nunca como
 * evidencia: el recuento daba 0 verificados sobre 240 requisitos.
 */
const seccion = trace.split(/^##\s+12 bis\./m)[1]?.split(/^##\s+13\./m)[0] ?? ''
const filas = [...seccion.matchAll(FILA_REQ)]
  .map((m) => ({ id: m[1], resto: m[2] }))
  .filter((f) => PREFIXES.has(f.id.split('-')[0]))

const requisitos = [...new Set(filas.map((f) => f.id))]
// Un requisito puede tener varias filas (p. ej. `RNF-80` aparece 3 veces: typecheck, ESLint y
// una prueba en negativo). Se cuentan las dos cosas: requisitos distintos cubiertos y filas de
// evidencia, porque son preguntas distintas.
const filasCumplidas = filas.filter((f) => f.resto.includes('**Cumplido**'))
const verificados = [...new Set(filasCumplidas.map((f) => f.id))]
const declaradosEnStatus = [...statusText.matchAll(FILA_REQ)].length

/** Requisitos del roadmap de SCRUM.md §7, para saber cuanto falta sin inventar nada. */
const scrum = readFileSync(join(ROOT, 'docs/SCRUM.md'), 'utf8')
const roadmapSprints = [...scrum.matchAll(/^\|\s*\*\*(\d+)\*\*\s*\|/gm)].map((m) => Number(m[1]))

/* ------------------------------------------------------------------ *
 * 5. Tamano del codigo — contexto, no metrica de calidad
 * ------------------------------------------------------------------ */

const byLanguage = { ts: 0, astro: 0, css: 0, mjs: 0, md: 0 }
const linesByLanguage = { ...byLanguage }
for (const file of walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'scripts')))) {
  const ext = file.split('.').pop()
  if (!(ext in byLanguage)) continue
  byLanguage[ext] += 1
  linesByLanguage[ext] += readFileSync(file, 'utf8').split('\n').length
}
const docsLoc = walk(join(ROOT, 'docs'))
  .filter((f) => f.endsWith('.md'))
  .reduce((n, f) => n + readFileSync(f, 'utf8').split('\n').length, 0)

/* ------------------------------------------------------------------ *
 * Salida
 * ------------------------------------------------------------------ */

const datos = {
  generadoPor: 'scripts/medir-estatico.mjs',
  sprint: '1-fundacion-y-toolchain',
  nivelProbatorio: 'T5',
  budgets,
  composicion,
  tokens: {
    declarados: declarados.size,
    locales: locales.length,
    total: unicos.length,
    ficherosEscaneados: scanFiles.length,
    porCategoria: tokensPorCategoria,
    literalesFueraDeTokens: colorLiterals,
  },
  cobertura: {
    requisitosConEvidencia: requisitos.length,
    requisitosVerificados: verificados.length,
    filasEvidencia: filas.length,
    filasCumplidas: filasCumplidas.length,
    requisitosDeclaradosEnStatus: declaradosEnStatus,
    requisitos: verificados,
    sprintsRoadmap: roadmapSprints.length,
    sprintsHechos: new Set(
      [...statusText.matchAll(/^\|\s*(\d+)\s*\|[^|]+\|\s*`DONE`/gm)].map((m) => Number(m[1])),
    ).size,
  },
  codigo: {
    ficheros: byLanguage,
    lineas: linesByLanguage,
    docsLoc,
  },
}

export default datos

if (import.meta.url === `file://${process.argv[1]}`) {
  // El JSON es la fuente de las graficas: asi las cifras del informe salen de una medicion y
  // no de teclear numeros a mano en un .md, que es como los informes empiezan a mentir.
  const dir = join(ROOT, 'docs/reportes-calidad/1-fundacion-y-toolchain')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'datos-estatico.json'), `${JSON.stringify(datos, null, 2)}\n`)

  console.log('\n  MEDICION ESTATICA (T5)\n')
  for (const b of budgets) {
    const estado = b.medible ? `${b.usoPct}%` : 'sin material en dist/ — n/m'
    const valor = b.medible ? `${String(b.actualKb).padStart(6)} KB` : '     —'
    console.log(`  · ${b.id}  ${valor} / ${b.maxKb} KB  ${estado}`)
  }
  console.log(
    `\n  · tokens  ${datos.tokens.declarados} declarados en tokens.css` +
      ` + ${datos.tokens.locales} locales, en ${datos.tokens.ficherosEscaneados} ficheros escaneados`,
  )
  console.log(
    `  · literales de color fuera de tokens  ${datos.tokens.literalesFueraDeTokens.length}`,
  )
  console.log(
    `  · requisitos  ${datos.cobertura.requisitosVerificados} verificados de ${datos.cobertura.requisitosConEvidencia} con evidencia` +
      ` (${datos.cobertura.filasCumplidas}/${datos.cobertura.filasEvidencia} filas en TRACEABILITY §12 bis)`,
  )
  console.log(`  · sprints  ${datos.cobertura.sprintsHechos}/${datos.cobertura.sprintsRoadmap}\n`)
}
