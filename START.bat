@echo off
cd /d "%~dp0"
title Content Planner APP Launcher

echo ===================================================
echo   Content Planner APP - Starting Next.js...
echo ===================================================
echo.

echo [1/2] Iniciando o app fullstack Next.js...
start /B cmd /c "npm run dev"

echo.
echo [2/2] Aguardando inicializacao (3 segundos)...
timeout /t 3 /nobreak >nul

echo.
echo Abrindo o Content Planner APP no seu navegador...
start http://localhost:3006

echo.
echo ===================================================
echo   App em execucao no plano de fundo.
echo   Feche esta janela para encerrar o processo.
echo ===================================================
echo.

pause

