/**
 * Exportadores del CV — `RNF-100`, `RND-08`, `DEC-03.a`.
 *
 * Cuatro formatos se generan del MISMO `PublicCvDocument` que pinta la UI: JSON, JSON-LD,
 * Markdown y texto plano. `RNF-100` pide cinco; el quinto (PDF) es de `RF-11` y llega en el
 * Sprint 4, porque exige motor de render y no solo serializacion.
 *
 * Todos viven en un modulo comun por una razon de contratos: si cada exportador recorriera el
 * documento por su cuenta, un campo nuevo acabaria en un formato y no en los otros. Aqui el
 * documento se recorre en una unica direccion, de modo que el conjunto se rompe a la vez; que
 * es justo lo que se quiere para que `RNF-100` no se degrade en silencio.
 */

import {
  STACK_LEVELS,
  type Highlight,
  type PublicCvDocument,
  type StackLevel,
} from '../../data/schema.ts'
import { formatDuration, formatRange, totalExperienceMonths, yearsFrom } from './validate.ts'

export interface ExportContext {
  /** URL canonica del sitio. El texto plano debe ser autosuficiente (`RND-08`). */
  readonly url: string
  readonly now: Date
}

/** Orden editorial de los niveles, tomado del schema para no declararlo dos veces. */
const STACK_LEVEL_ORDER = Object.keys(STACK_LEVELS) as readonly StackLevel[]

/** `RND-02`: la unica definicion de "anos de experiencia", compartida con la UI y el PDF. */
function experienceYears(cv: PublicCvDocument, now: Date): string {
  return yearsFrom(totalExperienceMonths(cv, now))
}

/** Enlaces publicos de contacto. El email no existe en `PublicCvDocument` (`SEG-31`). */
function publicLinks(cv: PublicCvDocument): readonly string[] {
  return [cv.contact.github, cv.contact.linkedin].filter((url): url is string => url !== undefined)
}

/**
 * `RNF-33`: JSON-LD `Person` + `Occupation`, el dialecto que leen los ATS y los buscadores.
 *
 * `hasOccupation` es el termino schema.org para el puesto. Se usa `alumniOf` para formacion y
 * `knowsAbout` para el stack: son las propiedades que un ATS interpreta, no adorno.
 */
