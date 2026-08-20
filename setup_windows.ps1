[CmdletBinding()]
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path $PSScriptRoot).Path

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
    # Installers update the user/machine PATH, but the current PowerShell
    # process keeps its old copy. Merge the updated values without dropping
    # paths supplied by the Codex desktop runtime or the calling shell.
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $segments = @(
        ($env:Path -split ";")
        ($machinePath -split ";")
        ($userPath -split ";")
    )
    $env:Path = ($segments | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique) -join ";"
}

function Install-WithWinget {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $winget = Find-CommandPath "winget"
    if (-not $winget) {
        Write-Warning "winget is not available; install $Label manually."
        return $false
    }

    Write-Host "Installing $Label ($Id)..." -ForegroundColor Cyan
    & $winget install --id $Id --exact --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "winget could not install $Label (exit code $LASTEXITCODE)."
        return $false
    }
    Refresh-ProcessPath
    return $true
}

function Show-ToolStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$CommandName,
        [Parameter(Mandatory = $true)][bool]$Required
    )

    $path = Find-CommandPath $CommandName
    if ($path) {
        Write-Host ("[OK]   {0}: {1}" -f $Label, $path) -ForegroundColor Green
        return $true
    }

    $suffix = if ($Required) { " (required)" } else { " (optional; fallback mode still works)" }
    Write-Host ("[MISS] {0}{1}" -f $Label, $suffix) -ForegroundColor Yellow
    return $false
}

function Configure-MikTeX {
    # MiKTeX otherwise opens a first-run dialog whenever the template uses a
    # package that is not installed yet. Configure the user installation to
    # download those packages automatically during pdflatex runs.
    $initexmf = Find-CommandPath "initexmf"
    if (-not $initexmf) {
        Write-Warning "MiKTeX is installed, but initexmf was not found; automatic package installation could not be configured."
        return $false
    }

    Write-Host "Configuring MiKTeX to install missing packages automatically..." -ForegroundColor Cyan
    & $initexmf "--set-config-value=[MPM]AutoInstall=t"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "MiKTeX automatic package installation could not be enabled (exit code $LASTEXITCODE)."
        return $false
    }

    Write-Host "[OK]   MiKTeX missing packages will be installed automatically." -ForegroundColor Green
    return $true
}

Refresh-ProcessPath

Write-Host "CV Maker Windows setup" -ForegroundColor Cyan
Write-Host "Project: $repoRoot"
Write-Host ""

$pythonPath = Find-CommandPath "python"
if (-not $pythonPath) {
    $pythonPath = Find-CommandPath "py"
}
$pdflatexPath = Find-CommandPath "pdflatex"
$npmPath = Find-CommandPath "npm.cmd"
if (-not $npmPath) {
    $npmPath = Find-CommandPath "npm"
}
$codexPath = Find-CommandPath "codex"

if ($CheckOnly) {
    $pythonReady = Show-ToolStatus "Python" "python" $true
    if (-not $pythonReady) {
        $pythonReady = Show-ToolStatus "Python launcher" "py" $true
    }
    $pdflatexReady = Show-ToolStatus "pdflatex" "pdflatex" $true
    [void](Show-ToolStatus "Node/npm" "npm" $false)
    [void](Show-ToolStatus "Codex CLI" "codex" $false)
    if (-not $pythonReady -or -not $pdflatexReady) {
        exit 1
    }
    exit 0
}

if (-not $pythonPath) {
    [void](Install-WithWinget "Python.Python.3.13" "Python 3.13")
    Refresh-ProcessPath
    $pythonPath = Find-CommandPath "python"
    if (-not $pythonPath) {
        $pythonPath = Find-CommandPath "py"
    }
}

if (-not (Find-CommandPath "pdflatex")) {
    [void](Install-WithWinget "MiKTeX.MiKTeX" "MiKTeX (pdflatex)")
    Refresh-ProcessPath
}

if (Find-CommandPath "pdflatex") {
    [void](Configure-MikTeX)
}

if (-not $npmPath) {
    [void](Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS (npm)")
    Refresh-ProcessPath
    $npmPath = Find-CommandPath "npm.cmd"
    if (-not $npmPath) {
        $npmPath = Find-CommandPath "npm"
    }
}

$codexPath = Find-CommandPath "codex"
if ($npmPath) {
    if ($codexPath) {
        Write-Host "Updating the Codex CLI with npm..." -ForegroundColor Cyan
    }
    else {
        Write-Host "Installing the Codex CLI with npm..." -ForegroundColor Cyan
    }

    # Keep the CLI current: older releases can reject the model/configuration
    # used by the desktop environment even though a codex command is present.
    & $npmPath install --global "@openai/codex@latest"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "The Codex CLI install/update failed (exit code $LASTEXITCODE)."
    }
    Refresh-ProcessPath
}

Write-Host ""
Write-Host "Final dependency check" -ForegroundColor Cyan
$pythonReady = Show-ToolStatus "Python" "python" $true
if (-not $pythonReady) {
    $pythonReady = Show-ToolStatus "Python launcher" "py" $true
}
$pdflatexReady = Show-ToolStatus "pdflatex" "pdflatex" $true
[void](Show-ToolStatus "Node/npm" "npm" $false)
[void](Show-ToolStatus "Codex CLI" "codex" $false)

if (-not $pythonReady -or -not $pdflatexReady) {
    Write-Host ""
    Write-Warning "Setup is incomplete. Install the missing required tools, then run this script again."
    Write-Host "Python:   https://www.python.org/downloads/windows/"
    Write-Host "MiKTeX:   https://miktex.org/download"
    exit 1
}

Write-Host ""
Write-Host "Setup complete. Start the app with .\start_windows.cmd" -ForegroundColor Green
Write-Host "Codex authentication is optional; run 'codex login' if you want model-generated tailoring."
