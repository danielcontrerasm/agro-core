"""Run a standalone Chrome walkthrough and archive a separate video per module."""

import argparse
from datetime import datetime
from html import escape
import json
import os
from pathlib import Path
from secrets import token_hex
from shutil import copy2
import signal
import subprocess
import sys

from run_qa_tests import GRADLE, POSTGIS_IMAGE, available_loopback_port, interrupt, postgis, preflight, qa_api

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
MODULES = {
    "dashboard": "Dashboard",
    "tareas": "Mi trabajo de hoy",
    "campos": "Campos y bloques",
    "mapas": "Mapas",
    "plantas": "Surcos y plantas",
    "siembra": "Siembra y ciclos",
    "riego": "Riego",
    "fertilizacion": "Fertilización",
    "plagas": "Plagas y enfermedades",
    "prevencion": "Medidas preventivas",
    "cosecha": "Cosecha",
    "reportes": "Reportes y actividad",
    "centro-agronomico": "Centro agronómico",
    "configuracion": "Configuración",
    "acceso": "Acceso a la finca",
}

STYLES = """
*{box-sizing:border-box}
body{margin:0;background:#f1f7f4;color:#193227;font:15px/1.55 system-ui,sans-serif}
main{max-width:1250px;margin:auto;padding:24px}
h1{margin:4px 0 12px;font-size:clamp(26px,4vw,42px);letter-spacing:-.035em;line-height:1.15}
h2{margin:0 0 7px;font-size:17px}
p{margin:5px 0 13px;color:#456458}
a{color:#076a43}
nav{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,265px),1fr));gap:12px}
article{padding:15px;background:white;border:1px solid #dce9e2;border-radius:9px;min-width:0}
.players{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:16px;align-items:start}
video{display:block;width:100%;aspect-ratio:16/10;background:#16382e;border-radius:8px}
ol{margin:8px 0;padding-inline-start:26px}
li{padding-block:5px}
@media(max-width:800px){.players{grid-template-columns:1fr}main{padding:14px}}
"""


def write_page(path, title, content):
    path.write_text(
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{escape(title)}</title><style>{STYLES}</style></head>"
        f"<body><main><h1>{escape(title)}</h1>{content}</main></body></html>",
        encoding="utf-8",
    )


def test_results(report, file=None):
    """Read the latest Playwright result for each independent spec."""
    file = report.get("file") or file
    for spec in report.get("specs", []):
        for test in spec["tests"]:
            if test["results"]:
                yield Path(file or spec["file"]).stem.removesuffix(".spec"), test["results"][-1]
    for suite in report.get("suites", []):
        yield from test_results(suite, file)


def archive_results(output, selected, pause, *, connected=False):
    json_report = output / "resultados.json"
    report = json.loads(json_report.read_text()) if json_report.exists() else {}
    results = dict(test_results(report))
    cards = []
    complete = True
    for key in selected:
        name = MODULES[key]
        spec_name = "fertilization" if connected else key
        result = results.get(spec_name, {})
        attachments = result.get("attachments", [])
        video = next(
            (Path(item["path"]) for item in attachments if item["name"] == "video" and item.get("path")),
            None,
        )
        recorded = video is not None and video.is_file()
        if recorded:
            copy2(video, output / "videos" / f"{key}.webm")
        passed = result.get("status") == "passed"
        complete = complete and passed and recorded
        state = "Aprobada" if passed else "Por revisar"
        captures = []
        for attachment in attachments:
            image = attachment.get("path")
            if attachment["contentType"] != "image/png" or not image or not Path(image).is_file():
                continue
            frame = f"{len(captures) + 1:02}.png"
            folder = output / "capturas" / key
            folder.mkdir(parents=True, exist_ok=True)
            copy2(image, folder / frame)
            captures.append(f'<li><a href="../capturas/{key}/{frame}">{escape(attachment["name"])}</a></li>')
        player = (
            f'<video controls playsinline preload="metadata" src="../videos/{key}.webm"></video>'
            if recorded else "<p>Grabación no disponible para esta ejecución.</p>"
        )
        download = f'<a href="../videos/{key}.webm" download>Descargar video</a>' if recorded else ""
        write_page(output / "modulos" / f"{key}.html", name,
                   '<nav><a href="../index.html">Todos los módulos</a>'
                   f'{download}<a href="../playwright/index.html">Resultados de Playwright</a></nav>'
                   f'<p>{state} en Chrome · {len(captures)} capturas de la prueba</p>'
                   f'<div class="players">{player}<article><h2>Capturas</h2><ol>{"".join(captures)}</ol></article></div>')
        cards.append(f'<article><h2>{escape(name)}</h2><p>{state} · {len(captures)} capturas</p>'
                     f'<a href="modulos/{key}.html">Ver recorrido</a></article>')

    dataset = ('El recorrido usa una finca y una base PostGIS desechables.' if connected
               else 'Los recorridos usan datos de prueba en sesiones independientes.')
    write_page(output / "index.html", "AgroVision · Pruebas por módulo",
               f'<p>Un video por módulo, con pausas de {pause / 1000:g} segundos por paso. '
               f'{dataset}</p>'
               '<nav><a href="playwright/index.html">Informe de Playwright</a></nav>'
               f'<div class="grid">{"".join(cards)}</div>')
    return complete


