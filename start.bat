@echo off
setlocal EnableDelayedExpansion
echo ===================================================
echo   Smart Warehouse - Startup Script
echo   Web App + WA Bot + Internet Tunnel
echo ===================================================
echo.

:: ─────────────────────────────────────────────────────
:: STEP 1: Start Docker / Podman containers
:: ─────────────────────────────────────────────────────
echo [1/3] Starting Docker containers...
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Docker Compose...
    docker compose up -d --build
    goto tunnel
)

where podman >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Podman Compose...
    podman compose up -d --build
    goto tunnel
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Podman\podman.exe" (
    echo Using Podman from AppData...
    set "PATH=C:\Users\%USERNAME%\AppData\Local\Programs\Podman;%PATH%"
    podman compose up -d --build
    goto tunnel
)

echo [ERROR] Docker atau Podman tidak ditemukan!
echo Install Docker Desktop terlebih dahulu.
pause
exit /b 1

:: ─────────────────────────────────────────────────────
:: STEP 2: Check / Install cloudflared
:: ─────────────────────────────────────────────────────
:tunnel
echo.
echo [2/3] Memeriksa Cloudflare Tunnel (cloudflared)...

set "CF_EXE=%~dp0cloudflared.exe"

:: Check if cloudflared.exe already exists next to this script
if exist "%CF_EXE%" goto start_tunnel

:: Check if cloudflared is in PATH
where cloudflared >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "CF_EXE=cloudflared"
    goto start_tunnel
)

:: Auto-download cloudflared for Windows
echo cloudflared belum ada - mengunduh otomatis...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF_EXE%' -UseBasicParsing"

if not exist "%CF_EXE%" (
    echo [WARNING] Gagal mengunduh cloudflared. Internet tunnel tidak tersedia.
    echo           Akses lokal tetap bisa digunakan.
    goto done
)
echo cloudflared berhasil diunduh!

:: ─────────────────────────────────────────────────────
:: STEP 3: Start free public tunnel (no login needed)
:: ─────────────────────────────────────────────────────
:start_tunnel
echo.
echo [3/3] Membuka Internet Tunnel (URL publik gratis)...
echo       URL akan muncul dalam beberapa detik...
echo.

:: Start tunnel in a new window - tunnels port 3000 (web app)
start "Cloudflare Tunnel - Smart Warehouse" cmd /k ^
  "echo Cloudflare Tunnel aktif - tunggu URL... & echo. & \"%CF_EXE%\" tunnel --url http://localhost:3000 --no-autoupdate"

:: Give it a moment to start
timeout /t 3 /nobreak >nul

:: ─────────────────────────────────────────────────────
:: DONE
:: ─────────────────────────────────────────────────────
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
echo   - Lihat window "Cloudflare Tunnel" untuk URL-nya
echo     Contoh: https://abc123.trycloudflare.com
echo.
echo   CATATAN:
echo   - URL tunnel berubah setiap kali di-restart
echo   - Untuk URL permanen, daftarkan akun Cloudflare
echo     dan jalankan: cloudflared tunnel login
echo ===================================================
echo.
pause
