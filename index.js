/**
 * Created by pooya on 6/16/19.
 */

process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/lib/chromium/chromium';

const config = require('config');
const Promise = require('bluebird');
const puppeteer = require('puppeteer');
const uuid = require('uuid/v4');
const urlParser = require('url');

const tabBreak = 1;
let searchInterval = 0;

const list = {};

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--proxy-server=socks5://127.0.0.1:9080'
    ]
  });

  const ipPage = await browser.newPage();
  await ipPage.goto('https://api.ipify.org');

  const videoPage = await browser.newPage();
  const id = uuid();
  list[id] = { finished: false, fail: false, visit: 0, close: browser.close };
  goToVideo(id, browser, 'https://www.aparat.com/v/OHRe7', videoPage).catch((error) => console.error(error));
}

async function goToVideo(id, browser, url, page) {
  if (list[id].visit > tabBreak) {
    list[id].finished = true;
    return;
  }
  list[id].visit++;

  try {
    console.log(`Send request for get page "${url}"`);
    const { protocol: urlProtocol, host: urlHost } = urlParser.parse(url);
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    });
    if (response._status === 200) {
      await play(page);
      await page.waitForFunction(
        'Array.from(document.querySelectorAll(".vjs-progress-holder")).filter((d) => Number(d.getAttribute("aria-valuenow")) === 100).length > 0',
        { timeout: 0 },
      );
      const nextUrl = await getNextVideo(page);
      await goToVideo(id, browser, `${urlProtocol}//${urlHost}${nextUrl}`, page);
    } else {
      list[id].fail = true;
    }
  } catch (error) {
    list[id].fail = true;
    throw error;
  }
}

async function play(page) {
  console.log('Start watching');
  await page.waitForSelector('.vjs-big-play-button');
  await page.$eval('.vjs-big-play-button', (el) => el.click());
}

async function getNextVideo(page) {
  const result = await page.evaluate(() => {
    const data = [];
    $('.thumbnail-video').each(function() {
      const url = $(this).find('a.title').attr('href');
      data.push(url);
    });
    return data;
  });
  const random = Math.floor(Math.random() * result.length);

  return result[random];
}

setInterval(() => {
  console.log(list);
  if (searchInterval > 5) {
    resetAll();
    return;
  }

  searchInterval++;
  const totalFinish = Object.keys(list).filter((v) => list[v].finished || list[v].visit > tabBreak);
  if (totalFinish < 5) {
    return;
  }

  resetAll();
}, 2 * 60 * 1000);

function resetAll() {
  searchInterval = 0;
  Object.keys(list).forEach((v) => list[v].close());
  console.log('should reset tor');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});