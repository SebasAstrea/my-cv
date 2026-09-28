/**
 * Pruebas de la aritmetica de fechas — `RF-23`, `RND-02`, `RND-03`, `RND-04`.
 *
 * La fecha es el unico dato del CV que depende del reloj, y por eso es donde un error
 * pasa desapercibido: nada lanza, nada se rompe, solo un numero sale un mes corto.
 *
 * Estas pruebas fijan ese numero. En particular `localMonth` tiene su propio test porque
 * su regresion es invisible en el resto del suite: solo se manifiesta en las primeras
 * horas del dia 1 de un mes, en una zona horaria positiva respecto a UTC.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  formatDuration,
  formatRange,
  localMonth,
  monthIndex,
  monthsBetween,
  yearsFrom,
} from '../src/lib/cv/validate.ts'

// La zona horaria se fija antes de que corra ningun test, y no por الواقع.
//
// `localMonth` responde "que mes es ahora segun el calendario local", asi que su resultado
// depende de la zona del proceso. Sin esta linea la suite pasa en Madrid y falla en
// Bogota —o al reves— sin que cambie ni una linea del codigo bajo prueba. Un test que
// depende de donde se ejecuta no verifica el requisito: verifica la maquina.
//
// Si esto falla, la causa casi nunca es la logica de fechas: es que se ha borrado el pin.
process.env.TZ = 'Europe/Madrid'

/** Fecha local, sin depender de la zona horaria del proceso. */
const local = (y: number, m: number, d = 15): Date => new Date(y, m - 1, d, 12, 0, 0)

describe('monthIndex', () => {
  test('convierte YYYY-MM a un indice comparable', () => {
    assert.equal(monthIndex('2024-02'), 2024 * 12 + 1)
  })

  test('el indice ordena los meses en el tiempo', () => {
    const marzo = monthIndex('2024-03')
    const febrero = monthIndex('2024-02')
    // `assert.ok` declara `asserts value`, asi que esto ademas estrecha el tipo: el proyecto
    // prohibe el `!` (AGENTS.md), y escribir la comprobacion es lo que lo deja innecesario.
    assert.ok(marzo !== undefined)
    assert.ok(febrero !== undefined)
    assert.ok(marzo > febrero)
  })

  test('tolera el dia aunque solo se use el mes', () => {
    assert.equal(monthIndex('2024-02-29'), monthIndex('2024-02'))
  })

  test('rechaza lo que no es un mes', () => {
    for (const bad of ['2024-13', '2024-00', '2024-1', 'ayer', '', '202402']) {
      assert.equal(monthIndex(bad), undefined, `deberia rechazar ${JSON.stringify(bad)}`)
    }
  })
})

describe('localMonth', () => {
  test('devuelve el mes en curso con componentes locales, no UTC', () => {
    assert.equal(localMonth(local(2026, 9)), '2026-09')
    assert.equal(localMonth(local(2026, 1)), '2026-01')
    assert.equal(localMonth(local(2026, 12)), '2026-12')
  })

  // Este es el test que falla con `now.toISOString().slice(0, 7)`.
  //
  // Las 00:30 del 1 de septiembre en Madrid (UTC+2) son las 22:30 del 31 de agosto en UTC.
  // `toISOString()` responde "2026-08" mientras el calendario local ya dice septiembre, y
  // todo rol en curso pierde un mes. El fallo solo aparece una hora al mes y en la mitad
  // del planeta, que es justo por lo que un gate manual no lo encuentra.
  test('no retrocede un mes a primera hora de un mes en una zona ahead de UTC', () => {
    const primeraHoraDelMes = new Date('2026-09-01T00:30:00+02:00')
    assert.equal(localMonth(primeraHoraDelMes), '2026-09')
  })

  test('tampoco adelanta un mes en el ultimo instante del mes', () => {
    const ultimoInstanteDeAgosto = new Date('2026-08-31T23:59:59+02:00')
    assert.equal(localMonth(ultimoInstanteDeAgosto), '2026-08')
  })

  // El mismo instante, en la zona del proceso y en UTC, tienen que discrepar. Si coincidieran,
  // el test de arriba estaria probando `toISOString()` y no `localMonth`.
  test('el resultado sigue a la zona del proceso, no a UTC', () => {
    assert.equal(localMonth(new Date('2026-09-01T00:30:00+02:00')), '2026-09')
    assert.notEqual(
      localMonth(new Date('2026-09-01T00:30:00+02:00')),
      new Date('2026-09-01T00:30:00+02:00').toISOString().slice(0, 7),
    )
  })
})

