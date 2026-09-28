/// <reference types="astro/client" />

/**
 * Variables de entorno PUBLICAS (Vite las inyecta en el bundle del cliente).
 *
 * `PUBLIC_CONTACT_EMAIL` es el unico dato de contacto que viaja al cliente: se usa para el
 * revelado bajo interaccion del email (`RF-27`). El `contact.email` del CV sigue `private` y
 * se elimina en build (`SEG-31`). Decision y limites en `docs/adr/0005`.
 */
interface ImportMetaEnv {
  readonly PUBLIC_CONTACT_EMAIL?: string
}
