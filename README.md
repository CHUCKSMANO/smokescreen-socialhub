# SmokeScreen SocialHub

An independent, open-source browser edition of the SmokeScreen camera identity idea, combined with the SocialHub app hub. It is a plain HTML/CSS/ES-module project: no build step, no account, no analytics, no upload path.

Inspired by [smokescreenapp.com](https://smokescreenapp.com/). Not affiliated with or endorsed by that site.

## License

[MIT](LICENSE)

## Run locally

```bash
cd /Users/allthingschucks/Projects/SmokeScreen-SocialHub
python3 -m http.server 4173
```

Open <http://127.0.0.1:4173> in Chrome and allow camera access when prompted. `localhost` is a secure context, so `getUserMedia` works without HTTPS.

## What is included

### Live Identity studio

Ten identity modes ported from the native SocialHub SmokeScreen pipeline: Passthrough, Face blur, Pixelate, Hide me, Hide background, Noir, Comic, Warm film, Vivid, and Face map. Quality presets run at 15, 24, or 30 fps. The preview can be mirrored, recorded to WebM, or captured as a PNG snapshot.

Face-dependent modes in this browser build use a draggable, resizable face-area guide. The native macOS build uses on-device Vision face tracking; the browser build labels the manual approximation honestly and does not pretend a model is running. Face map composites a user-supplied reference image.

Every frame is drawn locally from `getUserMedia` into a `<canvas>`. There is no server, no network request, and no telemetry.

### SocialHub

The five pinned services from the SocialHub catalog: WhatsApp, Instagram, Signal, Google Chat, and Facebook. Cards open each service, with `⌘1`–`⌘5` / `Ctrl+1`–`Ctrl+5` shortcuts matching the native app. Signal links to the official desktop download rather than a web client, preserving the upstream security position.

## Repository layout

```text
index.html   page structure, consent gate, studio, hub, open-source notes
styles.css   all visual styling
app.js       camera pipeline, identity modes, shortcuts, capture
LICENSE      MIT
```

## Privacy and scope

- Camera frames never leave the browser tab.
- No third-party scripts, fonts, analytics, or build dependencies.
- No virtual camera is installed. Browser output is a canvas preview, recording, or snapshot.
- The face-area guide is manual; no face recognition or identification is performed.

## Publishing

The folder is ready to publish as-is: it contains no secrets, `.env` files, credentials, or generated artifacts. Add a remote and push when you want it public:

```bash
git init
git add .
git commit -m "Open-source SmokeScreen SocialHub browser edition"
git remote add origin <your-repo-url>
git push -u origin main
```
