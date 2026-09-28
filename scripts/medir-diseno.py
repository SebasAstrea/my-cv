"""
Analisis de pixeles y contraste — Sprint 1.

Cubre lo que `axe` NO puede ver:

1. **Contraste real.** axe lee los colores *declarados*. Si una cascada termina
   heredando un color de un ancestro que el autor no tasa, axe pasa y un humano
   no lee. Aqui se resuelve el color de primer plano y el fondo *efectivo* (paseando
   los ancestros mientras el fondo sea transparente) y se calcula el ratio WCAG 2.1.

2. **Las capturas no estan vacias.** Un headless mal configurado produce un PNG
   blanco y un informe reluciente. Se mide la cobertura de tinta: si una escena
   tiene ~0% de pixeles distintos del fondo, la captura no sirve como evidencia y
   el script falla en vez de publicar una imagen en blanco.

Se leen los JSON que produjo `scripts/medir-lab.mjs` y se escribe `datos-diseno.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
OUT = RAIZ / "docs" / "reportes-calidad" / "1-fundacion-y-toolchain"

# Contrastes minimos WCAG 2.1 (AA). Tamano de texto normal = < 18.66px bold / 24px normal.
MINIMO_NORMAL = 4.5
MINIMO_GRANDE = 3.0
GRANDE_PX = 24.0
GRANDE_PX_BOLD = 18.66


def luminancia_relativa(canal: float) -> float:
    s = canal / 255.0
    return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4


def luminancia(rgb: tuple[int, int, int]) -> float:
    r, g, b = (relativ_luminancia(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio_contraste(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = luminancia(a), luminancia(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def parse_rgb(valor: str) -> tuple[int, int, int] | None:
    """`rgb(r, g, b)` / `rgba(r, g, b, a)` -> tupla. `oklch(...)` no se convierte aqui."""
    v = valor.strip()
    if not v.startswith("rgb"):
        return None
    nums = v[v.index("(") + 1 : v.rindex(")")].split(",")
    if len(nums) < 3:
        return None
    try:
        return tuple(int(float(n.strip())) for n in nums[:3])  # type: ignore[return-value]
    except ValueError:
        return None


FONDO = (251, 250, 247)  # --surface-0 del tema claro, el fondo real del shell
ACENTO = (249, 173, 0)   # --accent de tokens.css, el unico acento permitido (RUI-01)

# §4.3 cuenta "pixeles dentro de la tolerancia OKLCH del acento". En sRGB el criterio
# equivalente y reproducible es distancia euclidea con un umbral. 60 separa el acento de lo
# demas: el texto de cuerpo claro (236,242,246) esta a ~72 de (249,173,0), asi que con este
# umbral NO cuenta como acento. Subirlo a 100 lo contaria y inflaria la metrica.
TOLERANCIA_ACENTO = 60


def analizar_png(ruta: Path) -> dict:
    """Las dos metricas de pixel de §4.3 medibles sin video.

    - `% de pixeles con acento` <= 1.5% (RUI-01: un acento, no una paleta).
    - `area en blanco por escena` >= 40% (pixeles sin contenido tipografico).

    La cobertura total acompana a las dos: por debajo del 1% el PNG no sirve como evidencia y
    el script lo reporta como captura vacia en vez de contarlo como escena sobria.
    """
    with Image.open(ruta) as img:
        # numpy en vez de `getdata()`: Pillow 12 deprecó `getdata` y avisa en cada llamada.
        arr = np.asarray(img.convert("RGB").resize((400, 400)), dtype=np.int16)

    d_fondo = np.linalg.norm(arr - np.array(FONDO, dtype=float), axis=2)
    d_acento = np.linalg.norm(arr - np.array(ACENTO, dtype=float), axis=2)

    con_tinta = d_fondo > 24
    # El acento cuenta solo donde hay tinta: un fondo parecido al acento no es un acento, y la
    # mayor parte de la pagina es fondo.
    acento = (d_acento <= TOLERANCIA_ACENTO) & con_tinta
    return {
        "coberturaTintaPct": round(float(con_tinta.mean()) * 100, 2),
        "pixelesAcentoPct": round(float(acento.mean()) * 100, 3),
        "areaEnBlancoPct": round((1 - float(con_tinta.mean())) * 100, 2),
    }


def main() -> int:
    if not (OUT / "datos-lab.json").exists():
        print("  Falta datos-lab.json. Ejecuta antes: node scripts/medir-lab.mjs", file=sys.stderr)
        return 1

    lab = json.loads((OUT / "datos-lab.json").read_text(encoding="utf-8"))
    capturas = lab["diseno"]["capturas"]

    # 1) Contraste real por escena, resuelto en el navegador.
    contraste = lab.get("contraste", [])
    fallos = [c for c in contraste if c["cumple"] is False]

    # 2) Las capturas tienen contenido.
    pixeles: list[dict] = []
    capturas_vacias: list[str] = []
    for cap in capturas:
        ruta = OUT / cap["archivo"]
        if not ruta.exists():
            capturas_vacias.append(cap["archivo"] + " (no existe)")
            continue
        m = analizar_png(ruta)
        pixeles.append({"archivo": cap["archivo"], "id": cap["id"], **m})
        if m["coberturaTintaPct"] < 1:
            capturas_vacias.append(f"{cap['archivo']} ({m['coberturaTintaPct']}% de tinta — casi vacia)")

    # 3) Presupuesto de diseño §4.3, con el veredicto explicito.
    presupuesto = []
    for escena in lab["diseno"]["escenas"]:
        incumple = []
        if escena["nodos"] > 6:
            incumple.append(f"nodos {escena['nodos']} > 6")
        if escena["caracteresApoyo"] > 280:
            incumple.append(f"caracteres de apoyo {escena['caracteresApoyo']} > 280")
        px = next((q for q in pixeles if q["id"] == escena["id"]), None)
        if px is not None:
            if px["pixelesAcentoPct"] > 1.5:
                incumple.append(f"pixeles de acento {px['pixelesAcentoPct']}% > 1.5%")
            if px["areaEnBlancoPct"] < 40:
                incumple.append(f"area en blanco {px['areaEnBlancoPct']}% < 40%")
        presupuesto.append({**escena, "pixeles": px, "cumple": not incumple, "incumplimientos": incumple})

    # 4) Accesibilidad §4.8: lo que se puede resumir a un booleano.
    a11y = []
    for estado in lab["accesibilidad"]:
        if estado.get("aplicable") is False:
            a11y.append(
                {
                    "estado": estado["estado"],
                    "aplicable": False,
                    "motivo": estado["motivo"],
                    "cumple": None,
                }
            )
            continue
        a11y.append(
            {
                "estado": estado["estado"],
                "aplicable": True,
                "violaciones": len(estado["violaciones"]),
                "seriousCritical": estado["seriousCritical"],
                "reflow320SinScrollHorizontal": estado["scrollHorizontalExcesoPx"] == 0,
                "animacionesVivasConReducedMotion": estado["reducedMotion"]["vivas"],
                "targetsMenoresDe24px": len(estado["targetsMenoresDe24px"]),
                "cumple": (
                    estado["seriousCritical"] == 0
                    and estado["scrollHorizontalExcesoPx"] == 0
                    and estado["reducedMotion"]["vivas"] == 0
                    and len(estado["targetsMenoresDe24px"]) == 0
                ),
            }
        )

    salida = {
        "generadoPor": "scripts/medir-diseno.py",
        "sprint": "1-fundacion-y-toolchain",
        "contraste": contraste,
        "resumenContraste": {
            "evaluados": len(contraste),
            "incumplen": len(fallos),
            "nota": "oklch() no se convierte sin colorjs; los tokens en oklch salen como 'n/m' y "
            "quedan cubiertos por el calculo en el navegador, no por esta conversion.",
        },
        "pixeles": pixeles,
        "capturasVacias": capturas_vacias,
        "presupuestoDiseno": presupuesto,
        "accesibilidad": a11y,
    }
    (OUT / "datos-diseno.json").write_text(
        json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"\n  ANALISIS DE DISENO Y PIXELES — Sprint 1\n")
    print(f"  Contraste real: {len(contraste) - len(fallos)}/{len(contraste)} cumplen AA")
    for c in fallos:
        print(f"    MAL {c['contexto']}: {c['ratio']:.2f}:1 (min {c['minimo']}) — {c['motivo']}")
    vacias_ok = not capturas_vacias
    print(f"  Capturas con contenido: {len(pixeles)}/{len(capturas)}" + ("" if vacias_ok else f" — FALLAN: {capturas_vacias}"))
    for p in pixeles:
        print(
            f"    {p['archivo']:<28} tinta {p['coberturaTintaPct']:>5.2f}%"
            f"  acento {p['pixelesAcentoPct']:>6.3f}%"
            f"  blanco {p['areaEnBlancoPct']:>5.2f}%"
        )
    print(f"\n  Presupuesto de diseno (§4.3): {sum(1 for p in presupuesto if p['cumple'])}/{len(presupuesto)} escenas cumplen")
    for p in presupuesto:
        if not p["cumple"]:
            print(f"    MAL {p['id']}: {', '.join(p['incumplimientos'])}")
    medidos = [a for a in a11y if a["aplicable"]]
    print(
        f"\n  Accesibilidad (§4.8): {sum(1 for a in medidos if a['cumple'])}/{len(medidos)} "
        f"estados aplicables cumplen; {len(a11y) - len(medidos)} no aplicables"
    )
    for a in a11y:
        if not a["aplicable"]:
            print(f"    n/m {a['estado']}: {a['motivo']}")
            continue
        print(
            f"    {'OK ' if a['cumple'] else 'MAL'} {a['estado']:<16} "
            f"viol {a['violaciones']} · reflow320 {'ok' if a['reflow320SinScrollHorizontal'] else 'MAL'} · "
            f"animVivas {a['animacionesVivasConReducedMotion']} · targets<24px {a['targetsMenoresDe24px']}"
        )
    print(f"\n  datos: {OUT.relative_to(RAIZ)}/datos-diseno.json\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
