# Prathyusha FinTech — Full Stack Portal Runner (Root Launcher)
param(
    [switch]$KillExisting = $false
)

$targetDir = Join-Path $PSScriptRoot "Prathyusha_FinTech_Student_Portal"
if (-not (Test-Path $targetDir)) {
    $targetDir = $PSScriptRoot
}

$ports = @(5432, 8080, 4000, 5173)
$busy = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($busy) {
    if ($KillExisting) {
        Write-Host "Stopping existing processes on ports $($ports -join ', ')..." -ForegroundColor Yellow
        $pids = $busy.OwningProcess | Select-Object -Unique
        foreach ($p in $pids) {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    } else {
        Write-Host "Notice: Services are already running on ports: $(($busy.LocalPort | Select-Object -Unique) -join ', ')" -ForegroundColor Cyan
        Write-Host "To force restart all services, run: .\run-all.ps1 -KillExisting`n" -ForegroundColor Yellow
    }
}

Write-Host "Configuring Java environment..." -ForegroundColor Cyan
if (Test-Path "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot") {
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
    $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
}

$apiDir = Join-Path $targetDir "api"
$frontendDir = Join-Path $targetDir "frontend"

Write-Host "Starting Backend Services (PostgreSQL + Spring Auth + Express API)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$apiDir'; node src/standalone-runner.js"

Start-Sleep -Seconds 4

Write-Host "Starting React Frontend (Vite) on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

Write-Host "`nAll portal services launched!" -ForegroundColor Green
Write-Host "Web Portal:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "Default Logins:" -ForegroundColor Cyan
Write-Host "  - Student:     priyan@prathyusha.edu.in      / Student123!"
Write-Host "  - Coordinator: coordinator@prathyusha.edu.in / Admin123!"
Write-Host "  - Mentor:      mentor@prathyusha.edu.in      / Mentor123!`n"
