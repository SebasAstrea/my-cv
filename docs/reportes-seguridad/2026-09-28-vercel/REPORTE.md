# Prueba de penetración — sitio público `sebasastrea-cv.vercel.app`

**Fecha:** 2026-09-28 · **Sprint:** 9 (seguridad, adelantado) · **Alcance:** superficie pública HTTP(S)
**Método:** comprobaciones **no destructivas** (cabeceras, TLS, exposición de rutas, PII en artefactos, CSP). Sin ataques activos, sin fuzzing, sin carga. Datos crudos en `datos.json`.

> Objetivo: corroborar lo que los gates verifican en local (`gate:security`, `gate:artifacts`) sobre
> el **despliegue real**, y dejar evidencia versionada.

---

## 1. Resumen

| Severidad | Nº |
|---|---|
| Crítica | 0 |
| Alta | 0 |
| Media | 0 |
| **Baja** | 2 |
| Informativa | 3 |

**Veredicto:** la superficie pública **no presenta hallazgos de severidad alta o media**. Los dos
hallazgos bajos son de endurecimiento, no de exposición. Los controles de `RNF-62/63` (`CSP`,
HSTS) y `SEG-01..05` se cumplen.

---

## 2. Hallazgos

| ID | Sev. | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|---|
| F1 | **Baja** | `access-control-allow-origin: *` en recursos estáticos (`/cv.*`, `/_astro/*`). Es el comportamiento por defecto de Vercel para estáticos. | `headersCvTxt` en `datos.json` | Datos públicos y sin credenciales → riesgo bajo. Para endurecer, fijar `Access-Control-Allow-Origin` al origen propio en `vercel.json`. |
| F2 | **Baja** | **TLS 1.2 habilitado** además de 1.3. `SEG-01` pide TLS 1.3. | `tls.tls12` en `datos.json` | En Vercel Hobby no se deshabilita 1.2 por configuración de cabeceras; se acepta y se documenta (1.3 se negocia primero). |
| F3 | Info | Cabecera `server: Vercel` **sin versión**. | `headersHome` | No viola `SEG-04` (no expone versión). Sin acción. |
| F4 | Info | `connect-src 'self'` en la CSP. | `headersHome` | Al integrar el chat (Sprints 6-7) habrá que ampliar `connect-src` al endpoint y a Turnstile; no es un hallazgo hoy. |
| F5 | Info | `cache-control: max-age=0, must-revalidate` en `/` y `/cv.*`. | `headersHome`, `headersCvTxt` | No es seguridad. Sugerencia: caché larga para `/_astro/*` y `cv.*` con `immutable`, y corta para el HTML. |

---

## 3. Controles verificados (sin hallazgo)

| Control | Requisito | Resultado |
|---|---|---|
| **CSP** restrictiva, con **hash del script inline** recalculado y coincidente | `RNF-62`, `SEG-02` | ✅ `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`; **sin** `unsafe-eval`/`unsafe-inline`; el hash `sha256-4cQkE…` del HTML desplegado aparece en la CSP |
| **HSTS** `max-age=31536000; includeSubDomains; preload` | `RNF-63`, `SEG-01` | ✅ |
| `X-Content-Type-Options: nosniff` | `SEG-03` | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | `SEG-03` | ✅ |
| `Permissions-Policy` (geo/cámara/micro denegados) | `SEG-03` | ✅ |
| `Cross-Origin-Opener-Policy: same-origin` | `SEG-03` | ✅ |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` (clickjacking) | `SEG-05` | ✅ |
| **HTTP → HTTPS** | `SEG-01` | ✅ 308 permanente |
| **Sin PII** en HTML/JSON/texto (email `private`) | `SEG-31/32` | ✅ 0 apariciones |
| **Rutas sensibles** no servidas | `SEG-31` | ✅ 404 en `/src/data/cv.real.ts`, `/package.json`, `/.git/config`, `/.env`, `/pnpm-lock.yaml`, `/docs/*`, `/scripts/*` |
| **Sin source maps** | — | ✅ 0 en `dist/` |
| Exportadores heredan cabeceras | `RNF-62`, `SEG-03` | ✅ `/cv.txt` con CSP + `nosniff` |

---

## 4. Conclusión y siguientes pasos

- La superficie pública está **sin hallazgos altos/medios**; se aceptan F1 y F2 como riesgos bajos documentados.
- **Pendiente de seguridad** que no cubre esta prueba (depende del chat/release): `SEG-22` (SBOM CycloneDX), `SEG-25`/`SEG-33..35`, rate limiting, Turnstile, y `SEG-44` (supresión).
- **Repetir** esta prueba en cada release (Sprint 12, smoke post-deploy) y tras activar el chat.
