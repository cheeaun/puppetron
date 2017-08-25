const http = require('http');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { URL } = require('url');
const LRU = require('lru-cache');
const cache = LRU({
  max: 15,
  dispose: (url, page) => {
    console.log('Disposing ' + url);
    if (page) page.close();
  }
});

const blocked = require('./blocked.json');
const allBlocked = new RegExp('(' + blocked.all.join('|') + ')', 'i');
const renderBlocked = new RegExp('(' + blocked.render.join('|') + ')', 'i');
const assetsBlocked = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff|ttf|ico|eot|otf|woff|woff2)$/i;

let browser;

require('http').createServer(async (req, res) => {
  const [_, action, url] = req.url.match(/^\/(screenshot|render)?\/?(.*)/i) || ['', '', ''];

  if (url == 'favicon.ico'){
    res.writeHead(204);
    res.end();
    return;
  }

  if (!url){
    res.end('Append a URL pls.');
    return;
  }

  try {
    new URL(url);

    let page = cache.get(url);
    if (!page) {
      console.log('Fetching ' + url);
      if (!browser) {
        browser = await puppeteer.launch({args: ['--no-sandbox']});
      }
      page = await browser.newPage();
      page.setViewport({
        width: 1024,
        height: 768,
      });
  
      await page.setRequestInterceptionEnabled(true);
      page.on('request', request => {
        const { url } = request;
        if (allBlocked.test(url) || (action === 'render' && assetsBlocked.test(url) || renderBlocked.test(url))){
          console.log('Blocked ' + url);
          request.abort();
        } else {
          request.continue();
        }
      });
      await page.goto(url, {
        waitUntil: 'networkidle',
      });
      cache.set(url, page);
    }

    if (action === 'render'){
      await page.evaluate(() => {
        const scripts = document.querySelectorAll('script:not([type="application/ld+json"])');
        scripts.forEach(s => s.parentNode.removeChild(s));
        const imports = document.querySelectorAll('link[rel=import]');
        imports.forEach(i => i.parentNode.removeChild(i));
      });
      let content = await page.content();
      content = content.replace(/<!--[\s\S]*?-->/g, '');

      // page.close();
      
      res.writeHead(200, {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': 'public,max-age=31536000',
      });
      res.end(content);
      return;
    }
    
    const screenshot = await page.screenshot();
    const image = sharp(screenshot).resize(320).jpeg({
      quality: 90,
      progressive: true,
    });

    // page.close();

    res.writeHead(200, {
      'content-type': 'image/jpg',
      'cache-control': 'public,max-age=31536000,immutable',
    });
    image.pipe(res);
  } catch (e) {
    res.end('Oops. Invalid URL.');
  }
}).listen(process.env.PORT || 3000);

process.on('SIGINT', () => {
  if (browser) browser.close();
  process.exit();
});