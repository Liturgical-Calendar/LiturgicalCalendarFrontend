import { Browser, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';

export async function actingAs(browser: Browser, id: string): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({ storageState: path.join(__dirname, '..', '..', '.auth', `${id}.json`) });
    const page = await context.newPage();
    return { context, page };
}
