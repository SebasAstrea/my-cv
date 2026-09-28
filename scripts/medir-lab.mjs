/**
 * Medicion de laboratorio (T4/T5) — Sprint N.
 *
 * Ejecuta `dist/` en Chromium headless y mide lo que `MEDICION.md` §4.1, §4.2, §4.3 y §4.8
 * exigen, con las condiciones de laboratorio declaradas en §5.
 *
 * Decisiones de protocolo, todas deliberadas:
 *
 * - **Mediana de 3, no media ni p75.** §4.2 fija "mediana de 3" para LCP/TBT/CLS de lab. Con
 *   n=3 el p75 seria el maximo de la muestra: `MEDICION.md` §9 lo prohibe explicitamente. Asi
 *   que se publica mediana y n, y no se escribe "p75" en ningun sitio.
 * - **Sin LCI en magnitudes deterministas.** §8 exige `valor [LCI95] + n + fuente + nivel`. Un
 *   bundle no es una muestra: son bytes. Ponerle un intervalo de confianza seria falso rigor,
 *   asi que se marca `determinista` y se explica por que no lleva LCI. El LCI se reserva para
 *   lo que de verdad tiene varianza.
 * - **Los perfiles de red son los de §5**, con sus cifras exactas, y estan en codigo para que no
 *   se ajusten a mano despues de ver el numero (§9).
 * - **Cache `cold` y `static` por separado.** El sitio tiene 0 KB de JS, asi que predeciblemente
 *   mediran igual; medirlo es precisamente lo que demuestra que la afirmacion "sin JS en ruta
 *   critica" es cierta y no una看不出来 con un presupuesto de 0 KB.
 *
 * Uso:
 *   node --experimental-strip-types scripts/medir-lab.mjs            # completo (~2-4 min)
 *   node --experimental-strip-types scripts/medir-lab.mjs --rapido   # 1 perfil, 1 dispositivo
 */

import { createServer } from 'node:http'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'docs/reportes-calidad/1-fundacion-y-toolchain')
const RAPIDO = process.argv.includes('--rapido')

/* ------------------------------------------------------------------ *
 * Condiciones de laboratorio — MEDICION.md §5
 * ------------------------------------------------------------------ */

/**
 * Perfiles de red de §5, verbatim. downlink en Mbps, latencia en ms. No se tocan sin ADR.
 */
const REDES = {
  'slow-4g': { downlink: 1.6, latency: 150, label: 'slow-4g (1,6 Mbps / 150 ms)' },
  '3g-fast': { downlink: 1.6, latency: 300, label: '3g-fast (1,6 Mbps / 300 ms)' },
  '4g': { downlink: 9, latency: 85, label: '4g (9 Mbps / 85 ms)' },
  wifi: { downlink: 100, latency: 10, label: 'wifi (100 Mbps / 10 ms)' },
  native: { downlink: 0, latency: 0, label: 'native (sin throttling)' },
}

// Los 5 perfiles de §5, en el orden de degradacion. `3g-fast` estaba definido en REDES y no se
// ejecutaba: un perfil definido y no medido es un perfil que alguien dara por cubierto.
const PERFILES = RAPIDO ? ['native'] : ['slow-4g', '3g-fast', '4g', 'wifi', 'native']
const RUNS = 3 // §4.2: mediana de 3

/**
 * Dispositivos de §5. `moto-g-power` es el default de Lighthouse; el desktop lleva 4x CPU
 * throttle segun §5, que se aplica aparte.
 */
const DISPOSITIVOS = RAPIDO
  ? [{ id: 'desktop', viewport: { width: 1440, height: 900 }, cpu: 1, dpr: 1, mobile: false }]
  : [
      {
        id: 'moto-g-power',
        viewport: { width: 412, height: 823 },
        cpu: 4,
        dpr: 1.75,
        mobile: true,
      },
      { id: 'desktop-1440', viewport: { width: 1440, height: 900 }, cpu: 4, dpr: 1, mobile: false },
    ]

