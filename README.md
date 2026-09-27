# DP-Archives

The digital headquarters — one central hub listing every website, tool and experiment,
with a searchable project ecosystem and a details page per project.

**Live site:** https://dp-archives.vercel.app _(replace with your final URL)_

Zero build step. Zero dependencies. Plain HTML + Tailwind (CDN) + vanilla JS,
so Vercel serves this repository exactly as it is.

---

## Files

| File | Purpose | Edit it? |
| --- | --- | --- |
| `index.html` | Homepage (hero, project ecosystem, about, footer) | Only for layout/text tweaks |
| `project.html` | Details page template (`/project?p=slug`) | No — rendered by `app.js` |
| `projects.js` | ★ **Your data** — every project lives here | **Yes, this is the main file** |
| `site-config.js` | Site text: tagline, about, copyright, status label, feedback URL | Yes |
| `app.js` | Renders cards + details pages, search/filter logic | No |
| `admin.html` / `admin.js` | Point-and-click admin panel (password gated) | Only to change the password hash |
| `logo.png` | Logo, shown on a white rounded tile | Replace the file to rebrand |
| `404.html` | Branded "page not found" page | No |
| `vercel.json` | Pretty URLs (`/project?p=aegis`) + security headers | No |

## Local preview

```powershell
cd D:\Devang\Github\DP-Archives\DP-Archives
python -m http.server 8080
# open http://localhost:8080        (admin panel: http://localhost:8080/admin.html)
```

`npx serve .` works too. Don't rely on double-clicking `index.html` for link tests —
`file://` URLs behave differently from a real server.

## Deploy (once)

1. Push this repo to GitHub (`main` branch).
2. Vercel → **Add New… → Project → Import** this repository.
   * Framework Preset: **Other**
   * Root Directory: **leave as `./` (default)** — the site is at the repo root
   * Build Command / Output Directory: **leave empty**
3. **Deploy.** ~30 seconds later you get `https://<project>.vercel.app`.

Every future `git push` to `main` auto-redeploys.

## Every update after that

```powershell
cd D:\Devang\Github\DP-Archives\DP-Archives
git add .
git commit -m "Add project X"
git push
```

## Admin panel

Open `<your-url>/admin.html` (e.g. `https://dp-archives.vercel.app/admin.html`),
enter the password, manage projects/settings, then click **⬇ Download files** and
replace `projects.js` + `site-config.js` here before pushing. The panel is not linked
from the public site and `admin.html` is marked `noindex`.

> Security note: this is a client-side gate on a static site. Keep it unlisted and
> change the password (see `admin.js` → `ADMIN_PASSWORD_HASH`).

## Do not commit

`DP-Archives-Tutorial.txt`, the `Prompt Part *.txt` briefs and the unused
`dp-archives-website/` Next.js scaffold live in the **parent** folder, not here —
the tutorial contains the admin password, and anything in this repo is publicly
accessible once deployed.
