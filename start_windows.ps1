[CmdletBinding()]
param(
    [ValidateRange(0, 65535)]
    [int]$Port = 0,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path $PSScriptRoot).Path
$appPath = Join-Path $repoRoot "app.py"
$setupPath = Join-Path $repoRoot "setup_windows.ps1"

function Find-CommandPath {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command -Name $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) {
        return $null
    }
    if ($command.Path) {
        return $command.Path
    }
    if ($command.Source) {
        return $command.Source
    }
    return $command.Definition
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $segments = @(
        ($env:Path -split ";")
        ($machinePath -split ";")
        ($userPath -split ";")
    )
    $env:Path = ($segments | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique) -join ";"
}

if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw "Could not find app.py in $repoRoot."
}

Refresh-ProcessPath
$pythonPath = Find-CommandPath "python"
$pythonArguments = @("-u", $appPath)
if (-not $pythonPath) {
    $pythonPath = Find-CommandPath "py"
    $pythonArguments = @("-3", "-u", $appPath)
}

$pdflatexPath = Find-CommandPath "pdflatex"
if (-not $pythonPath -or -not $pdflatexPath) {
    if (-not (Test-Path -LiteralPath $setupPath -PathType Leaf)) {
        throw "The automatic setup script is missing: $setupPath"
    }

    Write-Host "A required dependency is missing. Running the automatic Windows setup now..." -ForegroundColor Cyan
    & $setupPath
    if ($LASTEXITCODE -ne 0) {
        throw "Automatic setup did not finish successfully (exit code $LASTEXITCODE)."
    }

    Refresh-ProcessPath
    $pythonPath = Find-CommandPath "python"
    $pythonArguments = @("-u", $appPath)
    if (-not $pythonPath) {
        $pythonPath = Find-CommandPath "py"
        $pythonArguments = @("-3", "-u", $appPath)
    }
    $pdflatexPath = Find-CommandPath "pdflatex"
}

if (-not $pythonPath) {
    throw "Python is not installed and could not be set up automatically."
}

if (-not $pdflatexPath) {
    throw "pdflatex is not installed and could not be set up automatically."
}

$env:CVMAKER_PORT = [string]$Port
$env:CVMAKER_OPEN_BROWSER = if ($NoBrowser) { "0" } else { "1" }

Push-Location $repoRoot
try {
    & $pythonPath @pythonArguments
    if ($LASTEXITCODE -ne 0) {
        throw "The CV Maker server exited with code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