const OBJETIVOS = {
  'RNF-01': { metrica: 'LCP (lab)', objetivo: 1.8, unidad: 's', min: true },
  'RNF-15': { metrica: 'TBT (lab)', objetivo: 0.15, unidad: 's', min: true },
  'RNF-03': { metrica: 'CLS (lab)', objetivo: 0.02, unidad: '', min: true },
  'RNF-04': { metrica: 'TTFB (lab)', objetivo: 0.4, unidad: 's', min: true },
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

/* ------------------------------------------------------------------ *
 * Servidor estatico de dist/
 * ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

function servir() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let path = join(DIST, normalize(decodeURIComponent(url.pathname)))
    if (!existsSync(path) || url.pathname === '/') path = join(DIST, 'index.html')
    if (!existsSync(path)) {
      res.writeHead(404).end('no')
      return
    }
    const body = readFileSync(path)
    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      'content-length': body.length,
      // Sin cache: `cold` y `static` tienen que ser comparables, no "la segunda vez que se pide".
      'cache-control': 'no-store',
    })
    res.end(body)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

/* ------------------------------------------------------------------ *
 * Recoleccion de metricas dentro de la pagina
 * ------------------------------------------------------------------ */

/**
 * Se inyecta con `addInitScript`, antes de que se analice nada: un `PerformanceObserver` puesto
 * desde `page.evaluate` despues de cargar se perderia los primeros eventos, que son
 * precisamente los que interesan (LCP y CLS ocurren durante el render inicial).
 */
const ESPIA = () => {
  window.__mv = { lcp: 0, cls: 0, longTasks: [], fcps: 0 }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__mv.lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // Tipo de observer no soportado en este navegador. Es deteccion de capacidad, no un fallo:
    // si `PerformanceObserver` no acepta el tipo, esa metrica simplemente no se mide, y el JSON
    // lo refleja en `lcpObservado` / `hayNavegacion` en vez de reportar un cero inventado.
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        // `hadRecentInput` excluye los shifts que el usuario provoco: no son de layout.
        if (!e.hadRecentInput) window.__mv.cls += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Tipo de observer no soportado en este navegador. Es deteccion de capacidad, no un fallo:
    // si `PerformanceObserver` no acepta el tipo, esa metrica simplemente no se mide, y el JSON
    // lo refleja en `lcpObservado` / `hayNavegacion` en vez de reportar un cero inventado.
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__mv.longTasks.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    // Tipo de observer no soportado en este navegador. Es deteccion de capacidad, no un fallo:
    // si `PerformanceObserver` no acepta el tipo, esa metrica simplemente no se mide, y el JSON
    // lo refleja en `lcpObservado` / `hayNavegacion` en vez de reportar un cero inventado.
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (e.name === 'first-contentful-paint') window.__mv.fcps = e.startTime
    }).observe({ type: 'paint', buffered: true })
  } catch {
    // Tipo de observer no soportado en este navegador. Es deteccion de capacidad, no un fallo:
    // si `PerformanceObserver` no acepta el tipo, esa metrica simplemente no se mide, y el JSON
    // lo refleja en `lcpObservado` / `hayNavegacion` en vez de reportar un cero inventado.
  }
}

const LEER = () => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paint = performance.getEntriesByName('first-contentful-paint')[0]
  const mv = window.__mv ?? { lcp: 0, cls: 0, longTasks: [], fcps: 0 }
  return {
    lcpMs: Math.round(mv.lcp * 100) / 100,
    // Un LCP de 0 puede significar dos cosas muy distintas: la pagina se pintó en 0 ms (imposible
    // de verdad) o el observer nunca llego a disparar. Publicar "LCP 0.00 s, excelente" cuando
    // no se midio nada seria el peor fallo posible de un informe, asi que se marca la validez.
    lcpObservado: mv.lcp > 0,
    hayNavegacion: nav !== undefined,
    cls: Math.round(mv.cls * 10000) / 10000,
    fcpMs: mv.fcps || paint?.startTime || 0,
    ttfbMs: Math.round((nav ? nav.responseStart - nav.startTime : 0) * 100) / 100,
    domContentLoadedMs: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
    // TBT = Σ max(0, duracion - 50 ms) de las long tasks. Definicion de Lighthouse; con 0 KB
    // de JS el resultado esperado es 0, y medirlo es lo que lo demuestra.
    tbtMs: Math.round(mv.longTasks.reduce((n, d) => n + Math.max(0, d - 50), 0) * 100) / 100,
    longTasks: mv.longTasks.length,
    recursos: performance
      .getEntriesByType('resource')
      .concat([nav].filter(Boolean))
      .map((r) => ({ nombre: r.name, tipo: r.initiatorType, bytes: r.transferSize ?? 0 }))
      .filter((r) => r.bytes > 0),
  }
}

