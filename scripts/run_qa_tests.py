#!/usr/bin/env python3
"""Run the backend, frontend, and visible QA farm tests in one command."""

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.request import ProxyHandler, build_opener


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
GRADLE = [str(ROOT / "gradlew"), "--no-daemon"]
POSTGIS_IMAGE = "postgis/postgis:16-3.7"
QA_DATABASE = "agro_qa"


def note(message):
    print(message, flush=True)


def find_java_17():
    candidates = [os.environ.get("JAVA_HOME")]
    if Path("/usr/libexec/java_home").is_file():
        result = subprocess.run(
            ["/usr/libexec/java_home", "-v", "17"], capture_output=True, text=True
        )
        candidates.append(result.stdout.strip())
    javac = shutil.which("javac")
    if javac:
        candidates.append(str(Path(javac).resolve().parent.parent))

    for candidate in filter(None, candidates):
        home = Path(candidate).expanduser().resolve()
        compiler = home / "bin" / "javac"
        if compiler.is_file():
            result = subprocess.run([str(compiler), "-version"], capture_output=True, text=True)
            if result.returncode == 0 and re.match(r"javac 17(?:[.\s]|$)", result.stdout):
                return home
    raise RuntimeError("Select an installed JDK 17 with JAVA_HOME and try again.")


def preflight():
    for command in ("docker", "node", "npm"):
        if shutil.which(command) is None:
            raise RuntimeError(f"Install {command} before running the QA suite.")
    if not (FRONTEND / "node_modules" / "@playwright" / "test" / "package.json").is_file():
        raise RuntimeError("Install the frontend dependencies with cd frontend && npm ci.")

    docker = subprocess.run(
        ["docker", "info", "--format", "{{.ServerVersion}}"], capture_output=True, text=True
    )
    if docker.returncode != 0:
        raise RuntimeError(f"Could not reach the local Docker engine. {docker.stderr.strip()}")

    java_home = find_java_17()
    env = os.environ.copy()
    env["JAVA_HOME"] = str(java_home)
    env["PATH"] = f"{java_home / 'bin'}{os.pathsep}{env['PATH']}"
    note(f"JDK 17: {java_home}")
    return env


def wait_for(description, check, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.5)
    raise RuntimeError(f"Timed out waiting for {description}.")


@contextmanager
def process_group(command, **kwargs):
    with subprocess.Popen(command, start_new_session=True, **kwargs) as process:
        try:
            yield process
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                except ProcessLookupError:
                    pass


