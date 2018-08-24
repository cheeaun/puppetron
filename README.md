# <img src="assets/logo.png" width="400" alt="Puppetron">

> [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Headless Chrome Node API)-based rendering solution.

Videos & Tweets:

- Demo <https://www.youtube.com/watch?v=n4sRp3qe_1Y>
- `clipSelector` demo <https://www.youtube.com/watch?v=wYCrJu-Wy2E>
- CJK fonts support <https://twitter.com/cheeaun/status/902340897433501696>
- Emoji support <https://twitter.com/cheeaun/status/903492052452728832>

**⚠️⚠️⚠️ NOTE:** Starting version 2.0, CJK and emoji support is gone.

🚧🚧🚧 PLEASE READ THIS 🚧🚧🚧
---

**Do NOT use this for production use-cases.**

This is just a demo site of what cool things that `Puppeteer` can do. Under any circumstances, this site may be down any time or be heavily rate-limited to prevent abuse.

Please check out what [Puppeteer](https://github.com/GoogleChrome/puppeteer) can do for your own use case and host on your own servers.

API
---

The API can perform 3 actions:

- [Screenshot](#screenshot) - take a screenshot of the web page
- [Render](#render) - render and serialize a HTML copy of the web page
- [PDF](#pdf) - generate a PDF of the web page

**`URL`** - the URL with encoded `pathname`, `search` and `hash`.

Global parameters:

- `width` - width of viewport/screenshot (default: `1024`)
- `height` - height of viewport/screenshot (default: `768`)

### Screenshot

```
/screenshot/{URL}
...or
/{URL}
```

Parameters:

- `thumbWidth` - width of thumbnail, respecting aspect ratio (no default, has to be smaller than `width`)
- `fullPage` - takes a screenshot of the full scrollable page (default: `false`). If the page is too long, it may time out.
- `clipSelector` - CSS selector of element to be clipped (no default). E.g.: `.weather-forecast`.

### Render

```
/render/{URL}
```

Notes:

- `script` tags except `JSON-LD` will be removed
- `link[rel=import]` tags will be removed
- HTML comments will be removed
- `base` tag will be added for loading relative resources
- Elements with absolute paths like `src="/xxx"` or `href="/xxx"` will be prepended with the origin URL.

Parameters: *None*

### PDF

```
/pdf/{URL}
```

Parameters:

- `format`: Paper format that [Puppeteer supports](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions). E.g.: `Letter`, `Legal`, `A4`, etc. (default: `Letter`)
- `pageRanges`: Paper ranges to print. E.g., `1-5`, `8`, `11-13` (default all pages)

Development
---

### Requirements

- Node.js
- Docker

For local Chromium install:

1. `npm install`
2. `npm start`
3. Load `localhost:3000`

For Docker-based install:

1. `docker build . -t puppet`
2. `docker run -p 8080:3000 puppet`
3. Load `localhost:8080`

[![Deploy to now](https://deploy.now.sh/static/button.svg)](https://deploy.now.sh/?repo=https://github.com/cheeaun/puppetron)

Credits
---

Block list from [Prerender](https://github.com/prerender/prerender/blob/master/lib/resources/blocked-resources.json).

For version 1.0, this uses [`cheeaun/puppeteer`](https://hub.docker.com/r/cheeaun/puppeteer/) Docker image.

For version 2.0, this uses some parts from [Zeit's now-examples: misc-screenshot](https://github.com/zeit/now-examples/blob/master/misc-screenshot/Dockerfile).

Inspired by [`zenato/puppeteer`]((https://hub.docker.com/r/zenato/puppeteer/)), [`puppeteer-renderer`](https://github.com/zenato/puppeteer-renderer) and [Rendertron](https://render-tron.appspot.com/).
