@echo off
setlocal
cd /d "%~dp0"
set "WORKSHOP_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "WORKSHOP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if not exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    echo Node.js is required. Install Node.js, then run this file again.
    pause
    exit /b 1
  )
)
start "" "http://127.0.0.1:4173"
"%WORKSHOP_NODE%" server.mjs
pause
