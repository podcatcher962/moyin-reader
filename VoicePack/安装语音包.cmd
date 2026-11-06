@echo off
chcp 65001 >nul 2>nul
title MoYin Reader - Install Free Offline Voice Pack
cd /d "%~dp0"
echo.
echo   MoYin Reader : free offline Chinese neural TTS installer
echo   Downloading open-source engine and models, please wait...
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  python install.py
) else (
  py -3 install.py
)
echo.
echo   Press any key to close.
pause >nul
