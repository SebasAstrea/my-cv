# Brief de vídeo — CV "Dossier" (línea temporal de 7 escenas)

Documento autocontenido para quien vaya a **escribir los prompts de generación de los clips**.
No hace falta conocer el repositorio: aquí está el contexto, la narrativa de scroll, la
dirección de arte y los entregables técnicos.

---

## 1. Qué es este proyecto

Un **CV de una sola página** con ritmo de vídeo. La página es un **documento editorial** que se
recorre **hacia abajo**; cada pantalla completa (*viewport*) es una **escena**, y detrás del
texto corre un **clip de vídeo tenue** como una "proyección". El contenido (texto) está siempre
por encima y es lo importante; el vídeo es **textura y atmósfera**, nunca protagonista.

- 7 escenas, una por sección del CV: `00 Identidad`, `01 Perfil`, `02 Experiencia`,
  `03 Proyectos`, `04 Stack`, `05 Formación`, `06 Contacto`.
- La web es **oscura por defecto** (también hay tema claro).
- **No hay música ni audio.** Los clips son **silenciosos**; se reproducen **una vez** y congelan el último frame (`ADR-0007`).
- Dirección de arte: **"proyección técnica"** — material real, luz dura y direccional, sin
  rostros, sin texto en imagen, sin música.

---

## 2. Cómo progresan los vídeos al hacer scroll (lo esencial)

El vídeo **no** es un scroll continuo tipo "scrubbing". Funciona **por escenas**:

1. Se hace scroll hacia abajo y la página encaja en la siguiente escena (*scroll-snap*: una
   escena = una pantalla).
2. En el DOM existe **un solo `<video>`** que se **recicla** cambiando el `src` al clip de la
   escena activa (nunca hay dos vídeos decodificando a la vez).
3. El clip de la escena **arranca al entrar** (cuando la escena ocupa ~60 % de la pantalla) y se
   **pausa al salir** (cuando baja del ~20 %). Al cambiar de escena, el clip anterior se
   **destruye** (libera memoria) pasado un momento.
4. Cada clip es **corto y silencioso**; se reproduce **una vez** y **congela el último frame**.
5. Las transiciones entre escenas son **corte duro**, nunca un fundido a negro.

Consecuencia para los prompts: cada clip debe ser **autónomo y cíclico**, y el **paso de una
escena a la siguiente** debe sentirse como una **continuación**, porque el espectador los ve
seguidos al bajar.

### La progresión de luz es la narrativa (esto es clave)

Lo que hace que la secuencia se sienta como **un viaje y no como 7 vídeos pegados** es una
**gradación de luz y contraste** a lo largo del scroll:

`00` luz natural dura → `01`–`03` cada vez **más oscura y más contrastada** → `04`–`05` luz
**neutra y más quieta** → `06` **resplandor** (una pantalla como fuente).

La **temperatura de color baja poco a poco** hasta `06`, y **vuelve a subir** en el empalme con
`00`. El **último frame de `06` y el primero de `00`** deben estar compuestos para encajar: el
ciclo completo es **continuo** (si el usuario sigue bajando, vuelve arriba conceptualmente).

### Cómo se ve el vídeo en pantalla

- Va **detrás del texto**, con una **capa oscura (scrim)** encima y **grano de película**. Por
  eso el clip se ve **apagado y de bajo contraste**: debe funcionar como **textura**, no como
  imagen principal.
- **Composición "para el scrim"**: el **25 % más oscuro del encuadre** debe caer **donde irá el
  texto**. El encuadre tiene **peso hacia la izquierda**, **no centrado**.
- El **texto lo pone la web** (HTML), no la imagen. Ver "Cero texto en imagen".

### Modos y excepciones

- **Modo vídeo `on/off/auto`**: en `off` solo se ve el **poster** (el primer frame), y no cambia
  el contenido. En `auto`, si el usuario pidió **reducir movimiento** o está en **móvil ≤ 600 px**,
  el vídeo **no se reproduce** por defecto: se ve el **poster estático**. Por eso el **primer
  frame** importa muchísimo (es lo que ve mucha gente).
- Si un clip no carga, se muestra el **poster** con el mismo arte (sin saltos).

---

## 3. Reglas de rodaje (dirección de arte)

| Regla | Detalle |
|---|---|
| **Luz** | **Una sola fuente práctica por clip.** Sin rellenos difusos. La sombra es diseño, no accidente. |
| **Lente** | ≥ **35 mm** equivalente. Nada de gran angular ni distorsión de bordes. |
| **Transición** | **Corte duro** siempre. Nunca fundido a negro. |
| **Color** | **Desaturado ~70 %** respecto al natural. El **único color saturado** permitido es el **acento ámbar** (`#f9ad00`, cálido), y **solo en ≤ 2 planos por clip**. |
| **Cero texto en imagen** | Ni rótulos, ni UI filmada, ni titulares en pantalla. El texto es del sitio. |
| **Audio** | **Ninguno.** Silenciosos (obligatorio). |
| **Grado** | Revelado bajo (proteger altas luces), **negros con toque frío**, acento en la zona media-alta. |
| **Sin bucle** | Los clips se reproducen una vez y congelan el último frame (`ADR-0007`). Al volver del final al principio se reinicia el ciclo. |

