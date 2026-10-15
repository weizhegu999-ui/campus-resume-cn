@echo off
setlocal
cd /d "%~dp0"
set "CAMPUS_RESUME_NODE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined CAMPUS_RESUME_NODE set "CAMPUS_RESUME_NODE=%%I"
if not defined CAMPUS_RESUME_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "CAMPUS_RESUME_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined CAMPUS_RESUME_NODE (
  echo Node.js 24+ is required. Install Node.js or run this from a terminal with node.exe in PATH.
  pause
  exit /b 1
)
"%CAMPUS_RESUME_NODE%" -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 (
  echo Node.js 24+ is required. Update Node.js and try again.
  pause
  exit /b 1
)
"%CAMPUS_RESUME_NODE%" scripts\serve.mjs --open
if errorlevel 1 pause
endlocal
