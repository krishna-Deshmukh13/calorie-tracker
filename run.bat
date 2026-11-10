@echo off
title Calorie Track - Local Server
echo Starting Calorie Track at http://localhost:8080 ...
start http://localhost:8080
python -m http.server 8080
pause
