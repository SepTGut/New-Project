@echo off
setlocal
echo ===================================================
echo   Smart Warehouse - Startup Script
echo   Web App + WA Bot + Internet Tunnel (Cloudflare)
echo ===================================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Docker Compose...
    docker compose up -d --build
    goto done
)

where podman >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Podman Compose...
    podman compose up -d --build
    goto done
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Podman\podman.exe" (
    echo Using Podman from AppData...
    set "PATH=C:\Users\%USERNAME%\AppData\Local\Programs\Podman;%PATH%"
    podman compose up -d --build
    goto done
)

echo [ERROR] Docker atau Podman tidak ditemukan!
echo Install Docker Desktop terlebih dahulu.
pause
exit /b 1

:done
echo.
echo ===================================================
echo   Semua Layanan Berjalan!
echo.
echo   LOKAL (LAN):
echo   - Web Aplikasi  : http://localhost:3000
echo   - Bot Dashboard : http://localhost:3001/dashboard
echo.
echo   INTERNET (Publik):
echo   - URL Permanen sudah aktif via Cloudflare Tunnel
echo   - Cek Cloudflare Dashboard untuk URL domain-mu:
echo     https://dash.cloudflare.com -> Zero Trust -> Tunnels
echo.
echo   3 Container berjalan:
echo     stock_opname_app    (Web)
echo     stock_opname_wabot  (Bot)
echo     cloudflare_tunnel   (Internet Tunnel)
echo ===================================================
echo.
pause
