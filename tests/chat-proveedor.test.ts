/**
 * Tests de `ADR-0009`: el proveedor Groq, el troceado por seccion y la cuota por IP.
 *
 * Ninguno de estos tests llama a Groq. Un test que necesita red o una API key es un test que
 * acaba desactivado, y un gate desactivado no protege nada. Lo que se comprueba aqui es la
 * **decision**: que proveedor se elige, que degrada cuando toca, que no filtra la credencial, y
 * que el emparejamiento funciona en español. Que la API de verdad responda es otra cosa, y se
 * midio a mano (1,2–2,0 s, HTTP 200).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAllowlist,
  buildChunks,
  retrieve,
  scoreChunk,
  stem,
  tokenize,
} from '../src/lib/chat/chunks.ts'
import { getProvider, offlineProvider } from '../src/lib/chat/provider.ts'
import { buildPrompt } from '../src/lib/chat/prompt.ts'
import { CANARY_TOKENS, validateOutput } from '../src/lib/chat/guardrails.ts'
import { createChatHandler, resetIpQuota, type ChatHandler } from '../src/lib/chat/handler.ts'
import { cvFixture } from '../src/data/cv.fixture.ts'
import { parseCv, toPublicCv } from '../src/lib/cv/validate.ts'

const parsed = parseCv(cvFixture)
if (!parsed.ok) throw new Error('el fixture deberia validar en un test')
const cv = toPublicCv(parsed.cv)
const chunks = buildChunks(cv)
const allowlist = buildAllowlist(chunks)

const corpus = () => ({ chunks, allowlist })
const okProvider = () => () => ({
  id: 'test',
  degraded: false,
  complete: () =>
    Promise.resolve(JSON.stringify({ answer: 'Respuesta.', citations: [], confidence: 'low' })),
})

const call = async (handler: ChatHandler, request: Request) => {
  const response = await handler({ request })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

/**
 * Cada peticion lleva sesion propia a proposito. La ventana de sesion (12/min) vive en el modulo
 * y se comparte entre tests: con una sesion fija, el segundo test de cuota mediria la cuota de
 * sesion en vez de la de IP, y el fallo seria culpa del test y no del codigo. Es exactamente lo
 * que paso la primera vez que se escribio este fichero.
 */
let sesion = 0
const post = (question: string, headers: Record<string, string> = {}, ip = '198.51.100.1') => {
  sesion += 1
  return new Request('https://ejemplo.local/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session': `test-${sesion}`,
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify({ question }),
  })
}

describe('stem — emparejamiento en espanol', () => {
  it('reduce plurales a singular', () => {
    assert.equal(stem('certificaciones'), 'certificacion')
    assert.equal(stem('proyectos'), 'proyecto')
    assert.equal(stem('tecnologias'), 'tecnologia')
  })

  it('no toca palabras cortas, para no colapsar medio documento', () => {
    // El minimo esta en 3 caracteres. Sin el, "usa" -> "us" y el termino matchearia medio CV.
    assert.equal(stem('usa'), 'usa', 'tres letras no se tocan')
    assert.equal(stem('go'), 'go', 'dos letras no se tocan')
    // "anos" si se reduce, y esta bien: es el plural de "ano" y las dos formas siguen
    // emparejando porque la reduccion se aplica a los dos lados.
    assert.equal(stem('anos'), 'ano')
    assert.equal(stem('ano'), 'ano')
  })

  it('es simetrico: lo mismo que se aplica a la consulta se aplica al corpus', () => {
    // "kubernetes" se reduce por los dos lados, asi que sigue encontrandose. Esta es la garantia
    // que hace que la reduccion sea segura aunque no sea un stemmer linguistico.
    const conKube = chunks.find((c) => c.text.toLowerCase().includes('kubernetes'))
    assert.ok(conKube, 'el fixture debe traer un chunk con Kubernetes')
    const terminos = tokenize('kubernetes')
    assert.equal(terminos[0], 'kubernetes')
    assert.ok(
      scoreChunk(conKube, terminos) > 0,
      'kubernetes debe seguir encontrandose tras reducir',
    )
  })

  it('el singular del documento encuentra al plural de la pregunta', () => {
    // El fallo que se midio: "Certificacion CKA" en el CV contra "¿Que certificaciones tiene?".
    const r = retrieve('¿Que certificaciones tiene?', chunks, allowlist)
    assert.ok(r.topScore > 0, 'la pregunta en plural debe encontrar el singular del CV')
    assert.ok(
      r.chunks.some((c) => c.id === 'certificacion.cka'),
      'debe llegar el chunk de la certificacion',
    )
  })
})

