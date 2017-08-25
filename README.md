<img src="logo.png" width="400" alt="Puppetron">
===


> [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Headless Chrome Node API)-based rendering solution.

Requirements
---

- Node.js
- Docker

Development
---

For local Chromium install:

1. `npm install`
2. `npm start`
3. Load `localhost:3000`

For Docker-based install:

1. `docker build . -t puppet`
2. `docker run -p 8080:3000 puppet`
3. Load `localhost:8080`

To screenshot a URL, append the URL, e.g. `localhost:8080/http://google.com`.

Credits
---

Block list from [Prerender](https://github.com/prerender/prerender/blob/master/lib/resources/blocked-resources.json).

This uses [`zenato/puppeteer`](https://hub.docker.com/r/zenato/puppeteer/) Docker image. Inspired by [`puppeteer-renderer`](https://github.com/zenato/puppeteer-renderer).