describe('monthsBetween', () => {
  test('cuenta meses enteros hacia delante', () => {
    assert.equal(monthsBetween('2024-02', '2024-03'), 1)
    assert.equal(monthsBetween('2024-02', '2025-02'), 12)
  })

  test('da negativo si el final es anterior al inicio', () => {
    assert.equal(monthsBetween('2024-03', '2024-02'), -1)
  })

  test('propaga `undefined` si alguna fecha no es valida', () => {
    assert.equal(monthsBetween('nope', '2024-02'), undefined)
    assert.equal(monthsBetween('2024-02', 'nope'), undefined)
  })
})

describe('formatDuration — RF-23', () => {
  const now = local(2026, 9)

  test('anos exactos, sin meses de sobra', () => {
    assert.equal(formatDuration('2022-03', '2024-03', now), '2 anos')
  })

  test('singular de ano', () => {
    assert.equal(formatDuration('2023-03', '2024-03', now), '1 ano')
  })

  test('plural de ano', () => {
    assert.equal(formatDuration('2020-03', '2024-03', now), '4 anos')
  })

  test('anos mas meses', () => {
    assert.equal(formatDuration('2024-02', '2026-09', now), '2 anos 7 meses')
  })

  test('singular de mes', () => {
    assert.equal(formatDuration('2026-08', '2026-09', now), '1 mes')
  })

  test('plural de meses sin anos', () => {
    assert.equal(formatDuration('2026-02', '2026-09', now), '7 meses')
  })

  test('un rol en curso se mide contra el mes en curso local', () => {
    // Con `toISOString()` en una zona UTC+2 esto devolvia "2 anos 6 meses" la primera
    // hora del dia 1 de cada mes.
    assert.equal(
      formatDuration('2024-02', null, new Date('2026-09-01T00:30:00+02:00')),
      '2 anos 7 meses',
    )
  })

  test('cero o negativo no produce "0 anos"', () => {
    assert.equal(formatDuration('2026-09', '2026-09', now), 'menos de un mes')
    assert.equal(formatDuration('2026-10', '2026-09', now), 'menos de un mes')
  })

  test('fecha de inicio ilegible devuelve cadena vacia, no "NaN"', () => {
    assert.equal(formatDuration('nope', null, now), '')
  })
})

describe('formatRange — RF-23', () => {
  test('rango cerrado', () => {
    assert.equal(formatRange('2024-02', '2024-01'), 'Feb 2024 – Ene 2024')
  })

  test('rango abierto se cierra con "Presente"', () => {
    assert.equal(formatRange('2024-02', null), 'Feb 2024 – Presente')
  })

  // El renderizador de meses usa `months[n - 1] ?? ''`, asi que un mes fuera de rango
  // produciria silenciosamente " 2024" en lugar de fallar. Este test recorre los doce
  // nombres posibles para que ese `?? ''` no pueda quedarse sin vigilar.
  test('los doce meses tienen nombre, ninguno cae en el fallback vacio', () => {
    const esperados = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ]
    for (const [i, nombre] of esperados.entries()) {
      const mes = String(i + 1).padStart(2, '0')
      const texto = formatRange(`2024-${mes}`, null)
      assert.equal(texto, `${nombre} 2024 – Presente`)
      assert.ok(!texto.startsWith(' '), `mes ${mes} cayo en el fallback vacio`)
    }
  })
})

describe('yearsFrom — RND-02', () => {
  test('un decimal, nunca meses y dias', () => {
    assert.equal(yearsFrom(12), '1.0')
    assert.equal(yearsFrom(88), '7.3')
    assert.equal(yearsFrom(0), '0.0')
  })
})