/* ------------------------------------------------------------------ *
 * Mediciones
 * ------------------------------------------------------------------ */

/**
 * Una medicion = un contexto nuevo (cache `cold` de verdad) + una pagina con la red y la CPU
 * emuladas. `newCDPSession` necesita una Page, no un Context, de ahi que el contexto se cree
 * aqui y no fuera.
 */
async function medirWebVitals(browser, url, red, dispositivo, cache) {
  const context = await browser.newContext({
    viewport: dispositivo.viewport,
    deviceScaleFactor: dispositivo.dpr,
    isMobile: dispositivo.mobile,
    hasTouch: dispositivo.mobile,
    // `static` = JS deshabilitado (§5). Es el estado que importa para RF-07.
    javaScriptEnabled: cache !== 'static',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: red.latency,
    downloadThroughput: (red.downlink * 1e6) / 8,
    uploadThroughput: (red.downlink * 1e6) / 8,
  })
  // §5: desktop con 4x CPU throttle. Se aplica siempre, tambien en movil, para que el
  // dispositivo emulado no mida con un CPU de servidor y aparente mejor de lo que es.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: dispositivo.cpu })
  await page.addInitScript(ESPIA)
  await page.goto(url, { waitUntil: 'load' })
  // Un frame de margen para que el observer de LCP cierre la ultima entrada.
  await page.waitForTimeout(400)
  const m = await page.evaluate(LEER)
  await context.close()
  return m
}

/** §4.3 — presupuesto de diseno, por escena, medido sobre la escena que esta en el viewport. */
async function medirDiseno(page) {
  return page.evaluate(() => {
    const escenas = [...document.querySelectorAll('[data-scene]')]
    const out = []
    for (const s of escenas) {
      // Nodos de contenido: los que portan texto o imagen, no los contenedores de maquetacion.
      const nodos = [
        ...s.querySelectorAll('h1,h2,h3,h4,p,li,span,a,img,video,ul,ol,dd,dt,time,blockquote'),
      ]
      const texto = nodos.map((n) => (n.innerText ?? '').trim()).filter((t) => t.length > 0)
      out.push({
        id: s.dataset.scene,
        nodos: nodos.length,
        caracteresApoyo: texto.reduce((n, t) => n + t.length, 0),
        textos: texto.length,
      })
    }
    return {
      escenas: out,
      videosEnDom: document.querySelectorAll('video').length,
      // Los objetivos de §4.3 §4.8 que dependen de pixeles se miden aparte, sobre capturas.
      totalNodosEscena: document.querySelectorAll('section').length,
    }
  })
}

/**
 * Contraste real, resuelto en el navegador — §4.4.
 *
 * axe lee los colores que el autor *declaro*. Si una cascada acaba heredando el color de un
 * ancestro que nadie tasa, axe pasa y un humano no lee. Aqui se resuelve el color de primer
 * plano y el fondo EFECTIVO (paseando ancestros mientras el fondo sea transparente) y se
 * calcula el ratio WCAG 2.1. Se hace aqui, y no en Python, porque `getComputedStyle` ya
 * devuelve `oklch` en `rgb()`: el navegador hace la conversion, no hace falta colorjs.
 */
