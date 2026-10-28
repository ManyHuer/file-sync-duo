#Requires -Version 5.1
<#
.SYNOPSIS
    Arranca Expo forzando la IP LAN correcta (evita WireGuard/VPN).

.DESCRIPTION
    Expo elige la primera IP no interna del sistema. Si hay una interfaz
    WireGuard o VPN activa, puede anunciar esa IP y el teléfono no podrá
    descargar el bundle. Este script detecta una IP LAN "normal" y la pasa
    a Expo mediante REACT_NATIVE_PACKAGER_HOSTNAME.

.PARAMETER Clear
    Limpia la caché de Metro antes de arrancar.

.EXAMPLE
    .\scripts\start-mobile.ps1
    .\scripts\start-mobile.ps1 -Clear
#>
[CmdletBinding()]
param(
    [switch]$Clear
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.InterfaceAlias -notlike '*WireGuard*' -and
        $_.InterfaceAlias -notlike '*VPN*' -and
        $_.InterfaceAlias -notlike '*Tunnel*'
    } |
    Sort-Object InterfaceAlias

$ip = $candidates | Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
    throw 'No se encontró una IP LAN. Conecta el PC a Ethernet o Wi-Fi.'
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip

Write-Host ''
Write-Host "Expo LAN host: $ip" -ForegroundColor Cyan
Write-Host "URL para Expo Go: exp://$ip:8081" -ForegroundColor Cyan
Write-Host ''

$expoArgs = @('--filter', 'mobile', 'start')
if ($Clear) { $expoArgs += '--clear' }

pnpm @expoArgs
