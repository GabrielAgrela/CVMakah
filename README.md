# CV Maker

CV Maker is a local browser tool that turns a pasted job advertisement into a tailored CV PDF. It uses the installed Codex CLI for the reasoning step when available, then renders a structured response through the project's LaTeX template.

The job advertisement, source data, and generated CV stay on this machine. No API key is required: the app starts `codex exec` as a subprocess, using your existing Codex login/configuration. The Codex invocation is ephemeral and read-only. Text pasted into the job-ad field is treated as untrusted data and is not allowed to become instructions for the agent.

The repository contains only fictional demo identity, contact details, employers, projects, and education. Replace the demo source and template values locally before using it for a real CV; do not commit personal source data or generated PDFs.

## Run it

Requirements:

- Python 3.10+
- `pdflatex`
- The `codex` CLI installed and authenticated if you want model-generated tailoring

From this directory:

```bash
python3 app.py
```

Open the URL printed by the app, for example `http://127.0.0.1:49152`.

By default the operating system chooses an unused localhost port and the app prints the exact URL to open. To use a fixed port instead, set it explicitly:

```bash
CVMAKER_PORT=8000 python3 app.py
```

If Codex is unavailable, the app uses a deterministic evidence-only draft so the PDF flow still works. To require Codex instead, run:

```bash
CVMAKER_REQUIRE_CODEX=1 python3 app.py
```

Optional environment variables:

- `CVMAKER_PORT=0` (default; `0` means choose an unused port)
- `CVMAKER_CODEX_MODEL=<model>`
- `CVMAKER_CODEX_TIMEOUT=180`
- `CVMAKER_CODEX_BIN=/path/to/codex`

## Customize it

- `data/Experience_Source_Data.md` is the fictional demo source of truth. Replace it locally with your own factual source.
- `data/cv-template-reference.tex` is the supplied reference template sent to Codex.
- `cv_template.tex` is the render template used for the final PDF. Keep the `@@...@@` placeholders when changing its layout.

The generated CV keeps the demo contact block, education, training, languages, and experience context from the template/source files. The model chooses the headline, summary, skills emphasis, experience bullets, selected publications, and selected training for each job ad.
The server is deliberately loopback-only: it binds to `127.0.0.1`, so other devices on the network cannot access it.

## Guardrails

The model prompt requires evidence-only tailoring and explicitly disallows invented metrics, employers, dates, tools, credentials, ownership, scale, or outcomes. The app also validates the response shape and escapes generated text before putting it into LaTeX. Read the PDF before sending it; human review is still the final check.
