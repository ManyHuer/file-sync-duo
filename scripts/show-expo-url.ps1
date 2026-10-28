#Requires -Version 5.1
<#
.SYNOPSIS
    Muestra la URL exp:// del servidor de Expo que está corriendo.

.DESCRIPTION
    Consulta el manifest local de Metro y extrae hostUri. Sirve tanto para
    LAN como para túnel: imprime la URL que debe abrirse en Expo Go.

.PARAMETER Port
    Puerto local de Metro. Por defecto 8081.

.EXAMPLE
    .\scripts\show-expo-url.ps1
#>
[CmdletBinding()]
param(
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'

$headers = @{
    'expo-platform' = 'android'
    'accept'        = 'application/expo+json,application/json'
}

try {
    $manifest = Invoke-RestMethod -Uri "http://127.0.0.1:$Port" -Headers $headers -TimeoutSec 10
} catch {
    throw "No se pudo leer el manifest en el puerto $Port. ¿Está corriendo Expo? $($_.Exception.Message)"
}

$hostUri = $manifest.extra.expoClient.hostUri

if (-not $hostUri) {
    throw 'El manifest no incluye hostUri. Revisa que Expo esté sirviendo el proyecto.'
}

Write-Host "exp://$hostUri"
