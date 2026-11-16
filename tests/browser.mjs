import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});
let browser;
const errors = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Сервер проверки не запустился');
}

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

try {
  await mkdir('.tmp', { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  check(await page.locator('.beer-card').count() === 6, 'В меню отображаются ровно шесть сортов');
  check(await page.locator('.event-card').count() === 3, 'В афише отображаются три события');
  check(await page.locator('h1').innerText() === 'Ваш вечер.\nШесть кранов.', 'Первый экран содержит основной оффер');
  await page.screenshot({ path: '.tmp/bar-desktop.jpg', fullPage: false, type: 'jpeg', quality: 82 });

  await page.locator('.hero-actions a[href="#menu"]').click();
  await page.waitForTimeout(450);
  check((await page.evaluate(() => window.scrollY)) > 300, 'Кнопка первого экрана ведёт к меню');

  await page.locator('.hero-actions a[href="#music"]').click();
  await page.waitForTimeout(450);
  await page.locator('[data-event-booking="1"]').click();
  check(await page.locator('#booking-dialog').evaluate((dialog) => dialog.open), 'Кнопка события открывает бронирование');
  check(await page.locator('#booking-event').inputValue() === '1', 'В бронировании выбрано нужное событие');
  await page.locator('#booking-form button[type="submit"]').click();
  check(await page.locator('[data-error="name"]').innerText() !== '', 'Форма показывает ошибки пустых полей');
  await page.locator('#booking-name').fill('Андрей');
  await page.locator('#booking-phone').fill('+7 999 123-45-67');
  await page.locator('#booking-form button[type="submit"]').click();
  check(await page.locator('#booking-success').isVisible(), 'После валидации появляется демо-заявка');
  check((await page.locator('#booking-summary').innerText()).includes('Суббота вживую'), 'В заявке сохраняется выбранное событие');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#booking-dialog').evaluate((dialog) => dialog.open)), 'Окно бронирования закрывается клавишей Escape');

  await page.locator('[data-booking]').first().click();
  await page.mouse.click(5, 5);
  check(!(await page.locator('#booking-dialog').evaluate((dialog) => dialog.open)), 'Окно бронирования закрывается кликом по фону');

  await page.locator('#open-editor').click();
  await page.locator('[name="beer-0-name"]').fill('Тестовый лагер');
  await page.locator('[name="event-0-title"]').fill('Тестовый вечер');
  await page.locator('#editor-form button[type="submit"]').click();
  check(await page.locator('.beer-card h3').first().innerText() === 'Тестовый лагер', 'Редактор обновляет название сорта на сайте');
  check(await page.locator('.event-card h3').first().innerText() === 'Тестовый вечер', 'Редактор обновляет событие в афише');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('.beer-card h3').first().innerText() === 'Тестовый лагер', 'Изменения сохраняются после перезагрузки');

  await page.locator('#open-editor').click();
  await page.locator('#reset-content').click();
  await page.locator('#editor-form button[type="submit"]').click();
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('.beer-card h3').first().innerText() === 'Светлый лагер', 'Демонстрационные данные восстанавливаются');
  await page.locator('#open-editor').click();
  await page.keyboard.press('Escape');
  check(!(await page.locator('#editor-dialog').evaluate((dialog) => dialog.open)), 'Редактор закрывается клавишей Escape');

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      offenders: [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((element) => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })).slice(0, 12)
    }));
    if (dimensions.scroll > dimensions.client) console.log('Выходящие элементы:', dimensions.offenders);
    check(dimensions.scroll <= dimensions.client, `Нет горизонтального скролла при ширине ${width}px`);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.menu-toggle').click();
  check(await page.locator('#mobile-menu').isVisible(), 'Мобильное меню открывается');
  await page.locator('#mobile-menu a[href="#menu"]').click();
  check(!(await page.locator('#mobile-menu').isVisible()), 'Мобильное меню закрывается после перехода');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.tmp/bar-mobile.jpg', fullPage: true, type: 'jpeg', quality: 82 });

  check(errors.length === 0, `Нет ошибок консоли и HTTP${errors.length ? `: ${errors.join('; ')}` : ''}`);
  console.log('\nВсе проверки пройдены.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
