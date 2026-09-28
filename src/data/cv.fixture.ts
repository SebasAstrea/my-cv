/**
 * DATOS SEMILLA — NO ES EL CV REAL.
 *
 * `ADR-0003`: mientras `CV_DATA_SOURCE=fixture`, este fichero alimenta el sitio. Su unico
 * proposito es ejercitar el schema y los gates con datos que imiten la complejidad real
 * (solapes entre roles, un rol en curso, metricas con evidencia) sin esperar a que el
 * propietario entregue su CV.
 *
 * - El build de produccion **falla** si `CV_DATA_SOURCE != real` (`astro.config.mjs`).
 * - `scripts/gate-placeholders.ts` falla si el fixture llega a un artefacto de produccion.
 * - El sitio marca visualmente que los datos no son reales mientras el flag sea `fixture`.
 *
 * Para sustituirlo: renombra este fichero a `cv.real.ts` (esta en `.gitignore`, `SEG-30`),
 * rellena los datos reales, quita todos los `fixture: true` y arranca con
 * `CV_DATA_SOURCE=real`. No hay que tocar ningun otro fichero: todo lo demas consume
 * `getCv()`.
 */

import { cvDocument } from './schema.ts'

/**
 * `lastReviewed` es reciente a proposito: `RND-04` rechaza un CV con mas de 6 meses sin
 * revisar, y el fixture tendria que fallar por una razon que no es la que queremos probar.
 */
