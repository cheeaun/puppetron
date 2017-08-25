const http = require('http');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { URL } = require('url');

let browser;

require('http').createServer(async (req, res) => {
  const url = req.url.replace(/^\//, '');
  if (url == 'favicon.ico'){
    res.writeHead(204);
    res.end();
    return;
  }

  if (!url){
    res.end('Append a URL pls.');
    return;
  }

  console.log('Screenshoting ' + url);
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
