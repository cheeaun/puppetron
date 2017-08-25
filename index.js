const http = require('http');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { URL } = require('url');

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

  console.log('Fetching ' + url);
  try {
    new URL(url);
    if (!browser) {
      browser = await puppeteer.launch({args: ['--no-sandbox']});
    }
    const page = await browser.newPage();
    page.setViewport({
      width: 1024,
      height: 768,
    });
    await page.goto(url, {
      waitUntil: 'networkidle',
    });

    if (action === 'render'){
      await page.evaluate(() => {
        const scripts = document.querySelectorAll('script:not([type="application/ld+json"])');
        scripts.forEach(s => s.parentNode.removeChild(s));
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(i => i.parentNode.removeChild(i));
      });
      let content = await page.content();
      content = content.replace(/<!--[\s\S]*?-->/g, '');
      
      res.writeHead(200, {
        'content-type': 'text/html',
        'cache-control': 'public,max-age=31536000',
      });
      
      res.end(content);
      return;
    }
    
    const screenshot = await page.screenshot();
    page.close();
    const image = sharp(screenshot).resize(320).jpeg({
      quality: 90,
      progressive: true,
    });
    res.writeHead(200, {
      'content-type': 'image/jpg',
      'cache-control': 'public,max-age=31536000,immutable',
    });
    image.pipe(res);
    // res.end(image, 'binary');
  } catch (e) {
    console.error(e);
    res.end('Oops. Invalid URL.');
  }
}).listen(process.env.PORT || 3000);

process.on('SIGINT', () => {
  if (browser) browser.close();
  process.exit();
});