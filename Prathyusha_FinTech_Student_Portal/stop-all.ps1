# Stop all services running on ports 5432, 8080, 4000, 5173
$ports = @(5432, 8080, 4000, 5173)
$conns = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($conns) {
    $pids = $conns.OwningProcess | Select-Object -Unique
    foreach ($p in $pids) {
        Write-Host "Stopping process PID $p on ports..." -ForegroundColor Yellow
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
    Write-Host "All portal ports (5432, 8080, 4000, 5173) have been freed." -ForegroundColor Green
} else {
    Write-Host "No portal processes currently running on ports 5432, 8080, 4000, 5173." -ForegroundColor Cyan
}