@contextmanager
def postgis(name, image, env):
    password = secrets.token_hex(24)
    docker_env = {**env, "POSTGRES_PASSWORD": password}
    note(f"Starting disposable PostGIS container {name} ({image})")
    started = False
    try:
        subprocess.run(
            [
                "docker", "run", "--detach", "--rm", "--name", name,
                "--publish", "127.0.0.1::5432",
                "--tmpfs", "/var/lib/postgresql/data",
                "--env", f"POSTGRES_DB={QA_DATABASE}",
                "--env", f"POSTGRES_USER={QA_DATABASE}",
                "--env", "POSTGRES_PASSWORD", image,
            ],
            env=docker_env,
            check=True,
        )
        started = True

        def ready():
            result = subprocess.run(
                ["docker", "exec", name, "pg_isready", "-h", "127.0.0.1",
                 "-U", QA_DATABASE, "-d", QA_DATABASE],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            return result.returncode == 0

        try:
            wait_for("PostGIS", ready, timeout=90)
        except RuntimeError:
            subprocess.run(["docker", "logs", "--tail", "40", name], check=False)
            raise

        address = subprocess.check_output(["docker", "port", name, "5432/tcp"], text=True).strip()
        if not re.fullmatch(r"127\.0\.0\.1:\d+", address):
            raise RuntimeError(f"Unexpected PostGIS port binding: {address}")
        jdbc_url = f"jdbc:postgresql://{address}/{QA_DATABASE}"
        spring_config = {
            "spring.datasource.url": jdbc_url,
            "spring.datasource.username": QA_DATABASE,
            "spring.datasource.password": password,
            "spring.flyway.url": jdbc_url,
            "spring.flyway.user": QA_DATABASE,
            "spring.flyway.password": password,
        }
        yield {**env, "SPRING_APPLICATION_JSON": json.dumps(spring_config)}
    finally:
        removed = subprocess.run(
            ["docker", "rm", "--force", name], capture_output=True, text=True
        )
        if started and removed.returncode and "No such container" not in removed.stderr:
            raise RuntimeError(f"Could not remove QA container {name}: {removed.stderr.strip()}")
        if started:
            note(f"Removed disposable PostGIS container {name}")


@contextmanager
def qa_api(env, log_path, web_port):
    note(f"Starting the QA API. Log: {log_path.relative_to(ROOT)}")
    spring_config = json.loads(env["SPRING_APPLICATION_JSON"])
    spring_config.update({
        "server.address": "127.0.0.1",
        "server.port": 0,
        "server.servlet.session.cookie.secure": False,
        "app.cors.allowed-origins": f"http://127.0.0.1:{web_port}",
    })
    api_env = {**env, "SPRING_APPLICATION_JSON": json.dumps(spring_config)}
    opener = build_opener(ProxyHandler({}))

    with log_path.open("w", encoding="utf-8") as log, process_group(
        [*GRADLE, "bootRun"], cwd=ROOT, env=api_env, stdout=log, stderr=subprocess.STDOUT
    ) as process:

        def ready():
            if process.poll() is not None:
                raise RuntimeError(f"The QA API exited with status {process.returncode}. See {log_path}.")
            output = log_path.read_text(encoding="utf-8", errors="replace")
            started = re.search(r"Tomcat started on port (\d+)", output)
            if started is None:
                return None
            url = f"http://127.0.0.1:{started.group(1)}"
            try:
                with opener.open(f"{url}/actuator/health", timeout=1) as response:
                    if json.load(response).get("status") == "UP":
                        return url
            except (OSError, ValueError):
                return None
            return None

        yield wait_for(f"QA API startup (see {log_path})", ready, timeout=180)


def run_stage(results, title, command, *, cwd, env, timeout=None):
    note(f"\n== {title} ==")
    with process_group(command, cwd=cwd, env=env) as process:
        try:
            results[title] = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            note(f"{title} timed out after {timeout} seconds.")
            results[title] = 124


def available_loopback_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def run_browser(results, run_id, api_url, web_port, step_delay, *, walkthrough):
    stage = "walkthrough" if walkthrough else "browser"
    report = FRONTEND / "playwright-report" / run_id / stage
    output = FRONTEND / "test-results" / run_id / stage
    env = {
        **os.environ,
        "AGRO_API_URL": api_url,
        "AGRO_QA_WEB_PORT": str(web_port),
        "AGRO_LIVE_TEST": "0" if walkthrough else "1",
        "AGRO_MANUAL_E2E": "0",
        "AGRO_QA_WALKTHROUGH": "1" if walkthrough else "0",
        "AGRO_E2E_ALLOW_WRITES": "SI" if walkthrough else "NO",
        "AGRO_E2E_STEP_DELAY_MS": str(step_delay),
        "AGRO_E2E_PREFIX": "E2E-QA",
        "PWDEBUG": "0",
        "PLAYWRIGHT_HTML_OPEN": "never",
        "PLAYWRIGHT_HTML_OUTPUT_DIR": str(report),
    }
    command = [
        "npm", "run", "test:e2e", "--", "--headed", "--workers=1",
        "--reporter=list,html", "--output", str(output),
    ]
    title = "Frontend browser suite in Google Chrome"
    if walkthrough:
        command.extend(["tests/manual-agricultural-workflow.spec.ts", "--project=desktop"])
        title = "Automated QA farm walkthrough in Google Chrome"
    else:
        command.extend(["--trace=off", "--grep-invert", r"manual-agricultural-workflow\.spec\.ts"])

    run_stage(results, title, command, cwd=FRONTEND, env=env)
    note(f"Playwright report: {report.relative_to(ROOT) / 'index.html'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--step-delay-ms", type=int, default=1000,
                        help="Time to read each QA walkthrough step (0–5000 ms, default 1000).")
    parser.add_argument("--postgis-image", default=POSTGIS_IMAGE,
                        help=f"Docker image for the isolated database (default {POSTGIS_IMAGE}).")
    args = parser.parse_args()
    if not 0 <= args.step_delay_ms <= 5000:
        parser.error("--step-delay-ms must be between 0 and 5000.")

    env = preflight()
    run_id = f"agro-qa-{time.strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(4)}"
    output = FRONTEND / "test-results" / run_id
    output.mkdir(parents=True, exist_ok=False)
    results = {}
    try:
        with postgis(run_id, args.postgis_image, env) as test_env:
            run_stage(results, "Backend Gradle tests", [*GRADLE, "cleanTest", "test"],
                      cwd=ROOT, env=test_env)
            run_stage(results, "Frontend unit tests", ["npm", "test"], cwd=FRONTEND, env=env)
            run_stage(results, "Frontend build", ["npm", "run", "build"],
                      cwd=FRONTEND, env=env, timeout=180)
            web_port = available_loopback_port()
            with qa_api(test_env, output / "backend.log", web_port) as api_url:
                run_browser(results, run_id, api_url, web_port, args.step_delay_ms, walkthrough=True)
                run_browser(results, run_id, api_url, web_port, args.step_delay_ms, walkthrough=False)
    finally:
        note("\nQA run summary")
        for title, status in results.items():
            note(f"  {'PASS' if status == 0 else f'FAIL ({status})'}  {title}")
        note(f"  Run artifacts: {output.relative_to(ROOT)}")
        note("  Gradle report: build/reports/tests/test/index.html")

    return int(any(results.values()))


def interrupt(_signum, _frame):
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupt)
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit("QA run interrupted.")
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(f"QA run failed: {error}")
