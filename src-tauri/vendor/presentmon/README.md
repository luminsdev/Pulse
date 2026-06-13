# PresentMon Vendor Artifacts

Pulse can ship the PresentMon console executable so users do not need to install Intel PresentMon separately.

Expected files for a bundled release:

- `PresentMon-2.4.1-x64.exe` - the official x64 PresentMon console executable from `GameTechDev/PresentMon` release `v2.4.1`.
- `LICENSE-PresentMon.txt` - the MIT license text from the same PresentMon release.

Approved artifact:

- Source URL: `https://github.com/GameTechDev/PresentMon/releases/download/v2.4.1/PresentMon-2.4.1-x64.exe`
- SHA-256: `D74183E7AE630F72CD3690BE0373ECBFDC6CBB86578148AAB8FA2A7166068F34`

Rules:

- Use only an official PresentMon release artifact or a reproducible build from the official source.
- Keep the license file next to the binary.
- Do not rename the source artifact in this directory; build scripts copy it to `presentmon-x86_64-pc-windows-msvc.exe` for Tauri.
- If these files are absent, Pulse still falls back to a locally installed Intel PresentMon.
