const fs = require('fs');
const http = require('http');
const { URL } = require('url');

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const LRU = require('lru-cache');
const cache = LRU({
  max: 15,
  maxAge: 1000 * 60, // 1 minute
  dispose: (url, page) => {
    console.log('Disposing ' + url);
    if (page) page.close();
  }
});

const blocked = require('./blocked.json');
const blockedRegExp = new RegExp('(' + blocked.join('|') + ')', 'i');

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

  const [_, action, url] = req.url.match(/^\/(screenshot|render)?\/?(.*)/i) || ['', '', ''];

  if (!url){
    res.writeHead(400, {
      'content-type': 'text/plain',
    });
    res.end('Something is wrong. Missing URL.');
    return;
  }

  try {
    const u = new URL(url);
    const pageURL = u.origin + decodeURIComponent(u.pathname);
    
    let page = cache.get(pageURL);
    if (!page) {
      console.log('Fetching ' + pageURL);
      if (!browser) {
        browser = await puppeteer.launch({args: ['--no-sandbox']});
      }
      page = await browser.newPage();
  
      await page.setRequestInterceptionEnabled(true);
      page.on('request', (request) => {
        const { url } = request;
        if (blockedRegExp.test(url)){
          console.log('Blocked ' + url);
          request.abort();
        } else {
          request.continue();
        }
      });
      await page.goto(pageURL, {
        waitUntil: 'networkidle',
      });
      cache.set(pageURL, page);
    }

    if (action === 'render'){
      await page.evaluate(() => {
        // Remove scripts except JSON-LD
        const scripts = document.querySelectorAll('script:not([type="application/ld+json"])');
        scripts.forEach(s => s.parentNode.removeChild(s));

        // Remove import tags
        const imports = document.querySelectorAll('link[rel=import]');
        imports.forEach(i => i.parentNode.removeChild(i));
      });

      let content = await page.content();

      // Remove comments
      content = content.replace(/<!--[\s\S]*?-->/g, '');

      // page.close();
      
      res.writeHead(200, {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': 'public,max-age=31536000',
      });
      res.end(content);
      return;
    }
    
    const width = parseInt(u.searchParams.get('width'), 10) || 1024;
    const height = parseInt(u.searchParams.get('height'), 10) || 768;
    const thumbWidth = parseInt(u.searchParams.get('thumbWidth'), 10) || null;
    page.setViewport({
      width,
      height,
    });
    const screenshot = await page.screenshot({
      type: 'jpeg',
    });

    // page.close();

    res.writeHead(200, {
      'content-type': 'image/jpg',
      'cache-control': 'public,max-age=31536000,immutable',
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
  } catch (e) {
    const { message = '' } = e;
    res.writeHead(400, {
      'content-type': 'text/plain',
    });
    res.end('Oops. Something is wrong.\n\n' + message);
  }
}).listen(process.env.PORT || 3000);

process.on('SIGINT', () => {
  if (browser) browser.close();
  process.exit();
});