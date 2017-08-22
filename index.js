const http = require('http');
const puppeteer = require('puppeteer');
const { URL } = require('url');

require('http').createServer(async (req, res) => {
  console.log(req.url);
  const url = req.url.replace(/^\//, '');
  if (url && url != 'favicon.ico'){
    try {
      new URL(url);
      const browser = await puppeteer.launch({args: ['--no-sandbox']});
      const page = await browser.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle',
        networkIdleTimeout: 5000,
      });
      const screenshot = await page.screenshot({
        type: 'jpeg',
      });
      browser.close();
      res.writeHead(200, {'Content-Type': 'image/png' });
      res.end(screenshot, 'binary');
    } catch (e) {
      console.error(e);
      res.end('Oops. Invalid URL.');
    }
  } else {
    res.end('Append a URL pls.');
  }
}).listen(process.env.PORT || 3000);