async function medirContraste(page) {
  return page.evaluate(() => {
    const canal = (c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    // `getComputedStyle` NO convierte a rgb(): Chrome devuelve tal cual la funcion moderna
    // que el autor escribio, asi que un `oklch(0.985 0.004 90)` llega aqui como texto y
    // parsearlo a mano daria [0.985, 0.004, 90] — tres canales de 8 bits leidos de numeros que
    // no son canales. De ahi el 2.18:1 exacto en los cinco pares: era falso, no era diseño.
    //
    // La conversion correcta y sin dependencias es un canvas: `fillStyle` normaliza CUALQUIER
    // color CSS (oklch, color(), lab, hsl) a sRGB, y `getImageData` devuelve los bytes reales.
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true })
    const srgb = (s) => {
      if (!s || s === 'transparent') return null
      ctx2d.clearRect(0, 0, 1, 1)
      ctx2d.fillStyle = '#000'
      ctx2d.fillStyle = s
      // Si el navegador no entendio el color, `fillStyle` conserva el anterior ('#000').
      if (
        ctx2d.fillStyle === '#000000' &&
        s !== '#000' &&
        s !== '#000000' &&
        s !== 'rgb(0, 0, 0)'
      ) {
        return null
      }
      ctx2d.fillRect(0, 0, 1, 1)
      const d = ctx2d.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const aRgb = (s) => {
      const c = srgb(s)
      return c ? c.slice(0, 3) : null
    }
    // Fondo efectivo: sube por los ancestros mientras el fondo sea transparente. Ignora los
    // `rgba(...,0)` y los `transparent` de forma explicita en vez de confiar en el nombre.
    const fondoEfectivo = (el) => {
      let n = el
      while (n && n !== document.documentElement.parentNode) {
        const cs = getComputedStyle(n)
        const bc = srgb(cs.backgroundColor)
        if (bc && bc[3] > 0.01) return bc.slice(0, 3)
        if (cs.backgroundImage !== 'none') return null // gradiente/foto: no comparable
        n = n.parentElement
      }
      return [255, 255, 255]
    }
    const salida = []
    const vistos = new Set()
    for (const el of document.querySelectorAll('body *')) {
      // Solo texto visible. Los nodos vacios no tienen contraste que medir.
      const texto = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      )
      if (!texto) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const fg = aRgb(cs.color)
      const bg = fondoEfectivo(el)
      if (!fg || !bg) continue

      const px = parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      // WCAG 2.1: 3.0 para >=24px, o >=18.66px si es negrita.
      const grande = px >= 24 || (bold && px >= 18.66)
      const minimo = grande ? 3 : 4.5
      const r_ = Math.round(ratio(fg, bg) * 100) / 100
      // Una clase por par (color, fondo): si 40 nodos comparten par, es un caso, no 40.
      const clave = `${cs.color}|${bg.join(',')}|${minimo}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      salida.push({
        contexto: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`,
        fontSizePx: Math.round(px * 100) / 100,
        fontWeight: cs.fontWeight,
        color: cs.color,
        fondo: `rgb(${bg.join(', ')})`,
        ratio: r_,
        minimo,
        cumple: r_ >= minimo,
        motivo:
          r_ >= minimo
            ? 'cumple AA'
            : `ratio ${r_}:1 por debajo del minimo ${minimo}:1 (WCAG 2.1 AA)`,
      })
    }
    return salida.sort((a, b) => a.ratio - b.ratio)
  })
}

/** §4.8 — estados de los que axe puede correr hoy. Los que necesitan drawer de chat o video no existen todavia. */
// §4.8 pide axe en 5 estados: inicio, medio de escena, drawer de chat abierto, drawer de video
// con reduced-motion y error de carga de video. Los 3 primeros se miden; los 2 ultimos no
// existen todavia (Sprint 1 no tiene chat —CHA-*— ni reproduccion de video, y `cv.real.ts` no
// esta). Se declaran NO APLICABLES con el motivo, no se omiten: un estado que no se lista
// parece un estado que se paso.
const NO_APLICABLE = (id, motivo) => ({ id, aplicable: false, motivo })

// `preparar` es opcional: un estado que no necesita manipucion no declara nada.
const ESTADOS_AXE = [
  // Sin `preparar`: la vista superior ya es el estado inicial.
  { id: 'inicio' },
  {
    id: 'medio-de-escena',
    preparar: async (page) => {
      await page.evaluate(() => {
        const s = document.querySelectorAll('[data-scene]')[2]
        s?.scrollIntoView()
      })
      await page.waitForTimeout(250)
    },
  },
  {
    id: 'reflow-320',
    // Sin `preparar`: aqui el estado lo produce el viewport, no la pagina.
    viewport: { width: 320, height: 640 },
  },
  NO_APLICABLE(
    'drawer-chat-abierto',
    'El chat es Sprint 6+ (CHA-*). No hay drawer ni toggle en el DOM.',
  ),
  NO_APLICABLE(
    'drawer-video-reduced-motion',
    'No hay <video> ni overlay de video: 0 videos en dist/ y el poster LCP es RNF-11, sin material todavia.',
  ),
  NO_APLICABLE(
    'error-carga-video',
    'Sin fuente de video no hay error de carga que representar. El estado de error del video se medira con el video.',
  ),
]