export const cvFixture = cvDocument.parse({
  schemaVersion: 1,

  lastReviewed: '2026-08-15',

  person: {
    name: 'Nombre Apellido',
    role: 'Ingenieria de Plataforma',
    tagline: 'Construyo plataformas que otros equipos no tienen que operar a oscuras.',
    location: 'Ciudad, Pais',
    lang: 'es',
    fixture: true,
  },

  summary:
    'Ingeniero de plataforma con foco en reducir el trabajo no planificado: presupuestos, ' +
    'observabilidad y automatizacion del despliegue. Ultimos anos en equipos donde el incidente ' +
    'se descubre por el cliente, no por la alerta.',

  /* ---- 02 Experiencia: 4 roles, con solape deliberado entre los dos ultimos ---- */
  roles: [
    {
      id: 'plataforma-actual',
      company: 'Empresa Cuatro',
      title: 'Ingeniero de Plataforma',
      start: '2024-02',
      end: null,
      scope:
        'Plataforma de despliegue para 40 equipos. Tooling interno, budget de error y alertas ' +
        'que se responden antes que el cliente las note.',
      employmentType: 'full-time',
      location: 'Remoto',
      highlights: [
        {
          text: 'Reduje el tiempo de recuperacion de incidentes cutriplicando el presupuesto de error.',
          metric: {
            value: 31,
            unit: 'min',
            period: 'mediana p75, 12 meses',
            evidence: 'https://example.invalid/incidentes',
          },
          visibility: 'public',
        },
        {
          text: 'Sustituible la desplega manual por un pipeline con aprobacion automatica en 12 servicios.',
          metric: {
            value: 68,
            unit: '%',
            period: 'reduccion de tiempo de despliegue',
            evidence: 'https://example.invalid/pipeline',
          },
          visibility: 'public',
        },
        {
          text: 'Adopcion del nuevo proceso de despliegue sin formacion obligatoria.',
          metric: {
            value: 40,
            unit: 'equipos',
            period: 'equipos activos',
            evidence: 'https://example.invalid/adopcion',
          },
          visibility: 'public',
        },
      ],
      visibility: 'public',
      fixture: true,
    },
    {
      id: 'sre-consultoria',
      company: 'Consultoria Dos',
      title: 'SRE Consultor',
      start: '2022-09',
      end: '2024-01',
      scope:
        'Consultoria de fiabilidad para equipos de producto de 10–30 personas. Auditorias de ' +
        'disponibilidad y planes de contigencia.',
      employmentType: 'contract',
      highlights: [
        {
          text: 'Cinco auditorias de disponibilidad que dejaron un plan de accion con calendario.',
          metric: {
            value: 5,
            unit: 'auditorias',
            period: '12 meses',
            evidence: 'https://example.invalid/auditorias',
          },
          visibility: 'public',
        },
        {
          text: 'Disponibilidad sostenida por encima del objetivo acordado en dos de los clientes.',
          metric: {
            value: 99.95,
            unit: '%',
            period: 'mediana 6 meses',
            evidence: 'https://example.invalid/slo',
          },
          visibility: 'public',
        },
      ],
      visibility: 'public',
      fixture: true,
    },
    {
      id: 'backend-tres',
      company: 'Empresa Tres',
      title: 'Ingeniero Backend',
      start: '2021-01',
      end: '2023-05',
      scope:
        'API y persistencia de un producto B2B. Equipo propio de seis personas, dos de ellas de producto.',
      employmentType: 'full-time',
      highlights: [
        {
          text: 'Latencia p99 de la ruta de lectura reduciendola sin cachear mas de lo que ya habia.',
          metric: {
            value: 42,
            unit: '%',
            period: 'reduccion p99',
            evidence: 'https://example.invalid/latencia',
          },
          visibility: 'public',
        },
        {
          text: 'Migracion de la base de datos a particionado sin ventana de parada.',
          metric: {
            value: 0,
            unit: 'min',
            period: 'ventana de parada',
            evidence: 'https://example.invalid/migracion',
          },
          visibility: 'public',
        },
      ],
      visibility: 'public',
      fixture: true,
    },
    {
      id: 'frontend-inicio',
      company: 'Empresa Uno',
      title: 'Desarrollador Frontend',
      start: '2019-03',
      end: '2020-11',
      scope:
        'Interfaz de producto con foco en accesibilidad y en que la interfaz se pueda usar sin raton.',
      employmentType: 'full-time',
      highlights: [
        {
          text: 'Cierre del informe de accesibilidad: de 12 violaciones serias a cero.',
          metric: {
            value: 12,
            unit: 'violaciones',
            period: 'antes de la intervencion',
            evidence: 'https://example.invalid/a11y',
          },
          visibility: 'public',
        },
        {
          text: 'Reduccion de peso de la pagina principal sin perdida de contenido.',
          metric: {
            value: 58,
            unit: '%',
            period: 'reduccion de peso',
            evidence: 'https://example.invalid/peso',
          },
          visibility: 'public',
        },
      ],
      visibility: 'public',
      fixture: true,
    },
  ],

  /* ---- 03 Proyectos ---- */
  projects: [
    {
      id: 'presupuesto-de-error',
      name: 'Presupuesto de error por servicio',
      problem:
        'Un presupuesto global de error ocultaba que un servicio concreto era el causante de ' +
        'todos los incidentes de laorganización.',
      role: 'Disenador e implementador',
      stack: ['Go', 'Prometheus', 'OpenTelemetry', 'Kubernetes'],
      outcome:
        'Cada consumo de SLO descuenta del presupuesto de su servicio. La revision semanal ' +
        'paso a tener datos, no intuicion.',
      link: 'https://example.invalid/presupuesto',
      start: '2024-05',
      end: '2024-11',
      visibility: 'public',
      fixture: true,
    },
    {
      id: 'tooling-deploy',
      name: 'Pipeline de despliegue con aprobacion',
      problem:
        'El despliegue manual era el cuello de botella del equipo y la causa mas frecuente de ' +
        'errores de configuracion.',
      role: 'Arquitecto e implementador principal',
      stack: ['TypeScript', 'GitHub Actions', 'Terraform'],
      outcome:
        'Aprobacion automatica por politica, con vuelta atras de un comando. 12 servicios ' +
        'migrados y despliegue diario por servicio.',
      link: 'https://example.invalid/pipeline',
      start: '2024-03',
      end: '2024-08',
      visibility: 'public',
      fixture: true,
    },
    {
      id: 'migracion-postgres',
      name: 'Particionado de Postgres',
      problem:
        'La tabla de eventos habia pasado de 400 M filas y las consultas de agregacion ' +
        'empeoraban de forma lineal con el volumen.',
      role: 'Responsable unico del proyecto',
      stack: ['PostgreSQL', 'Go'],
      outcome:
        'Particionado por mes con retencion configurable. Latencia p99 estable tras duplicar ' +
        'el volumen de eventos.',
      start: '2022-06',
      end: '2022-12',
      visibility: 'public',
      fixture: true,
    },
  ],

  /* ---- 04 Stack: agrupado, con niveles que el schema define en prosa (`RF-22`) ---- */
  stack: [
    {
      id: 'lenguajes',
      label: 'Lenguajes',
      items: [
        { name: 'TypeScript', level: 'daily', years: 8 },
        { name: 'Go', level: 'advanced', years: 4 },
        { name: 'Python', level: 'familiar', years: 6 },
        { name: 'SQL', level: 'daily', years: 9 },
      ],
    },
    {
      id: 'infraestructura',
      label: 'Infraestructura',
      items: [
        { name: 'Kubernetes', level: 'daily', years: 5 },
        { name: 'Terraform', level: 'proficient', years: 4 },
        { name: 'AWS', level: 'advanced', years: 6 },
        { name: 'Nginx', level: 'proficient', years: 8 },
      ],
    },
    {
      id: 'observabilidad',
      label: 'Observabilidad',
      items: [
        { name: 'Prometheus', level: 'daily', years: 5 },
        { name: 'OpenTelemetry', level: 'advanced', years: 3 },
        { name: 'Grafana', level: 'daily', years: 5 },
      ],
    },
    {
      id: 'frontend',
      label: 'Interfaz',
      items: [
        { name: 'Astro', level: 'proficient', years: 2 },
        { name: 'CSS moderno', level: 'daily', years: 9 },
        { name: 'React', level: 'proficient', years: 6 },
      ],
    },
  ],

  /* ---- 05 Formacion ---- */
  education: [
    {
      id: 'grado',
      title: 'Grado en Ingenieria Informatica',
      institution: 'Universidad de Ejemplo',
      start: '2015-09',
      end: '2019-06',
      detail: 'Especialidad en sistemas distribuidos. Trabajo de fin de grado sobre consenso.',
    },
  ],

  certifications: [
    {
      id: 'cka',
      name: 'Certified Kubernetes Administrator',
      issuer: 'CNCF',
      date: '2023-04',
      expires: null,
      evidence: 'https://example.invalid/cka',
    },
  ],

  publications: [
    {
      id: 'talk-slo',
      title: 'Presupuestos de error que nadie mira',
      kind: 'talk',
      date: '2025-03',
      url: 'https://example.invalid/talk-slo',
    },
  ],

  /* ---- 06 Contacto. Todo `private`: se elimina en build (`SEG-31`) ---- */
  contact: {
    email: 'nombre.apellido@example.invalid',
    emailVisibility: 'private',
    github: 'https://github.com/example',
    linkedin: 'https://www.linkedin.com/in/example',
    // A proposito DISTINTO de `person.location`: la direccion precisa es `private`, la ciudad
    // es publica. Si coincidieran, el gate SEG-32 no podria distinguir una fuga real de un
    // valor legitimo repetido, y habria que desactivarlo para que el build pase.
    location: 'Calle Ejemplo 12, 3 B, 28001 Ciudad, Pais',
    locationVisibility: 'private',
  },
}) satisfies ReturnType<typeof cvDocument.parse>

export type CvFixture = typeof cvFixture