describe('troceado por seccion (ADR-0009)', () => {
  it('el CV completo cabe en el tope de chunks de CHA-01', () => {
    // El motivo del rediseño: con un fragmento por item eran 16, se quedaban fuera los 8 mejores y
    // el retrieval perdiase preguntas normales. Con un fragmento por seccion cabe todo.
    assert.ok(chunks.length <= 8, `deben caber en 8 chunks, y son ${chunks.length}`)
  })

  it('el CV entero cabe en el presupuesto de contexto', () => {
    const total = chunks.reduce((n, c) => n + c.text.length, 0)
    assert.ok(total <= 12_000, `CHA-01 permite 3.000 tokens (~12.000 chars) y el CV ocupa ${total}`)
  })

  it('nombra las palabras por las que se pregunta de verdad', () => {
    // "¿Que tecnologias usa?" y "¿Donde estudio?" no compartian ni un termino con el documento.
    for (const pregunta of ['¿Que tecnologias usa?', '¿Donde estudio?']) {
      const r = retrieve(pregunta, chunks, allowlist)
      assert.ok(r.topScore > 0, `"${pregunta}" debe encontrar algo en el CV`)
    }
  })

  it('la allowlist sigue derivandose de los chunks, no escrita a mano', () => {
    assert.equal(allowlist.size, chunks.length)
    for (const c of chunks) assert.ok(allowlist.has(c.id))
  })
})