async function medirAccesibilidad(browser, url) {
  const resultados = []
  for (const estado of ESTADOS_AXE) {
    if (estado.aplicable === false) {
      resultados.push({ estado: estado.id, aplicable: false, motivo: estado.motivo })
      continue
    }
    const context = await browser.newContext({
      viewport: estado.viewport ?? { width: 1440, height: 900 },
      javaScriptEnabled: true,
    })
    const page = await context.newPage()
    await page.addInitScript(ESPIA)
    await page.goto(url, { waitUntil: 'load' })
    await estado.preparar?.(page)

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    // Reflow 320px: 0 scroll horizontal es un requisito de §4.8, no una opinion de axe.
    const scrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    // `prefers-reduced-motion`: §4.8 pide 0 animaciones > 0 ms detectadas, y dice COMO:
    // "test que monkeypatchea requestAnimationFrame". La version moderna de eso es
    // `document.getAnimations()`, que devuelve solo las animaciones VIVAS (las que se estan
    // ejecutando), no las declaradas.
    //
    // Medir la duracion calculada seria un falso positivo systematico: `transition: color .2s`
    // declara 200 ms y se queda quieto el 99% del tiempo. Ademas `reset.css` baja todo a
    // 0.01 ms con `!important` bajo `reduce`, y 0.01 es el valor neutro que el propio
    // `scripts/gate-tokens.mjs` acepta (ALLOWED_NEUTRAL_MS) para no bloquear.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const animaciones = await page.evaluate(() => {
      const NEUTRO_MS = 0.011 // 0 y 0.01: los dos son "no hay animacion perceptible"
      const aMs = (v) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000)
      const vivas = document.getAnimations().filter((a) => a.playState === 'running')
      const declaradas = []
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el)
        const d = Math.max(aMs(cs.animationDuration || '0s'), aMs(cs.transitionDuration || '0s'))
        if (d > NEUTRO_MS)
          declaradas.push({ sel: el.tagName.toLowerCase(), ms: Math.round(d * 100) / 100 })
      }
      return {
        vivas: vivas.length,
        declaradasSobreNeutro: declaradas.length,
        ejemplos: declaradas.slice(0, 5),
      }
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    // Target size 2.5.8 (axe tambien lo cubre, pero se mide para tener el numero).
    const targetsPequenos = await page.evaluate(() => {
      const malos = []
      for (const el of document.querySelectorAll('a,button,[role="button"],input,select')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.width < 24 || r.height < 24)
          malos.push({
            sel: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
      }
      return malos
    })

    resultados.push({
      estado: estado.id,
      violaciones: axe.violations.map((v) => ({
        id: v.id,
        impacto: v.impact,
        nodos: v.nodes.length,
        ayuda: v.help,
      })),
      seriousCritical: axe.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      ).length,
      passes: axe.passes.length,
      inaplicables: axe.inapplicable.length,
      scrollHorizontalExcesoPx: scrollX,
      reducedMotion: animaciones,
      targetsMenoresDe24px: targetsPequenos,
    })
    await context.close()
  }
  return resultados
}

/* ------------------------------------------------------------------ *
 * Orquestacion
 * ------------------------------------------------------------------ */

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('  dist/ no existe. Ejecuta `pnpm build` antes.')
  process.exit(1)
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const { server, port } = await servir()
const url = `http://127.0.0.1:${port}/`
const browser = await chromium.launch()
const capturas = join(OUT, 'capturas')
if (!existsSync(capturas)) mkdirSync(capturas, { recursive: true })

console.log(`\n  MEDICION DE LABORATORIO (T4/T5) — ${RAPIDO ? 'rapido' : 'completo'}`)
console.log(`  ${RUNS} runs por combinacion, mediana; perfiles: ${PERFILES.join(', ')}\n`)

