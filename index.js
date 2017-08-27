const fs = require('fs');
const http = require('http');
const { URL } = require('url');
const { DEBUG } = process.env;

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const pTimeout = require('p-timeout');
const LRU = require('lru-cache');
const cache = LRU({
  max: process.env.CACHE_SIZE || Infinity,
  maxAge: 1000 * 60, // 1 minute
  noDisposeOnSet: true,
  dispose: (url, page) => {
    console.log('🗑 Disposing ' + url);
    if (page && page.close) page.close();
  }
});
setInterval(() => cache.prune(), 1000 * 60); // Prune every minute

const blocked = require('./blocked.json');
const blockedRegExp = new RegExp('(' + blocked.join('|') + ')', 'i');

const truncate = (str, len) => str.length > len ? str.slice(0, len) + '…' : str;

let browser;

require('http').createServer(async (req, res) => {
  if (req.url == '/'){
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public,max-age=31536000',
    });
    res.end(fs.readFileSync('index.html'));
    return;
  }

  if (req.url == '/favicon.ico'){
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url == '/status'){
    res.writeHead(200, {
      'content-type': 'application/json',
    });
    res.end(JSON.stringify({
      pages: cache.keys(),
      process: {
        versions: process.versions,
        memoryUsage: process.memoryUsage(),
      },
    }, null, '\t'));
    return;
  }

  const [_, action, url] = req.url.match(/^\/(screenshot|render|pdf)?\/?(.*)/i) || ['', '', ''];

  if (!url){
    res.writeHead(400, {
      'content-type': 'text/plain',
    });
    res.end('Something is wrong. Missing URL.');
    return;
  }

  if (cache.itemCount > 20){
    res.writeHead(420, {
      'content-type': 'text/plain',
    });
    res.end(`There are ${cache.itemCount} pages in the current instance now. Please try again in few minutes.`);
    return;
  }

  let page, pageURL;
  try {
    const u = new URL(url);
    pageURL = u.origin + decodeURIComponent(u.pathname);
    const { searchParams } = u;
    let actionDone = false;

    page = cache.get(pageURL);
    if (!page) {
      if (!browser) {
        console.log('🚀 Launch browser!');
        browser = await puppeteer.launch(DEBUG ? {
          headless: false,
          ignoreHTTPSErrors: true,
          args: [
            '--no-sandbox',
            '--auto-open-devtools-for-tabs'
          ],
        } : {
          ignoreHTTPSErrors: true,
          args: [
            '--no-sandbox'
          ],
        });
      }
      page = await browser.newPage();

      const nowTime = +new Date();
      let reqCount = 0;
      await page.setRequestInterceptionEnabled(true);
      page.on('request', (request) => {
        const { url, method } = request;

        // Skip data URIs
        if (/^data:/i.test(url)){
          request.continue();
          return;
        }

        const seconds = (+new Date() - nowTime) / 1000;
        const shortURL = truncate(url, 70);
        // Abort requests that exceeds 15 seconds
        // Also abort if more than 100 requests
        if (seconds > 15 || reqCount > 100 || actionDone){
          console.log(`❌⏳ ${method} ${shortURL}`);
          request.abort();
        } else if (blockedRegExp.test(url)){
          console.log(`❌ ${method} ${shortURL}`);
          request.abort();
        } else {
          console.log(`✅ ${method} ${shortURL}`);
          request.continue();
          reqCount++;
        }
      });

      console.log('⬇️ Fetching ' + pageURL);
      await page.goto(pageURL, {
        waitUntil: 'networkidle',
      });
    }

    console.log('💥 Perform action: ' + action);

    switch (action){
      case 'render': {
        if (!cache.has(pageURL)){
          await page.evaluate(() => {
            // Remove scripts except JSON-LD
            const scripts = document.querySelectorAll('script:not([type="application/ld+json"])');
            scripts.forEach(s => s.parentNode.removeChild(s));

            // Remove import tags
            const imports = document.querySelectorAll('link[rel=import]');
            imports.forEach(i => i.parentNode.removeChild(i));

            const { origin, pathname } = location;
            // Inject <base> for loading relative resources
            if (!document.querySelector('base')){
              const base = document.createElement('base');
              base.href = origin + pathname;
              document.head.appendChild(base);
            }

            // Try to fix absolute paths
            const absEls = document.querySelectorAll('link[href^="/"], script[src^="/"], img[src^="/"]');
            absEls.forEach(el => {
              const href = el.getAttribute('href');
              const src = el.getAttribute('src');
              if (src && /^\/[^/]/i.test(src)){
                el.src = origin + src;
              } else if (href && /^\/[^/]/i.test(href)){
                el.href = origin + href;
              }
            });
          });
        }

        let content = await pTimeout(page.content(), 10 * 1000, 'Render timed out');

        if (!cache.has(pageURL)){
          // Remove comments
          content = content.replace(/<!--[\s\S]*?-->/g, '');
        }

        res.writeHead(200, {
          'content-type': 'text/html; charset=UTF-8',
          'cache-control': 'public,max-age=31536000',
        });
        res.end(content);
        break;
      }
      case 'pdf': {
        const format = searchParams.get('format') || null;
        const pageRanges = searchParams.get('pageRanges') || null;

        const pdf = await pTimeout(page.pdf({
          format,
          pageRanges,
        }), 10 * 1000, 'PDF timed out');

        res.writeHead(200, {
          'content-type': 'application/pdf',
          'cache-control': 'public,max-age=31536000',
        });
        res.end(pdf, 'binary');
        break;
      }
      default: {
        const width = parseInt(searchParams.get('width'), 10) || 1024;
        const height = parseInt(searchParams.get('height'), 10) || 768;
        const thumbWidth = parseInt(searchParams.get('thumbWidth'), 10) || null;
        const fullPage = searchParams.get('fullPage') == 'true' || false;
        const clipSelector = searchParams.get('clipSelector');

        await page.setViewport({
          width,
          height,
        });

        let clip;
        if (clipSelector){
          // SOON: https://github.com/GoogleChrome/puppeteer/pull/445
          const handle = await page.$(clipSelector);
          if (handle){
            clip = await handle.evaluate((el) => {
              const { x, y, width, height, bottom } = el.getBoundingClientRect();
              return Promise.resolve({x, y, width, height});
            });
            const bottom = clip.y + clip.height;
            if (page.viewport().height < bottom){
              await page.setViewport({
                width,
                height: bottom,
              });
            }
          }
        }

        const screenshot = await pTimeout(page.screenshot({
          type: 'jpeg',
          fullPage,
          clip,
        }), 20 * 1000, 'Screenshot timed out');

        res.writeHead(200, {
          'content-type': 'image/jpeg',
          'cache-control': 'public,max-age=31536000',
        });

        if (thumbWidth && thumbWidth < width){
          const image = sharp(screenshot).resize(thumbWidth).jpeg({
            quality: 90,
            progressive: true,
          });
          image.pipe(res);
        } else {
          res.end(screenshot, 'binary');
        }
      }
    }

    actionDone = true;
    console.log('💥 Done action: ' + action);
    if (!cache.has(pageURL)){
      cache.set(pageURL, page);

      // Try to stop all execution
      page.frames().forEach((frame) => {
        frame.evaluate(() => {
          // Clear all timer intervals https://stackoverflow.com/a/6843415/20838
          for (var i = 1; i < 99999; i++) window.clearInterval(i);
          // Disable all XHR requests
          XMLHttpRequest.prototype.send = _=>_;
          // Disable all RAFs
          requestAnimationFrame = _=>_;
          // Pause all media and stop buffering
          document.querySelectorAll('video, audio').forEach(m => {
            if (!m) return;
            if (m.pause) m.pause();
            m.preload = 'none';
          });
        });
      });
    }
  } catch (e) {
    if (!DEBUG && page) page.close();
    cache.del(pageURL);
    console.error(e);
    const { message = '' } = e;
    res.writeHead(400, {
      'content-type': 'text/plain',
    });
    res.end('Oops. Something is wrong.\n\n' + message);

    // Handle websocket not opened error
    if (/not opened/i.test(message) && browser){
      console.error('🕸 Web socket failed');
      browser.close();
      browser = null;
    }
  }
}).listen(process.env.PORT || 3000);

process.on('SIGINT', () => {
  if (browser) browser.close();
  process.exit();
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
});