export function buildPersonJsonLd(
  cv: PublicCvDocument,
  ctx: ExportContext,
): Record<string, unknown> {
  const sameAs = publicLinks(cv)
  const skills = cv.stack.flatMap((group) => group.items.map((item) => item.name))
  const alumniOf = cv.education.map((entry) => ({
    '@type': 'EducationalOrganization',
    name: entry.institution,
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: cv.person.name,
    jobTitle: cv.person.role,
    description: cv.summary,
    url: ctx.url,
    address: {
      '@type': 'PostalAddress',
      addressLocality: cv.person.location,
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(skills.length > 0 ? { knowsAbout: skills } : {}),
    ...(alumniOf.length > 0 ? { alumniOf } : {}),
    hasOccupation: {
      '@type': 'Occupation',
      name: cv.person.role,
      occupationalCategory: cv.person.role,
      ...(skills.length > 0 ? { skills: skills.join(', ') } : {}),
    },
  }
}

/** `RNF-100`: JSON plano del documento publico, sin perdida semantica. */
export function toJson(cv: PublicCvDocument): string {
  return `${JSON.stringify(cv, null, 2)}\n`
}

/** `RNF-100`: el mismo JSON-LD que incrusta la pagina, como fichero descargable. */
export function toJsonLd(cv: PublicCvDocument, ctx: ExportContext): string {
  return `${JSON.stringify(buildPersonJsonLd(cv, ctx), null, 2)}\n`
}

/** Metrica con su evidencia opcional, en sintaxis Markdown. */
function markdownMetric(metric: Highlight['metric']): string {
  const value = `**${metric.value} ${metric.unit}**`
  return metric.evidence !== undefined ? `${value} ([evidencia](${metric.evidence}))` : value
}

/** `RNF-100`: Markdown con la misma jerarquia semantica que el HTML. */
export function toMarkdown(cv: PublicCvDocument, ctx: ExportContext): string {
  const lines: string[] = []
  const add = (line = ''): void => {
    lines.push(line)
  }

  add(`# ${cv.person.name} — ${cv.person.role}`)
  add()
  add(`> ${cv.person.tagline}`)
  add()
  add(cv.summary)
  add()
  add(`**${experienceYears(cv, ctx.now)} años de experiencia** · ${cv.person.location}`)
  add()

  if (cv.roles.length > 0) {
    add('## Experiencia')
    add()
    for (const role of cv.roles) {
      add(`### ${role.title} — ${role.company}`)
      add()
      add(
        `_${formatRange(role.start, role.end)} · ${formatDuration(role.start, role.end, ctx.now)}_`,
      )
      add()
      add(role.scope)
      add()
      for (const highlight of role.highlights) {
        add(`- ${highlight.text} — ${markdownMetric(highlight.metric)}`)
      }
      add()
    }
  }

  if (cv.projects.length > 0) {
    add('## Proyectos')
    add()
    for (const project of cv.projects) {
      add(`### ${project.name}`)
      add()
      add(project.problem)
      add()
      add(`- **Rol:** ${project.role}`)
      add(`- **Stack:** ${project.stack.join(', ')}`)
      add(`- **Resultado:** ${project.outcome}`)
      if (project.link !== undefined) add(`- **Enlace:** <${project.link}>`)
      add()
    }
  }

  if (cv.stack.length > 0) {
    add('## Stack')
    add()
    for (const group of cv.stack) {
      add(`### ${group.label}`)
      add()
      for (const item of group.items) {
        const years = item.years !== undefined ? ` (${item.years} años)` : ''
        add(`- ${item.name} — ${item.level}${years}`)
      }
      add()
    }
    const used = new Set<StackLevel>(
      cv.stack.flatMap((group) => group.items.map((item) => item.level)),
    )
    add('**Significado de los niveles**')
    add()
    for (const level of STACK_LEVEL_ORDER) {
      if (!used.has(level)) continue
      add(`- \`${level}\`: ${STACK_LEVELS[level]}`)
    }
    add()
  }

  if (cv.education.length > 0) {
    add('## Formación')
    add()
    for (const entry of cv.education) {
      add(`### ${entry.title} — ${entry.institution}`)
      add()
      add(formatRange(entry.start, entry.end))
      add()
      if (entry.detail !== undefined) {
        add(entry.detail)
        add()
      }
    }
  }

  if (cv.certifications.length > 0) {
    add('## Certificaciones')
    add()
    for (const cert of cv.certifications) {
      const expires = cert.expires !== null ? ` · caduca ${cert.expires}` : ''
      add(`- ${cert.name} — ${cert.issuer} · ${cert.date}${expires}`)
    }
    add()
  }

  if (cv.publications.length > 0) {
    add('## Publicaciones')
    add()
    for (const pub of cv.publications) {
      add(`- ${pub.title} — ${pub.kind} · ${pub.date} · <${pub.url}>`)
    }
    add()
  }

  if (publicLinks(cv).length > 0) {
    add('## Contacto')
    add()
    if (cv.contact.github !== undefined) add(`- GitHub: <${cv.contact.github}>`)
    if (cv.contact.linkedin !== undefined) add(`- LinkedIn: <${cv.contact.linkedin}>`)
    add()
  }

  add('---')
  add()
  add(`Actualizado: ${cv.lastReviewed} · ${ctx.url}`)

  return `${lines.join('\n')}\n`
}

/** `RND-08`: el CV completo en texto plano, legible sin JS y sin video. */
export function toPlainText(cv: PublicCvDocument, ctx: ExportContext): string {
  const lines: string[] = []
  const add = (line = ''): void => {
    lines.push(line)
  }
  const heading = (title: string): void => {
    add()
    add(title.toUpperCase())
    add('─'.repeat(title.length))
    add()
  }

  add(`${cv.person.name} — ${cv.person.role}`)
  add(`${experienceYears(cv, ctx.now)} años de experiencia · ${cv.person.location}`)
  add()
  add(cv.summary)

  if (cv.roles.length > 0) {
    heading('Experiencia')
    for (const role of cv.roles) {
      add(`${role.title} — ${role.company}`)
      add(
        `  ${formatRange(role.start, role.end)} · ${formatDuration(role.start, role.end, ctx.now)}`,
      )
      add(`  ${role.scope}`)
      for (const highlight of role.highlights) {
        const evidence =
          highlight.metric.evidence !== undefined ? `  ${highlight.metric.evidence}` : ''
        add(`  - ${highlight.text} [${highlight.metric.value} ${highlight.metric.unit}]${evidence}`)
      }
      add()
    }
  }

  if (cv.projects.length > 0) {
    heading('Proyectos')
    for (const project of cv.projects) {
      add(project.name)
      add(`  ${project.problem}`)
      add(`  Rol: ${project.role}`)
      add(`  Stack: ${project.stack.join(', ')}`)
      add(`  Resultado: ${project.outcome}`)
      if (project.link !== undefined) add(`  Enlace: ${project.link}`)
      add()
    }
  }

  if (cv.stack.length > 0) {
    heading('Stack')
    for (const group of cv.stack) {
      add(group.label)
      for (const item of group.items) {
        const years = item.years !== undefined ? ` (${item.years} años)` : ''
        add(`  - ${item.name} — ${item.level}${years}`)
      }
      add()
    }
  }

  if (cv.education.length > 0) {
    heading('Formación')
    for (const entry of cv.education) {
      add(`${entry.title} — ${entry.institution}`)
      add(`  ${formatRange(entry.start, entry.end)}`)
      if (entry.detail !== undefined) add(`  ${entry.detail}`)
      add()
    }
  }

  if (cv.certifications.length > 0) {
    heading('Certificaciones')
    for (const cert of cv.certifications) {
      const expires = cert.expires !== null ? ` · caduca ${cert.expires}` : ''
      add(`- ${cert.name} — ${cert.issuer} · ${cert.date}${expires}`)
    }
  }

  if (cv.publications.length > 0) {
    heading('Publicaciones')
    for (const pub of cv.publications) {
      add(`- ${pub.title} — ${pub.kind} · ${pub.date} · ${pub.url}`)
    }
  }

  if (publicLinks(cv).length > 0) {
    heading('Contacto')
    if (cv.contact.github !== undefined) add(`GitHub: ${cv.contact.github}`)
    if (cv.contact.linkedin !== undefined) add(`LinkedIn: ${cv.contact.linkedin}`)
  }

  add()
  add(`Actualizado: ${cv.lastReviewed} · ${ctx.url}`)

  return `${lines.join('\n')}\n`
}
