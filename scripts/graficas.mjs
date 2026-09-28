/**
 * Graficas del reporte de calidad — Sprint 1.
 *
 * SVG generado a mano desde los JSON de la medicion. Sin librerias: un `chart.js` o un
 * `recharts` traeria ~300 KB a un proyecto cuya前提下 es 0 KB de JS en ruta critica, y para
 * cuatro barras de barras y un budget no compensa. Ademas el SVG es texto: se puede diffear,
 * revisar en un PR y leer sin ejecutar nada.
 *
 * Las cifras NO salen del script de graficas. Se leen de `datos-lab.json` y
 * `datos-diseno.json`, que escriben los scripts de medicion. Si el dato no se midio, esta
 * grafica lo dice; no lo rellena con cero.
 *
 * Uso: node --experimental-strip-types scripts/graficas.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'docs/reportes-calidad/1-fundacion-y-toolchain')

/* Paleta: los mismos hex de src/styles/tokens.css, que ya documenta su equivalente oklch. */
const C = {
  surface0: '#0a0d12',
  surface1: '#13171e',
  surface2: '#1d2229',
  line: '#383d47',
  lineStrong: '#a7aebb',
  textHi: '#eff2f6',
  textMid: '#b4b8be',
  textLo: '#82868e',
  accent: '#f9ad00',
  data: '#00bcc5',
  // Rojo/verde solo para semantica de veredicto, nunca como acento decorativo (RUI-01).
  mal: '#e5484d',
  bien: '#46a758',
}

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const svg = (
  w,
  h,
  cuerpo,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" font-family="ui-monospace, monospace">
<rect width="${w}" height="${h}" fill="${C.surface0}"/>
${cuerpo}
</svg>
`

const txt = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" fill="${o.fill ?? C.textMid}" font-size="${o.size ?? 12}"` +
  `${o.weight ? ` font-weight="${o.weight}"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}>${esc(s)}</text>`

const lab = JSON.parse(readFileSync(join(OUT, 'datos-lab.json'), 'utf8'))
const dis = JSON.parse(readFileSync(join(OUT, 'datos-diseno.json'), 'utf8'))

const LOGROS = []
const guardar = (nombre, contenido) => {
  writeFileSync(join(OUT, nombre), contenido)
  LOGROS.push(nombre)
}

/* ==================================================================== *
 * 1. LCP por perfil de red — RNF-01
 * ==================================================================== *
 * Solo la serie `cold` (JS activo, instrumentada). La serie `static` NO se grafica como 0:
 * la instrumentacion es JS, asi que en `static` el LCP no existe. Dibujarla en cero haria
 * un grafico que dice "sin JS es infinitamente rapido", que es justo la mentira que este
 * reporte no va a contar.
 */
{
  const perfil = lab.vitals.filter((v) => v.dispositivo === 'desktop-1440' && v.cache === 'cold')
  const objetivo = 1.8
  const orden = ['slow-4g', '4g', 'wifi', 'native']
  const datos = orden.map((r) => perfil.find((v) => v.red === r)).filter(Boolean)
  const estatico = lab.vitals.filter(
    (v) => v.dispositivo === 'desktop-1440' && v.cache === 'static',
  )

  const W = 760
  const H = 300
  const M = { t: 54, r: 24, b: 76, l: 56 }
  const w = W - M.l - M.r
  const h = H - M.t - M.b
  // Escala hasta 2 s, no hasta el maximo medido: si el eje se ajusta a los datos, la holgura
  // respecto al objetivo se ve mayor de lo que es.
  const maximo = 2
  const ancho = Math.min(96, (w / datos.length) * 0.6)

  let c = ''
  c += txt(M.l, 24, 'LCP por perfil de red — RNF-01', { fill: C.textHi, size: 15, weight: 600 })
  c += txt(
    M.l,
    42,
    `desktop 1440 · cold · mediana de ${perfil[0]?.n ?? 3} runs · LCI no aplica (T5)`,
    {
      size: 11,
      fill: C.textLo,
    },
  )

  for (let s = 0; s <= 4; s++) {
    const y = M.t + h - (s / 4) * h
    c += `<line x1="${M.l}" y1="${y}" x2="${M.l + w}" y2="${y}" stroke="${C.line}" stroke-width="1"/>`
    c += txt(M.l - 8, y + 4, `${((s / 4) * maximo).toFixed(1)}s`, {
      anchor: 'end',
      size: 11,
      fill: C.textLo,
    })
  }

  // Linea de objetivo
  const yObj = M.t + h - (objetivo / maximo) * h
  c += `<line x1="${M.l}" y1="${yObj}" x2="${M.l + w}" y2="${yObj}" stroke="${C.accent}" stroke-width="2" stroke-dasharray="6 4"/>`
  c += txt(M.l + w, yObj - 7, `objetivo ≤ ${objetivo}s`, {
    anchor: 'end',
    size: 11,
    fill: C.accent,
    weight: 600,
  })

  datos.forEach((d, i) => {
    const cx = M.l + (w / datos.length) * (i + 0.5)
    const bh = Math.max(2, (d.lcpMedianaMs / 1000 / maximo) * h)
    const y = M.t + h - bh
    const ok = d.lcpMedianaMs / 1000 <= objetivo
    c += `<rect x="${cx - ancho / 2}" y="${y}" width="${ancho}" height="${bh}" fill="${ok ? C.data : C.mal}" rx="2"/>`
    c += txt(cx, y - 8, `${(d.lcpMedianaMs / 1000).toFixed(2)}s`, {
      anchor: 'middle',
      size: 12,
      fill: C.textHi,
      weight: 600,
    })
    c += txt(cx, M.t + h + 20, d.red, { anchor: 'middle', size: 11, fill: C.textMid })
    const [dl, lat] = d.redLabel.match(/([\d.,]+ Mbps) \/ ([\d]+ ms)/)?.slice(1) ?? ['', '']
    c += txt(cx, M.t + h + 36, dl ? `${dl} / ${lat}` : 'sin throttling', {
      anchor: 'middle',
      size: 10,
      fill: C.textLo,
    })
    c += txt(cx, M.t + h + 52, `dispersión ${d.desviacionLcpPct ?? 0}%`, {
      anchor: 'middle',
      size: 10,
      fill: C.textLo,
    })
  })

  c += txt(
    M.l,
    H - 12,
    `Sin JS (static): ${estatico.length} combinaciones medidas — LCP n/m, la instrumentación es JS.`,
    {
      size: 10,
      fill: C.textLo,
    },
  )
  c += txt(M.l, H - 1, 'Fuente: datos-lab.json · n=3 por barra · no es p75 (MEDICION.md §9)', {
    size: 10,
    fill: C.textLo,
  })
  guardar('grafica-lcp.svg', svg(W, H, c))
}

/* ==================================================================== *
 * 2. Presupuesto de diseño §4.3 — donde el Sprint 1 falla
 * ==================================================================== */
{
  const escenas = dis.presupuestoDiseno
  const maxNodos = Math.max(6, ...escenas.map((e) => e.nodos))
  const maxChars = Math.max(280, ...escenas.map((e) => e.caracteresApoyo))

  const W = 760
  const filaH = 52
  const M = { t: 78, r: 24, b: 46, l: 96 }
  const H = M.t + escenas.length * filaH + M.b
  const w = W - M.l - M.r
  const wNodos = (w / 2) * 0.46
  const wChars = wNodos
  const xChars = M.l + wNodos + w / 2 - wChars + 8

  let c = ''
  c += txt(M.l, 24, 'Presupuesto de diseño por escena — §4.3', {
    fill: C.textHi,
    size: 15,
    weight: 600,
  })
  c += txt(M.l, 42, 'Nodos de contenido ≤ 6 · Caracteres de apoyo ≤ 280', {
    size: 11,
    fill: C.textLo,
  })
  c += txt(
    M.l,
    56,
    `${escenas.filter((e) => e.cumple).length}/${escenas.length} escenas cumplen · contenido fixture, no definitivo`,
    {
      size: 11,
      fill: C.textLo,
    },
  )

  // Cabeceras de las dos escalas
  c += txt(M.l, M.t - 8, 'nodos', { size: 11, fill: C.textMid, weight: 600 })
  c += txt(xChars, M.t - 8, 'caracteres', { size: 11, fill: C.textMid, weight: 600 })

  escenas.forEach((e, i) => {
    const y = M.t + i * filaH
    const ok = e.cumple
    c += txt(M.l - 10, y + 15, e.id, {
      anchor: 'end',
      size: 12,
      fill: ok ? C.textMid : C.textHi,
      weight: ok ? 400 : 600,
    })

    // Nodos
    const bn = (e.nodos / maxNodos) * wNodos
    c += `<rect x="${M.l}" y="${y + 4}" width="${Math.max(2, bn)}" height="14" fill="${e.nodos > 6 ? C.mal : C.bien}" rx="2" opacity="0.85"/>`
    const xLim = M.l + (6 / maxNodos) * wNodos
    c += `<line x1="${xLim}" y1="${y + 1}" x2="${xLim}" y2="${y + 22}" stroke="${C.accent}" stroke-width="2"/>`
    c += txt(M.l + Math.max(2, bn) + 6, y + 15, String(e.nodos), { size: 11, fill: C.textLo })

    // Caracteres
    const bc = (e.caracteresApoyo / maxChars) * wChars
    c += `<rect x="${xChars}" y="${y + 4}" width="${Math.max(2, bc)}" height="14" fill="${e.caracteresApoyo > 280 ? C.mal : C.bien}" rx="2" opacity="0.85"/>`
    const xLimC = xChars + (280 / maxChars) * wChars
    c += `<line x1="${xLimC}" y1="${y + 1}" x2="${xLimC}" y2="${y + 22}" stroke="${C.accent}" stroke-width="2"/>`
    c += txt(xChars + Math.max(2, bc) + 6, y + 15, String(e.caracteresApoyo), {
      size: 11,
      fill: C.textLo,
    })

    if (!ok) c += txt(W - M.r, y + 15, '✕', { anchor: 'end', size: 14, fill: C.mal, weight: 700 })
  })

  c += txt(
    M.l,
    H - 26,
    '▬ dentro del límite   ▬ fuera del límite   | línea ámbar = umbral (§4.3)',
    {
      size: 10,
      fill: C.textLo,
    },
  )
  c += txt(
    M.l,
    H - 10,
    'Fuente: datos-diseno.json · 7 escenas del shell · el contenido real aún no existe (SEG-30)',
    {
      size: 10,
      fill: C.textLo,
    },
  )
  guardar('grafica-presupuesto.svg', svg(W, H, c))
}

/* ==================================================================== *
 * 3. Contraste real — §4.4, lo que axe no ve
 * ==================================================================== */
{
  const datos = [...dis.contraste].sort((a, b) => b.ratio - a.ratio)
  const W = 760
  const filaH = 44
  const M = { t: 78, r: 130, b: 40, l: 150 }
  const H = M.t + datos.length * filaH + M.b
  const w = W - M.l - M.r
  // Escala hasta 21:1 (maximo teorico de WCAG), no hasta el mejor dato: asi se ve de sobra
  // que margen queda, en vez de estirar el eje y hacer que un 5.28:1 parezca justo.
  const maximo = 21

  let c = ''
  c += txt(M.l, 24, 'Contraste real de texto — WCAG 2.1 AA', {
    fill: C.textHi,
    size: 15,
    weight: 600,
  })
  c += txt(
    M.l,
    42,
    'Colores resueltos en el navegador, no declarados: axe lee el CSS, esto lee el píxel',
    {
      size: 11,
      fill: C.textLo,
    },
  )
  c += txt(M.l, 56, 'Barra = ratio · marca ámbar = mínimo exigido según tamaño y peso', {
    size: 11,
    fill: C.textLo,
  })

  datos.forEach((d, i) => {
    const y = M.t + i * filaH
    const bw = Math.max(2, (d.ratio / maximo) * w)
    c += txt(M.l - 10, y + 16, d.contexto, { anchor: 'end', size: 11, fill: C.textMid })
    c += txt(M.l - 10, y + 30, `${d.fontSizePx}px w${d.fontWeight}`, {
      anchor: 'end',
      size: 10,
      fill: C.textLo,
    })
    c += `<rect x="${M.l}" y="${y + 5}" width="${bw}" height="15" fill="${d.cumple ? C.bien : C.mal}" rx="2" opacity="0.85"/>`
    const xm = M.l + (d.minimo / maximo) * w
    c += `<line x1="${xm}" y1="${y + 2}" x2="${xm}" y2="${y + 23}" stroke="${C.accent}" stroke-width="2"/>`
    c += txt(M.l + bw + 8, y + 17, `${d.ratio.toFixed(2)}:1`, {
      size: 11,
      fill: C.textHi,
      weight: 600,
    })
  })

  const peor = Math.min(...datos.map((d) => d.ratio))
  c += txt(
    M.l,
    H - 20,
    `Peor caso ${peor.toFixed(2)}:1 · mínimo del conjunto ${Math.min(...datos.map((d) => d.minimo))}:1 · ${datos.length} pares únicos`,
    {
      size: 10,
      fill: C.textLo,
    },
  )
  c += txt(
    M.l,
    H - 6,
    'Fuente: datos-diseno.json · conversion oklch→sRGB por canvas, no por parseo de texto',
    {
      size: 10,
      fill: C.textLo,
    },
  )
  guardar('grafica-contraste.svg', svg(W, H, c))
}

/* ==================================================================== *
 * 4. Presupuesto de peso — RNF-07..RNF-12
 * ==================================================================== */
{
  const estatico = JSON.parse(readFileSync(join(OUT, 'datos-estatico.json'), 'utf8'))
  const filas = estatico.budgets
  const W = 760
  const filaH = 46
  const M = { t: 92, r: 24, b: 40, l: 200 }
  const H = M.t + filas.length * filaH + M.b
  const w = W - M.l - M.r

  let c = ''
  c += txt(M.l, 24, 'Peso por categoría frente al presupuesto — RNF-07 a RNF-12', {
    fill: C.textHi,
    size: 15,
    weight: 600,
  })
  c += txt(M.l, 42, 'Barra = % del presupuesto consumido · verde dentro, rojo fuera', {
    size: 11,
    fill: C.textLo,
  })
  c += txt(M.l, 56, 'RNF-10, RNF-11 y RNF-12 sin material en dist/: no medibles, no "0 KB"', {
    size: 11,
    fill: C.textLo,
  })

  filas.forEach((f, i) => {
    const y = M.t + i * filaH
    const medible = f.actualKb !== null
    c += txt(M.l - 10, y + 15, f.id, { anchor: 'end', size: 12, fill: C.textHi, weight: 600 })
    c += txt(M.l - 10, y + 29, f.categoria, { anchor: 'end', size: 10, fill: C.textLo })

    if (!medible) {
      // Rayado: distingue "no medible" de "medido y vacio" a un vistazo.
      c += `<rect x="${M.l}" y="${y + 5}" width="${w}" height="15" fill="none" stroke="${C.line}" stroke-width="1" stroke-dasharray="3 3"/>`
      c += txt(M.l + 8, y + 17, 'sin material en dist/ — n/m', { size: 11, fill: C.textLo })
    } else {
      const pct = Math.min(1, f.pct)
      const color = f.pct <= 1 ? C.bien : C.mal
      c += `<rect x="${M.l}" y="${y + 5}" width="${w}" height="15" fill="${C.surface2}" rx="2"/>`
      c += `<rect x="${M.l}" y="${y + 5}" width="${Math.max(2, pct * w)}" height="15" fill="${color}" rx="2" opacity="0.9"/>`
      c += txt(M.l + w + 0, y + 17, `${f.actualKb} / ${f.presupuestoKb} KB`, {
        anchor: 'end',
        size: 11,
        fill: C.textHi,
        weight: 600,
      })
      c += txt(M.l - 10, y + 29, `${f.pct.toFixed(1)}%`, { anchor: 'end', size: 10, fill: color })
    }
  })

  c += txt(
    M.l,
    H - 20,
    'Fuente: datos-estatico.json · gzip · budgets de scripts/gate-budgets.mjs',
    {
      size: 10,
      fill: C.textLo,
    },
  )
  c += txt(
    M.l,
    H - 6,
    'Los presupuestos en KB son el techo; el % es lo consumido. KB no lleva LCI: son bytes, no una muestra.',
    {
      size: 10,
      fill: C.textLo,
    },
  )
  guardar('grafica-peso.svg', svg(W, H, c))
}

console.log('\n  GRAFICAS GENERADAS')
for (const n of LOGROS) console.log(`  ${n}`)
console.log('')
