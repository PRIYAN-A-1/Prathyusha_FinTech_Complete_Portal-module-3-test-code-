# Prathyusha FinTech — Full Stack Portal Runner
param(
    [switch]$KillExisting = $false
)

$ports = @(5432, 8080, 4000, 5173)
$busy = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($busy -and $KillExisting) {
    Write-Host "Stopping existing processes on ports $($ports -join ', ')..." -ForegroundColor Yellow
    foreach ($conn in $busy) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host "Configuring Java environment..." -ForegroundColor Cyan
if (Test-Path "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot") {
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
    $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
}

Write-Host "Starting Backend Services (PostgreSQL + Spring Auth + Express API)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\api'; node src/standalone-runner.js"

Start-Sleep -Seconds 3

Write-Host "Starting React Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`nAll services have been launched in separate terminal windows!" -ForegroundColor Cyan
Write-Host "Open your browser at: http://localhost:5173`n" -ForegroundColor Yellow