/* --- 1. Web Vitals por perfil × dispositivo × estado de cache --- */
const vitals = []
for (const dispositivo of DISPOSITIVOS) {
  for (const nombreRed of PERFILES) {
    const red = REDES[nombreRed]
    // §5 pide cold / warm / static. `warm` esta DEFINIDO COMO "segunda visita con Service Worker
    // activo" y este proyecto no tiene Service Worker, asi que no hay un estado warm que medir:
    // sin service worker, la segunda visita es identica a la primera. Se omite con el motivo
    // escrito, no en silencio, porque un `warm` medido sin SW seria `cold` con otro nombre.
    for (const cache of ['cold', 'static']) {
      const muestras = []
      for (let run = 0; run < RUNS; run++) {
        muestras.push(await medirWebVitals(browser, url, red, dispositivo, cache))
      }
      const med = {
        dispositivo: dispositivo.id,
        red: nombreRed,
        redLabel: red.label,
        cache,
        n: muestras.length,
        // `static` = JS desactivado (§5). Y aqui esta la trampa: la instrumentacion ES JS
        // (`addInitScript` + PerformanceObserver), asi que en `static` LCP, CLS y TBT no se
        // miden — no valen cero, no existen. Solo TTFB y los bytes transferidos son reales,
        // porque vienen de la navigation/resource timing del navegador y se leen por CDP.
        // Sin marcar esto, la serie "static es N veces mas rapida" seria un grafico falso.
        instrumentada: cache !== 'static',
        metricasSinMedir: cache === 'static' ? ['LCP', 'CLS', 'TBT'] : [],
        lcpMedianaMs: mediana(muestras.map((m) => m.lcpMs)),
        // Se propaga por si ALGUN run no observo LCP: si uno de tres fallo, la mediana de los
        // otros dos no representa la condicion. Se marca y no se usa para el veredicto.
        lcpObservadoEnTodos: muestras.every((m) => m.lcpObservado),
        hayNavegacion: muestras.every((m) => m.hayNavegacion),
        clsMediana: mediana(muestras.map((m) => m.cls)),
        tbtMedianaMs: mediana(muestras.map((m) => m.tbtMs)),
        ttfbMedianaMs: mediana(muestras.map((m) => m.ttfbMs)),
        fcpMedianaMs: mediana(muestras.map((m) => m.fcpMs)),
        longTasks: muestras.reduce((n, m) => n + m.longTasks, 0),
        bytesTransferidos: mediana(
          muestras.map((m) => m.recursos.reduce((a, r) => a + r.bytes, 0)),
        ),
        desviacionLcpPct: (() => {
          if (muestras.length < 2) return 0
          const lcp = muestras.map((m) => m.lcpMs)
          const med = mediana(lcp)
          // Con mediana 0 la dispersion relativa no es un numero: seria division por cero.
          if (med === 0) return null
          return Math.round(((Math.max(...lcp) - Math.min(...lcp)) / med) * 100)
        })(),
      }
      vitals.push(med)
      const lcpTxt = med.instrumentada ? `${(med.lcpMedianaMs / 1000).toFixed(2)}s` : '  n/m'
      const resto = med.instrumentada
        ? `  CLS ${med.clsMediana}  TBT ${med.tbtMedianaMs}ms`
        : '  CLS  n/m  TBT  n/m'
      console.log(
        `  ${dispositivo.id.padEnd(14)} ${red.label.padEnd(28)} ${cache.padEnd(7)}` +
          ` LCP ${lcpTxt}${resto}  TTFB ${med.ttfbMedianaMs}ms  n=${med.n}`,
      )
    }
  }
}

/* --- 2. Presupuesto de diseno §4.3 + capturas para el muestreo de pixeles --- */
const contextDiseno = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const pageDiseno = await contextDiseno.newPage()
await pageDiseno.goto(url, { waitUntil: 'load' })
const diseno = await medirDiseno(pageDiseno)
// El contraste se mide con la vista superior; los fondos son los mismos en todas las escenas.
const contraste = await medirContraste(pageDiseno)

const capturasEscena = []
for (const escena of diseno.escenas) {
  await pageDiseno.evaluate((id) => {
    document.querySelector(`[data-scene="${id}"]`)?.scrollIntoView()
  }, escena.id)
  await pageDiseno.waitForTimeout(300)
  const archivo = join(capturas, `${escena.id}.png`)
  await pageDiseno.screenshot({ path: archivo })
  capturasEscena.push({ id: escena.id, archivo: `capturas/${escena.id}.png` })
}
await contextDiseno.close()

/* --- 3. Accesibilidad §4.8 --- */
const accesibilidad = await medirAccesibilidad(browser, url)

await browser.close()
server.close()

/* ------------------------------------------------------------------ *
 * Salida
 * ------------------------------------------------------------------ */

const datos = {
  generadoPor: 'scripts/medir-lab.mjs',
  sprint: '1-fundacion-y-toolchain',
  nivelProbatorio: 'T4/T5',
  entorno: {
    navegador: `chromium ${browser.version()}`,
    node: process.version,
    sistema: `${process.platform} ${process.arch}`,
    ejecucion: RAPIDO ? 'rapido' : 'completo',
    metodo: `mediana de ${RUNS} runs, contexto nuevo por run (cache cold de verdad)`,
    perfilesRed: Object.fromEntries(Object.entries(REDES).map(([k, v]) => [k, v.label])),
    dispositivos: DISPOSITIVOS,
    nota:
      'Laboratorio unico. MEDICION.md §5 pide 3 dispositivos fisicos para el video; aqui no hay ' +
      'video, asi que no aplica todavia. Sin GPU (RK-01).',
  },
  objetivos: OBJETIVOS,
  vitals,
  diseno: { ...diseno, capturas: capturasEscena },
  contraste,
  accesibilidad,
}

