#!/bin/sh
exec python3 -B "$(dirname "$0")/../run_module_qa.py" campos "$@"
