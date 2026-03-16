<#
.\run-all.ps1 - start the full stack for testers using Docker Compose (PowerShell)
Usage: Open PowerShell as needed and run:
  .\run-all.ps1

#>
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Determine web directory containing docker-compose.yaml
if (Test-Path (Join-Path $ScriptDir 'docker-compose.yaml')) {
    $WebDir = $ScriptDir
} elseif (Test-Path (Join-Path $ScriptDir 'web\docker-compose.yaml')) {
    $WebDir = Join-Path $ScriptDir 'web'
} elseif (Test-Path (Join-Path (Split-Path $ScriptDir -Parent) 'web\docker-compose.yaml')) {
    $WebDir = Join-Path (Split-Path $ScriptDir -Parent) 'web'
} else {
    $WebDir = Join-Path $ScriptDir 'web'
}

Write-Host "[run-all] Starting services from $WebDir using Docker Compose"
Push-Location $WebDir
try {
    if (Get-Command 'docker' -ErrorAction SilentlyContinue) {
        # Prefer `docker compose`
        $composeOk = $false
        try {
            docker compose version | Out-Null
            $composeOk = $true
        } catch {
            $composeOk = $false
        }

        if ($composeOk) {
            docker compose up --build --remove-orphans
        } else {
            if (Get-Command 'docker-compose' -ErrorAction SilentlyContinue) {
                docker-compose up --build --remove-orphans
            } else {
                throw "Neither 'docker compose' nor 'docker-compose' are available"
            }
        }
    } else {
        throw "Docker is not installed or not on PATH"
    }
} finally {
    Pop-Location
}
