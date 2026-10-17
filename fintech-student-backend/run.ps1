# run.ps1 - Single-command runner for Prathyusha Student Module Backend
$ErrorActionPreference = 'Stop'

# Locate fintech-student-backend directory
if (Test-Path "$PSScriptRoot\fintech-student-backend") {
    $projectRoot = "$PSScriptRoot\fintech-student-backend"
} else {
    $projectRoot = $PSScriptRoot
}

Set-Location $projectRoot
Write-Host "==> Working Directory: $projectRoot" -ForegroundColor Cyan

# 1. Verify or create .env
$envFile = Join-Path $projectRoot '.env'
if (!(Test-Path $envFile)) {
    Write-Host "==> Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $projectRoot '.env.example') $envFile
    $key = [System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N')
    (Get-Content $envFile) `
        -replace 'CHANGE_ME', 'fintech123' `
        -replace 'REPLACE_WITH_RANDOM_64_HEX_CHARACTERS', $key |
        Set-Content $envFile
}

# Load .env into process environment
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -eq 2 -and $parts[0] -match '^[A-Z_][A-Z0-9_]*$') {
            [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
        }
    }
}

# 2. Locate Java 17+
$javaCmd = 'java'
$javaVer = & java -version 2>&1 | Out-String
if ($javaVer -match '1\.[0-8]\.' -or $LASTEXITCODE -ne 0) {
    $candidates = @(
        "$env:JAVA_HOME\bin\java.exe",
        "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin\java.exe",
        "C:\Program Files\Java\jdk-21*\bin\java.exe",
        "C:\Program Files\Java\jdk-17*\bin\java.exe",
        "C:\Program Files\Eclipse Adoptium\jdk-17*\bin\java.exe",
        "C:\Program Files\Eclipse Adoptium\jdk-21*\bin\java.exe"
    )
    foreach ($cand in $candidates) {
        $resolved = Resolve-Path $cand -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1
        if ($resolved -and (Test-Path $resolved)) {
            $javaCmd = $resolved
            break
        }
    }
}
Write-Host "==> Using Java: $javaCmd" -ForegroundColor Green

# 3. Locate psql
$psqlCmd = 'psql'
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    $psqlCandidates = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($cand in $psqlCandidates) {
        if (Test-Path $cand) {
            $psqlCmd = $cand
            break
        }
    }
}

# 4. Check if Database & Tables exist
$dbExists = $false
try {
    $env:PGPASSWORD = $env:SPRING_DATASOURCE_PASSWORD
    $testResult = & $psqlCmd -U $env:SPRING_DATASOURCE_USERNAME -d fintech -h localhost -p 5432 -w -c "SELECT count(*) FROM users;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dbExists = $true
        Write-Host "==> PostgreSQL connection and schema verified!" -ForegroundColor Green
    }
} catch {
    $dbExists = $false
}

if (!$dbExists) {
    Write-Host "`n[!] PostgreSQL 'fintech' database or user is not configured yet." -ForegroundColor Yellow
    Write-Host "    Please enter your PostgreSQL superuser ('postgres') password to configure it automatically:" -ForegroundColor Yellow
    $pgPass = Read-Host -Prompt "PostgreSQL 'postgres' password"
    
    $env:PGPASSWORD = $pgPass
    Write-Host "==> Creating role 'fintech' and database 'fintech'..." -ForegroundColor Cyan
    & $psqlCmd -U postgres -h localhost -p 5432 -c "CREATE ROLE fintech LOGIN PASSWORD '$($env:SPRING_DATASOURCE_PASSWORD)';" 2>$null
    & $psqlCmd -U postgres -h localhost -p 5432 -c "CREATE DATABASE fintech OWNER fintech;" 2>$null
    
    Write-Host "==> Applying database schema (db/001_schema.sql)..." -ForegroundColor Cyan
    $env:PGPASSWORD = $env:SPRING_DATASOURCE_PASSWORD
    & $psqlCmd -U fintech -d fintech -h localhost -p 5432 -f "$projectRoot\db\001_schema.sql"
    
    Write-Host "==> Provisioning default student account..." -ForegroundColor Cyan
    $env:PROVISION_EMAIL = 'student@prathyusha.edu.in'
    $env:PROVISION_REGISTER = 'PEC-IT-001'
    $env:PROVISION_NAME = 'Student Name'
    $env:PROVISION_ROLE = 'STUDENT'
    $env:PROVISION_PASSWORD = 'StudentPassword123!'
    & $javaCmd -jar "$projectRoot\auth\target\fintech-auth-1.0.0.jar" --spring.profiles.active=provision
}

# 5. Start Backend & Frontend Services
Write-Host "`n==> Starting Auth Service on port 8080..." -ForegroundColor Cyan
$jarPath = Join-Path $projectRoot 'auth/target/fintech-auth-1.0.0.jar'
$authProcess = Start-Process $javaCmd -ArgumentList @('-jar', ('"' + $jarPath + '"')) -WorkingDirectory $projectRoot -NoNewWindow -PassThru

$frontendPath = Join-Path $projectRoot 'frontend'
$frontendProcess = $null
if (Test-Path $frontendPath) {
    Write-Host "==> Starting React Frontend on http://localhost:5173..." -ForegroundColor Cyan
    $frontendProcess = Start-Process npm -ArgumentList @('run', 'dev') -WorkingDirectory $frontendPath -PassThru
}

try {
    Write-Host "==> Starting Student API on port 3001..." -ForegroundColor Cyan
    Write-Host "`n===============================================" -ForegroundColor Green
    Write-Host "  FinTech Portal Web App: http://localhost:5173" -ForegroundColor Yellow
    Write-Host "  Student API:            http://localhost:3001" -ForegroundColor Yellow
    Write-Host "  Auth Service:           http://localhost:8080" -ForegroundColor Yellow
    Write-Host "===============================================`n" -ForegroundColor Green
    Push-Location (Join-Path $projectRoot 'api')
    node src/server.js
} finally {
    Pop-Location
    if ($authProcess -and !$authProcess.HasExited) {
        Write-Host "==> Stopping Auth Service..." -ForegroundColor Yellow
        Stop-Process -Id $authProcess.Id -Force
    }
    if ($frontendProcess -and !$frontendProcess.HasExited) {
        Write-Host "==> Stopping Frontend..." -ForegroundColor Yellow
        Stop-Process -Id $frontendProcess.Id -Force
    }
}
