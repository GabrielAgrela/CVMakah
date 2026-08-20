# CV Maker

CV Maker is a local browser tool that turns a pasted job advertisement into a tailored CV PDF. It uses the installed Codex CLI for the reasoning step when available, then renders a structured response through the project's LaTeX template.

The job advertisement, source data, and generated CV stay on this machine. No API key is required: the app starts `codex exec` as a subprocess, using your existing Codex login/configuration. The Codex subprocess runs with a read-only sandbox. Text pasted into the job-ad field is treated as untrusted data and is not allowed to become instructions for the agent.

The repository contains only fictional demo identity, contact details, employers, projects, and education. Replace the demo source and template values locally before using it for a real CV; do not commit personal source data or generated PDFs.

## Windows quick start

From File Explorer, double-click `setup_windows.cmd` once. It uses `winget` to install missing Python, MiKTeX (`pdflatex`), and Node.js/npm, updates or installs the Codex CLI, and configures MiKTeX to install missing LaTeX packages automatically. This keeps the first PDF export from stopping at a package-install dialog. If `winget` is unavailable, it prints the manual download links.

Then double-click `start_windows.cmd`. It checks the required tools, automatically runs the setup if Python or `pdflatex` is missing, starts the local server, and opens the app in your default browser. You can also run both scripts from PowerShell:

```powershell
.\setup_windows.ps1
.\start_windows.ps1
```

The setup is safe to run again; already-installed tools are skipped. Codex login is intentionally not automated. If you want model-generated tailoring, run `codex login` once after setup. The app still has an evidence-only fallback when Codex is unavailable.

Useful options:

```powershell
.\setup_windows.ps1 -CheckOnly
.\start_windows.ps1 -Port 8000
.\start_windows.ps1 -NoBrowser
```

The **Source of truth** editor in the app lets you update `Experience_Source_Data.md`, `cv-template-reference.tex`, and `cv_template.tex`. Use **Save changes** (or `Ctrl+S`) to write edits back to the project; they persist across restarts and are used by later generations. Only these three allow-listed files are exposed to the local editor.

## Run it

Requirements:

- Python 3.10+
- `pdflatex` (install MiKTeX or TeX Live on Windows)
- The `codex` CLI installed and authenticated if you want model-generated tailoring

From this directory on macOS/Linux:

```bash
python3 app.py
```

On Windows, use PowerShell (or `python app.py` from Command Prompt):

```powershell
python .\app.py
```

The app resolves Windows executable extensions and npm's `codex.cmd`/`codex.ps1`
shims automatically. The Windows launcher refreshes `PATH` after setup so a new
terminal is not required before using the installed tools.

Open the URL printed by the app, for example `http://127.0.0.1:49152`.

By default the operating system chooses an unused localhost port and the app prints the exact URL to open. To use a fixed port instead, set it explicitly:

```bash
CVMAKER_PORT=8000 python3 app.py
```

PowerShell:

```powershell
$env:CVMAKER_PORT = "8000"
python .\app.py
```

Command Prompt:

```bat
set CVMAKER_PORT=8000
python app.py
```

If Codex is unavailable, the app uses a deterministic evidence-only draft so the PDF flow still works. To require Codex instead, run:

```bash
CVMAKER_REQUIRE_CODEX=1 python3 app.py
```

PowerShell:

```powershell
$env:CVMAKER_REQUIRE_CODEX = "1"
python .\app.py
```

Optional environment variables:

- `CVMAKER_PORT=0` (default; `0` means choose an unused port)
- `CVMAKER_CODEX_MODEL=<model>`
- `CVMAKER_CODEX_TIMEOUT=180`
- `CVMAKER_CODEX_BIN=/path/to/codex` (PowerShell example: `C:\Users\you\AppData\Roaming\npm\codex.cmd`)

To check the Windows tools available on `PATH`:

```powershell
Get-Command python
Get-Command pdflatex
Get-Command codex
```

## Customize it

- `data/Experience_Source_Data.md` is the fictional demo source of truth. Replace it locally with your own factual source.
- `data/cv-template-reference.tex` is the supplied reference template sent to Codex.
- `cv_template.tex` is the render template used for the final PDF. Keep the `@@...@@` placeholders when changing its layout.

The generated CV keeps the demo contact block, education, training, languages, and experience context from the template/source files. The model chooses the headline, summary, skills emphasis, experience bullets, selected publications, and selected training for each job ad.
The server is deliberately loopback-only: it binds to `127.0.0.1`, so other devices on the network cannot access it.

## Guardrails

The model prompt requires evidence-only tailoring and explicitly disallows invented metrics, employers, dates, tools, credentials, ownership, scale, or outcomes. The app also validates the response shape and escapes generated text before putting it into LaTeX. Read the PDF before sending it; human review is still the final check.
