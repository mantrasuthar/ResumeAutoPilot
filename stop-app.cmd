@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*outputs\\app\\server.js*' -or $_.CommandLine -like '*design-an-windows-app-where-i\\outputs\\app\\server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
