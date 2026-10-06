@echo off
setlocal
set "WORKSHOP_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%WORKSHOP_PYTHON%" (
  "%WORKSHOP_PYTHON%" "%~dp0sync-narration-script.py"
  "%WORKSHOP_PYTHON%" "%~dp0server.py"
) else (
  python "%~dp0sync-narration-script.py"
  python "%~dp0server.py"
)
pause