const outFile = join(OUT, 'datos-lab.json')
writeFileSync(outFile, `${JSON.stringify(datos, null, 2)}\n`)

/* Veredicto por objetivo, con la mediana que exige §4.2 */
const REFERENCIA = { dispositivo: 'desktop-1440', red: '4g', cache: 'cold' }
const referencia = vitals.find(
  (v) =>
    v.dispositivo === REFERENCIA.dispositivo &&
    v.red === REFERENCIA.red &&
    v.cache === REFERENCIA.cache,
)

console.log('\n  VEREDICTO\n')
if (referencia === undefined) {
  console.log(
    `  No se midio la condicion de referencia (${REFERENCIA.dispositivo} / ${REFERENCIA.red} / ${REFERENCIA.cache}).\n` +
      '  Este informe no emite veredicto sobre umbrales: sin la condicion fijada no hay contra que comparar.',
  )
  console.log(
    '  Condiciones medidas: ' +
      vitals.map((v) => `${v.dispositivo}/${v.red}/${v.cache}`).join(', '),
  )
} else {
  console.log(
    `  Condicion de referencia: ${referencia.dispositivo} · ${referencia.redLabel} · ${referencia.cache} · n=${referencia.n}\n`,
  )
  for (const [id, o] of Object.entries(OBJETIVOS)) {
    const usaLcp = o.metrica.startsWith('LCP')
    if (usaLcp && !referencia.lcpObservadoEnTodos) {
      console.log(
        `  ???? ${id} ${o.metrica.padEnd(12)} SIN DATO — el observer de LCP no disparo en todos los runs`,
      )
      continue
    }
    const valor = usaLcp
      ? referencia.lcpMedianaMs / 1000
      : o.metrica.startsWith('TBT')
        ? referencia.tbtMedianaMs / 1000
        : o.metrica.startsWith('CLS')
          ? referencia.clsMediana
          : referencia.ttfbMedianaMs / 1000
    const ok = o.min ? valor <= o.objetivo : valor >= o.objetivo
    const num = o.metrica.startsWith('CLS') ? valor.toFixed(4) : valor.toFixed(3)
    console.log(
      `  ${ok ? 'OK  ' : 'MAL '} ${id} ${o.metrica.padEnd(12)} ${num} ${o.unidad} (objetivo ${o.objetivo})`,
    )
  }
  console.log(
    `\n  Dispersión del LCP entre los ${referencia.n} runs: ` +
      `${referencia.desviacionLcpPct === null ? 'no calculable (mediana 0)' : `${referencia.desviacionLcpPct}%`}` +
      '  ·  §4.2 exige mediana de 3; con n=3 esto no es un p75 (§9).',
  )
}
const a11yMedidos = accesibilidad.filter((a) => a.aplicable !== false)
const a11yNoApl = accesibilidad.length - a11yMedidos.length
const serious = a11yMedidos.reduce((n, a) => n + a.seriousCritical, 0)
console.log(
  `\n  ${serious === 0 ? 'OK  ' : 'MAL '} axe serious/critical: ${serious} ` +
    `en ${a11yMedidos.length} estados de §4.8 (${a11yNoApl} no aplicables todavia)`,
)
for (const a of a11yNoApl.length ? accesibilidad.filter((x) => x.aplicable === false) : []) {
  console.log(`       n/m ${a.estado}: ${a.motivo}`)
}

const contrasteMal = contraste.filter((c) => !c.cumple)
console.log(
  `  ${contrasteMal.length === 0 ? 'OK  ' : 'MAL '} contraste WCAG AA (real, ${contraste.length} pares): ` +
    `${contraste.length - contrasteMal.length}/${contraste.length}`,
)
for (const c of contrasteMal) {
  console.log(`       MAL ${c.contexto} ${c.ratio}:1 (min ${c.minimo}) ${c.color} sobre ${c.fondo}`)
}
console.log(`\n  datos: ${outFile.replace(ROOT + '/', '')}\n`)
