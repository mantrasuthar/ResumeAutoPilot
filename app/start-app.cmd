@echo off
cd /d "%~dp0"
if not exist data mkdir data
"C:\Program Files\nodejs\node.exe" server.js >> data\server.log 2>&1
