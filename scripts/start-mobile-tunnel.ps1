#Requires -Version 5.1
<#
.SYNOPSIS
    Arranca Expo con un túnel ngrok (funciona desde cualquier red).

.DESCRIPTION
    Usa `expo start --tunnel ngrok`, que no requiere cuenta de Expo.
    El túnel lo inicia el PC hacia afuera, así que el teléfono puede
    conectarse aunque esté en otra Wi-Fi, con datos móviles o detrás de
    WireGuard/VPN.

.PARAMETER Port
    Puerto local de Metro. Por defecto 8081.

.PARAMETER Force
    Si el puerto está ocupado por un proceso Expo/Metro/pnpm, lo detiene.
    No mata procesos ajenos.

.PARAMETER NoClear
    No limpia la caché de Metro. Por defecto se limpia para evitar
    bundles viejos tras cambios de SDK.

.EXAMPLE
    .\scripts\start-mobile-tunnel.ps1

.EXAMPLE
    .\scripts\start-mobile-tunnel.ps1 -Port 8082 -Force
#>
[CmdletBinding()]
param(
    [int]$Port = 8081,
    [switch]$Force,
    [switch]$NoClear
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# --- Node 22.13+ ---
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw 'Node.js no está instalado o no está en el PATH.'
}

$nodeVersionText = (& node --version).Trim().TrimStart('v')
try {
    $nodeVersion = [version]$nodeVersionText
} catch {
    throw "No se pudo interpretar la versión de Node: $nodeVersionText"
}

if ($nodeVersion -lt [version]'22.13.0') {
    throw "Node 22.13+ es obligatorio para Expo CLI 58. Versión actual: $nodeVersionText. Activa con: fnm use 22"
}

# --- @expo/ngrok ---
$ngrokCandidates = @(
    (Join-Path $root 'node_modules\@expo\ngrok'),
    (Join-Path $root 'apps\mobile\node_modules\@expo\ngrok')
)

if (-not ($ngrokCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1)) {
    Write-Host 'Instalando @expo/ngrok (solo la primera vez)...' -ForegroundColor Yellow
    & pnpm --filter mobile add -D '@expo/ngrok@^4.1.0'
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo instalar @expo/ngrok.'
    }
}

# --- Puerto libre ---
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($listener) {
    $ownerPid = $listener.OwningProcess
    $process = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $ownerPid" -ErrorAction SilentlyContinue).CommandLine
    $isExpoProcess = $commandLine -match 'expo|metro|pnpm'

    if ($Force -and $isExpoProcess) {
        Write-Host "Deteniendo proceso Expo/Metro en el puerto $Port (PID $ownerPid)..." -ForegroundColor Yellow
        Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        $name = if ($process) { $process.ProcessName } else { 'desconocido' }
        throw "El puerto $Port está ocupado por PID $ownerPid ($name). Cierra ese proceso o usa -Force."
    }
}

# --- Arrancar túnel ---
$expoArgs = @(
    '--filter', 'mobile', 'exec', 'expo', 'start',
    '--tunnel', 'ngrok',
    '--port', "$Port"
)

if (-not $NoClear) {
    $expoArgs += '--clear'
}

Write-Host ''
Write-Host "Iniciando Expo con túnel ngrok en el puerto $Port..." -ForegroundColor Cyan
Write-Host 'Espera a que aparezca "Tunnel ready" y escanea el QR con Expo Go.' -ForegroundColor Yellow
Write-Host 'La URL también aparece como exp://... en esta ventana.' -ForegroundColor Yellow
Write-Host ''

& pnpm @expoArgs
