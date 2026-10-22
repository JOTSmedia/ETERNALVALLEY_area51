# area51 — latest Eternal Valley test version

This is the complete website upload folder. Its opening view is the animated film tour, starting at the valley overview. The film is 2 minutes 10 seconds long, with 23 destinations and four connecting journeys. It starts muted so browsers can allow autoplay; if a browser blocks playback, the film stays open with a Play button.

The 4K and standard video options, photographic destinations, maps, optional 3D preview, plot browser, and memorial controls are included. Purchases remain the existing local demo; no live payment service is connected.

## Upload to GitHub

1. Upload the **contents of this folder** to the root of the repository you want to use for the latest test site. A repository named `area51` makes the version easy to identify. Keep `index.html` at the repository root.
2. Use GitHub Desktop or Git for the complete folder. If you use GitHub's browser upload instead, upload files in batches of 100 or fewer and preserve their folders.
3. Include the hidden `.nojekyll` file. No build step, package installation, API key, or Git LFS is required.
4. For GitHub Pages, open the repository's **Settings → Pages**, select **Deploy from a branch**, then choose the uploaded branch and **/(root)**. Save and use the URL GitHub provides after deployment.

You can also place the entire `area51` directory inside an existing published repository and visit its `/area51/` path. All application asset paths are relative. Keep the entire directory structure together.

GitHub's browser upload allows files up to 25 MiB and batches of up to 100 files; published GitHub Pages sites have a 1 GB size limit. This package is checked against those limits. Sources: [uploading files](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) and [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Preview locally

On macOS, double-click `Start-Eternal-Valley.command`. Leave its Terminal window open while viewing the website. Alternatively, run `python3 tools/serve-site.py 8000` from this folder, then open `http://127.0.0.1:8000/`. This server supports seeking in the film. Opening `index.html` directly through a `file://` URL does not support the application's modules.

## Included media

The player uses 26 five-second video chapters. All 4K chapters retain 3840 × 2160 resolution at 24 fps and are encoded for website delivery; standard chapters are 1920 × 1080. Photographic destinations remain 3840 × 2160. These are AI-generated, AI-upscaled visuals, with the same remaining continuity limitations as the source film.

Original generation footage, full-length downloadable films, internal review materials, and Git history are kept in the original `eternalvalley_v37` project outside this upload folder. No Runway credits were used to prepare this package.
