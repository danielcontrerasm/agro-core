import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

type Step = (title: string, detail: string, inspect: () => Promise<Locator | void>) => Promise<void>;

export interface Walkthrough {
  page: Page;
  step: Step;
  button: (name: string) => Locator;
  dialog: Locator;
  close: () => Promise<void>;
}

const pause = Number(process.env.AGRO_MODULE_PAUSE_MS ?? '12000');

export function walkthrough(run: (ui: Walkthrough) => Promise<void>) {
  return async ({ page }: { page: Page }, info: TestInfo) => {
    const module = info.title;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const dialog = page.getByRole('dialog');
    let count = 0;

    const step: Step = async (title, detail, inspect) => {
      const number = String(++count).padStart(2, '0');
      const label = number + ' · ' + title;
      await test.step(label, async () => {
        const focus = await inspect();
        if (focus) await focus.scrollIntoViewIfNeeded();
        await page.evaluate(({ module, label, detail }) => {
          const caption = document.createElement('aside');
          caption.id = 'agrovision-qa-caption';
          caption.setAttribute('aria-hidden', 'true');
          Object.assign(caption.style, {
            position: 'fixed', right: '16px', bottom: '12px', zIndex: '100000',
            width: 'min(430px, calc(100vw - 32px))', padding: '10px 14px',
            color: '#ecfff3', background: '#15382d', borderLeft: '4px solid #57ce91',
            borderRadius: '8px', font: '13px/1.45 system-ui, sans-serif', pointerEvents: 'none',
          });
          const heading = document.createElement('strong');
          heading.textContent = module + ' · ' + label;
          heading.style.cssText = 'display:block;color:#b2ffd5;margin-bottom:4px';
          const copy = document.createElement('span');
          copy.textContent = detail;
          caption.append(heading, copy);
          document.body.append(caption);
        }, { module, label, detail });
        if (focus) await focus.evaluate(element => {
          element.setAttribute('data-qa-focus', element.getAttribute('style') ?? '');
          (element as HTMLElement).style.outline = '2px solid #0aa573';
          (element as HTMLElement).style.outlineOffset = '-2px';
        });

        const screenshot = info.outputPath('paso-' + number + '.png');
        await page.screenshot({ path: screenshot });
        await info.attach(label, { path: screenshot, contentType: 'image/png' });
        await page.waitForTimeout(pause);
        await page.evaluate(() => {
          document.querySelector('#agrovision-qa-caption')?.remove();
          document.querySelectorAll('[data-qa-focus]').forEach(element => {
            const previous = element.getAttribute('data-qa-focus');
            if (previous) element.setAttribute('style', previous);
            else element.removeAttribute('style');
            element.removeAttribute('data-qa-focus');
          });
        });
      });
    };

    await run({
      page,
      step,
      button: name => page.getByRole('button', { name, exact: true }),
      dialog,
      close: () => page.keyboard.press('Escape'),
    });
    expect(errors).toEqual([]);
  };
}

export async function attachDemoPhoto(page: Page, dialog: Locator, filename: string, caption: string) {
  const base64 = await page.evaluate(caption => {
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e4f5ea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 25px system-ui';
    ctx.fillStyle = '#175233';
    ctx.fillText(caption, 28, 108);
    ctx.font = '17px system-ui';
    ctx.fillText('Adjunto sintético de la prueba de Chrome', 28, 150);
    return canvas.toDataURL('image/png').split(',')[1];
  }, caption);
  const gallery = dialog.getByRole('region', { name: 'Fotos adjuntas' });
  await gallery.getByLabel('Seleccionar fotos').setInputFiles({
    name: filename, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64'),
  });
  await expect(gallery.getByRole('img', { name: filename, exact: true })).toBeVisible();
  return gallery;
}

export function localTimestamp(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
