@echo off
cd /d "%~dp0"
echo Starting DS Quest on http://127.0.0.1:5177 ...
start "" http://127.0.0.1:5177
node server.js