def nonnegative(text):
    number = int(text)
    if number < 0:
        raise argparse.ArgumentTypeError("El valor debe ser mayor o igual que cero.")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("modulo", choices=[*MODULES, "all"], help="Módulo que se va a probar")
    parser.add_argument("--pause-ms", type=nonnegative, default=12_000, help="Pausa tras cada paso")
    parser.add_argument("--action-ms", type=nonnegative, default=350, help="Demora por acción de Chrome")
    parser.add_argument("--headless", action="store_true", help="Grabar Chrome en segundo plano")
    parser.add_argument("--workers", type=nonnegative, default=1, help="Procesos de prueba")
    parser.add_argument("--postgis", action="store_true", help="Ejecutar Fertilización contra una base PostGIS desechable")
    parser.add_argument("--offline", action="store_true", help="Arrancar la API de pruebas usando la caché de Gradle")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers debe ser mayor o igual que 1")
    if args.postgis and args.modulo != "fertilizacion":
        parser.error("--postgis está disponible para el módulo fertilizacion")

    selected = list(MODULES) if args.modulo == "all" else [args.modulo]
    web_port = available_loopback_port()
    runtime_env = preflight() if args.postgis else os.environ
    run_id = f'qa-modulos-{datetime.now():%Y%m%d-%H%M%S}-{token_hex(3)}'
    output = FRONTEND / "playwright-report" / run_id
    output.mkdir(parents=True, exist_ok=False)
    for folder in ("videos", "capturas", "modulos"):
        (output / folder).mkdir()
    env = {
        **runtime_env,
        "AGRO_MODULE_PORT": str(web_port),
        "AGRO_MODULE_CONNECTED": "1" if args.postgis else "0",
        "AGRO_MODULE_PAUSE_MS": str(args.pause_ms),
        "AGRO_MODULE_ACTION_MS": str(args.action_ms),
        "AGRO_MODULE_HEADLESS": "1" if args.headless else "0",
        "AGRO_MODULE_RESULTS": str(FRONTEND / "test-results" / run_id),
        "AGRO_MODULE_HTML": str(output / "playwright"),
        "AGRO_MODULE_JSON": str(output / "resultados.json"),
    }
    command = [
        "npm", "run", "test:e2e", "--", "--config", "playwright.modules.config.ts",
        "--workers", str(args.workers),
    ]
    print(f'Pruebas de Chrome en {output.relative_to(ROOT)}', flush=True)
    if args.postgis:
        if args.offline:
            GRADLE.append("--offline")
        command.extend(["tests/fertilization.spec.ts", "--grep", " connected recurring fertilization"])
        with postgis(f"agro-{run_id}", POSTGIS_IMAGE, runtime_env) as database_env:
            with qa_api(database_env, output / "backend.log", web_port) as api_url:
                env.update({"AGRO_LIVE_TEST": "1", "AGRO_API_URL": api_url, "AGRO_QA_WEB_PORT": str(web_port)})
                result = subprocess.run(command, env=env, cwd=FRONTEND, check=False)
    else:
        command.extend(f"qa/modules/{name}.spec.ts" for name in selected)
        result = subprocess.run(command, env=env, cwd=FRONTEND, check=False)
    complete = archive_results(output, selected, args.pause_ms, connected=args.postgis)
    print(f'Informe y videos en {output.relative_to(ROOT) / "index.html"}', flush=True)
    return result.returncode or int(not complete)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupt)
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit("Recorrido interrumpido.")
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(f"El recorrido falló. {error}")
