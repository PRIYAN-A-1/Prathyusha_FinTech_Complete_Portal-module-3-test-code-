$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot '.env'
if (!(Test-Path $envFile)) { throw 'Copy .env.example to .env and configure your database and internal key first.' }
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -ne 2 -or $parts[0] -notmatch '^[A-Z_][A-Z0-9_]*$') { throw 'Invalid .env entry.' }
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}
if (!$env:AUTH_INTERNAL_KEY -or $env:AUTH_INTERNAL_KEY.Length -lt 32 -or $env:AUTH_INTERNAL_KEY.StartsWith('REPLACE_')) { throw 'Generate and set AUTH_INTERNAL_KEY.' }
$jarPath = Join-Path $projectRoot 'auth/target/fintech-auth-1.0.0.jar'
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
$authProcess = Start-Process $javaCmd -ArgumentList @('-jar', ('"' + $jarPath + '"')) -WorkingDirectory $projectRoot -NoNewWindow -PassThru
try {
    Push-Location (Join-Path $projectRoot 'api')
    node src/server.js
} finally {
    Pop-Location
    if (!$authProcess.HasExited) { Stop-Process -Id $authProcess.Id }
}