**Prohibido:** rostros y primeros planos de personas, planos aéreos/dron, *lens flares*, cámara
lenta ornamental, texto blanco centrado sobre negro, "estética de stock".

---

## 4. Las 7 escenas

Duración **exacta** (los clips se recortan, no se ralentizan). El "título en pantalla" lo dibuja
la web; en el vídeo debe haber **espacio negativo** para ese texto.

| # | Escena | Función | Duración | Qué se ve / movimiento | Cámara |
|---|---|---|---|---|---|
| `00` | Identidad | "Quién soy", presencia sin vanidad | **5 s** | Superficie de trabajo vacía; **luz rasante** que cruza lento; la sombra del marco de una ventana se desplaza sobre el material. | Fija, 35 mm |
| `01` | Perfil | El argumento | **5 s** | Extremo primer plano de **tipografía impresa**; **rack focus** de una palabra en primer plano al párrafo del fondo. | Fija, 50 mm macro |
| `02` | Experiencia | Progresión, el recorrido | **5 s** | Pasillo industrial o **sala de servidores**; luz **cenital dura**; solo **profundidad**. | *Dolly forward* lentísimo, 24→50 mm |
| `03` | Proyectos | **El payoff**, la prueba | **5 s** | Un plano del proyecto (mecanismo, luz de tarea o pantalla lateral). | Fija, 35 mm |
| `04` | Stack | Las herramientas | **5 s** | **Capas de material translúcido** apiladas, retroiluminadas (metacrilato, humo). No degradados digitales. | *Drift* vertical lento |
| `05` | Formación | Origen y trayectoria | **5 s** | Una **mano escribiendo** o una **página pasándose**: el gesto más humano del vídeo. | Fija, 50 mm |
| `06` | Contacto | Cierre, la puerta abierta | **5 s** | La fuente de luz pasa a ser el **resplandor de una pantalla**; la cámara se asienta y **queda quieta**. | Fija, 35 mm |

### Escena `03` — un solo plano (5 s)

Elegir **uno** de estos gestos (un solo plano de 5 s): un **macro de un mecanismo en movimiento** (sensación de sistema que trabaja solo), un **plano de trabajo con luz de tarea** (una sola lámpara, foco duro) o **una pantalla vista de lado, fuera de foco** (evoca software/datos sin mostrar UI legible).

---

## 5. Progresión de luz y color (resumen para el "viaje")

| Tramo | Escenas | Sensación |
|---|---|---|
| Apertura | `00` | Luz **natural dura**, espacio limpio, presencia. |
| Descenso | `01`–`03` | Progresivamente **más oscuro y contrastado**; la sombra pesa más. |
| Meseta | `04`–`05` | Luz **neutra y quieta**; humo/capas; gesto humano. |
| Cierre | `06` | **Resplandor** de pantalla; calma; al volver a `00` se reinicia el ciclo. |

Temperatura de color **baja** hasta `06` y **sube** al volver a `00`.

---

## 6. Entregables técnicos por clip

| Campo | Requisito |
|---|---|
| **Contenedor** | MP4 (**H.264 High**, `yuv420p`, `faststart`) **y** WebM (**VP9**). |
| **Resoluciones** | **1080p · 720p · 480p** (480p en AV1 si el encoder lo permite). |
| **Bitrate objetivo** | 1080p ≤ **3.5 Mbps** · 720p ≤ **2.2 Mbps** · 480p ≤ **900 kbps**. |
| **GOP** | **Keyframe cada 1 s** (necesario para el montaje por escenas). |
| **Duración** | La de la tabla, **al frame**. |
| **Poster** | Primer frame exportado como **AVIF ≤ 70 KB**. |
| **Audio** | **Stripped** (sin pista). |
| **Nombres** | `sc00-1080p.mp4`, `sc01-1080p.mp4`, … `sc06-1080p.mp4` (y sus versiones 720p/480p y `.webm`). |

**Presupuestos de rendimiento:** primer segmento ≤ **800 KB**; total de la línea (7 escenas) ~
**1.5 MB**. Los clips deben ser **ligeros**.

---

## 7. Qué NO debe aparecer (resumen)

- Rostros o primeros planos de personas.
- Texto, rótulos, logos o UI legible en la imagen.
- Música o cualquier audio.
- Dron, *lens flare*, cámara lenta decorativa.
- Degradados digitales, glassmorphism, "estética de plantilla".
- Fundidos a negro entre escenas (siempre **corte duro**).

---

## 8. Datos para prompts (recordatorio rápido)

- **Escenas y tiempos:** `00` 0–5 s · `01` 5–10 s · `02` 10–15 s · `03` 15–20 s ·
  `04` 20–25 s · `05` 25–30 s · `06` 30–35 s (total **35 s**).
- **Aspecto:** pantalla completa; **16:9** para desktop y que funcione en móvil vertical
  (encuadre con **espacio negativo arriba/izquierda** para el texto).
- **Clima cromático:** desaturado ~70 %, **negros fríos**, acento **ámbar** solo puntual.
- **Movimiento:** lento, contenido, "respiración" de cámara; nada frenético.
- **Continuidad:** los clips se reproducen **una vez** y congelan; el **viaje de luz** de `00`→`06` (y vuelta) es lo que
  da sentido a la secuencia.
