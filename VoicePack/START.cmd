@echo off
chcp 65001 >nul 2>nul
title MoYin Reader - Free Neural TTS
cd /d "%~dp0"
rem The full EXE has the voice engine built in and starts the service itself.
if exist "..\MoYinReader.exe" (
  start "" "..\MoYinReader.exe"
  goto DONE
)
if exist "MoYinVoice.exe" goto LEGACY
where python >nul 2>nul
if %errorlevel%==0 goto PY
py -3 tts_server.py %*
goto DONE
:LEGACY
MoYinVoice.exe %*
goto DONE
:PY
python tts_server.py %*
:DONE