describe('proveedor Groq (ADR-0009, cierra ABR-01)', () => {
  it('groq sin clave degrada a off en vez de lanzar', () => {
    const p = getProvider('groq', undefined)
    assert.equal(p.id, 'off')
    assert.equal(p.degraded, true)
  })

  it('una clave en blanco es el mismo caso que no tenerla', () => {
    // El error mas probable al copiar la variable de entorno.
    assert.equal(getProvider('groq', '   ').id, 'off')
    assert.equal(getProvider('groq', '').id, 'off')
  })

  it('el proveedor de reserva responde desde el corpus, sin red y sin canario', async () => {
    // Es el camino que se toma cuando Groq cae. Si aqui devolviera el texto del prompt entero,
    // el fallback filtraria los canarios de G2 al visitante en cuanto el proveedor real falla.
    const p = offlineProvider()
    assert.equal(p.id, 'off')
    assert.equal(p.degraded, true)
    const bruto = await p.complete(
      buildPrompt(
        retrieve('¿Qué tecnologías usa?', chunks, allowlist).chunks,
        '¿Qué tecnologías usa?',
      ),
    )
    const salida = validateOutput(bruto, allowlist)
    assert.equal(salida.ok, true, 'la salida del fallback tiene que pasar G4 como cualquier otra')
    if (!salida.ok) return
    const texto = salida.answer.answer
    assert.equal(texto.includes('BEGIN CV DATA'), false, 'el fallback no puede recite el prompt')
    for (const canario of CANARY_TOKENS) {
      assert.equal(texto.includes(canario), false, `el fallback filtro el canario ${canario}`)
    }
  })

  it('groq con clave es groq, y no degradado', () => {
    const p = getProvider('groq', 'gsk-falsa')
    assert.equal(p.id, 'groq')
    assert.equal(p.degraded, false)
  })

  it('un valor desconocido lanza: es configuracion, no un fallo de red', () => {
    // Si esto degradara en silencio, un despliegue mal puesto responderia con citas y nadie se
    // enteraria de que lleva semanas hablando con el proveedor equivocado.
    assert.throws(() => getProvider('inventado', 'x'), /no esta implementado/)
  })

  it('la credencial no aparece en la serializacion del proveedor', () => {
    const clave = 'gsk-no-debe-salir-jamas'
    assert.ok(!JSON.stringify(getProvider('groq', clave)).includes(clave))
  })

  it('el proveedor de reserva no dice ser un modelo', () => {
    assert.equal(offlineProvider().degraded, true)
  })

  it('descarta el razonamiento y devuelve solo el content (CHA-37)', async () => {
    // `gpt-oss` responde con `message.reasoning` y `message.content` por separado. Si el
    // razonamiento se colara en `answer`, el visitante veria la cadena de pensamiento y G4
    // tendria que medir texto que no es la respuesta. Se comprueba con un `fetch` simulado, sin
    // red y sin clave real, porque lo que importa es el camino de la respuesta.
    const original = globalThis.fetch
    // Array y no `let`: TypeScript estrecha a `null` un `let` que solo se asigna dentro de un
    // closure, y despues `never`. Un array deja que el assertion lea lo que se guardo de verdad.
    const peticiones: unknown[] = []
    globalThis.fetch = ((_url: string, init: { body: string }) => {
      const cuerpo: unknown = JSON.parse(init.body)
      if (typeof cuerpo !== 'object' || cuerpo === null) throw new Error('cuerpo invalido')
      peticiones.push(cuerpo)
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  reasoning: 'primero pienso, luego respondo esto',
                  content: '{"answer":"Usa Go.","citations":["stack"],"confidence":"high"}',
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    }) as typeof fetch

    try {
      const p = getProvider('groq', 'gsk-falsa')
      const bruto = await p.complete(
        buildPrompt(
          retrieve('¿Qué tecnologías usa?', chunks, allowlist).chunks,
          '¿Qué tecnologías usa?',
        ),
      )
      assert.equal(bruto.includes('reasonamiento'), false, 'el razonamiento no puede salir')
      const v = validateOutput(bruto, allowlist)
      assert.equal(v.ok, true, 'el content de Groq tiene que pasar G4 tal cual')
      if (v.ok) assert.equal(v.answer.answer, 'Usa Go.')
      // `DEC-01.c` exige el modelo pineado, no el que el servicio tenga por defecto. Se comprueba
      // sobre el texto porque el cuerpo llega como `unknown`: narrowarlo entero para leer una
      // propiedad seria mas codigo del que merece una asercion.
      assert.equal(peticiones.length, 1, 'una peticion y solo una')
      const enviado = JSON.stringify(peticiones[0])
      assert.equal(
        enviado.includes('openai/gpt-oss-120b'),
        true,
        'la peticion debe fijar el modelo en vez de heredar el por defecto de la cuenta',
      )
    } finally {
      globalThis.fetch = original
    }
  })

  it('un content vacio es un fallo del proveedor, no una respuesta vacia (CHA-37)', async () => {
    // Sin esto, un `content: ""` llegaria a G4 como respuesta y el visitante veria un error de
    // sintaxis JSON del modelo en vez de un mensaje util del proveedor de reserva.
    const original = globalThis.fetch
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { reasoning: 'mucho rato pensando' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    try {
      const p = getProvider('groq', 'gsk-falsa')
      await assert.rejects(
        p.complete(
          buildPrompt(
            retrieve('¿Qué tecnologías usa?', chunks, allowlist).chunks,
            '¿Qué tecnologías usa?',
          ),
        ),
        /content vacio/,
      )
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('G4 con lo que devuelve un modelo real', () => {
  it('acepta la cita con corchetes que el modelo copia del bloque de datos', () => {
    // Medido con Groq: respondia "citations": ["[stack]"] porque el prompt escribe cada chunk
    // como "[id] texto". Sin esta normalizacion se rechazaba la respuesta correcta.
    const v = validateOutput(
      JSON.stringify({ answer: 'Usa Go.', citations: ['[stack]'], confidence: 'high' }),
      allowlist,
    )
    assert.equal(v.ok, true, 'la cita con corchetes debe aceptarse')
  })

  it('sigue rechazando un id con corchetes que no existe', () => {
    const v = validateOutput(
      JSON.stringify({ answer: 'X.', citations: ['[inventado]'], confidence: 'high' }),
      allowlist,
    )
    assert.equal(v.ok, false)
    if (!v.ok) assert.equal(v.reason, 'cita-no-permitida')
  })

  it('sigue rechazando un id derivado de uno real', () => {
    const real = [...allowlist][0] ?? 'stack'
    const v = validateOutput(
      JSON.stringify({ answer: 'X.', citations: [`${real}.inventado`], confidence: 'high' }),
      allowlist,
    )
    assert.equal(v.ok, false, 'un id que solo empieza como uno valido no vale')
  })
})

describe('cuota por IP (RNF-68, decision del PO)', () => {
  it('corta en la peticion 11 con el limite de 10 por minuto', async () => {
    resetIpQuota()
    const handler = createChatHandler(corpus, okProvider())
    const estados: number[] = []
    for (let i = 0; i < 14; i += 1) {
      const r = await call(handler, post('¿qué proyectos hay?', {}, '198.51.100.55'))
      estados.push(r.status)
    }
    const primero = estados.indexOf(429)
    assert.equal(primero, 10, `deberia cortar en la 11; estados: ${estados.join(',')}`)
  })

  it('la cuota es por IP, no global: otra IP no se ve afectada', async () => {
    resetIpQuota()
    const handler = createChatHandler(corpus, okProvider())
    const estados: number[] = []
    for (let i = 0; i < 12; i += 1) {
      estados.push((await call(handler, post('¿qué proyectos hay?', {}, '198.51.100.56'))).status)
    }
    const otra = await call(handler, post('¿qué proyectos hay?', {}, '198.51.100.57'))
    assert.equal(otra.status, 200, 'una IP distinta tiene su propia cuota')
  })

  it('la IP se toma del primer salto de x-forwarded-for', async () => {
    // La cabecera es una cadena de proxies. El primero es el cliente; fiarse del ultimo daria
    // como IP la del proxy, que es la misma para todo el mundo y no limita a nadie.
    resetIpQuota()
    const handler = createChatHandler(corpus, okProvider())
    const conCadena = await call(
      handler,
      post('¿qué proyectos hay?', { 'x-forwarded-for': '203.0.113.8, 10.0.0.1, 10.0.0.2' }),
    )
    assert.equal(conCadena.status, 200)
    // Misma IP real, distinta cadena: debe agotar la cuota de la primera.
    let cortes = 0
    for (let i = 0; i < 14; i += 1) {
      const r = await call(
        handler,
        post('¿qué proyectos hay?', { 'x-forwarded-for': '203.0.113.8, 10.0.0.9' }),
      )
      if (r.status === 429) cortes += 1
    }
    assert.ok(cortes > 0, 'el proxy distinto no debe crear una cuota nueva')
  })
})
