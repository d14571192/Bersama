import { chromium, test } from '@playwright/test';
import { runDemoFlow } from '../../../../../shared/demo-recorder';
import path from 'node:path';

const STORYBOARD_PATH = path.resolve(__dirname, '..', '..', '..', 'demo-storyboard.json');

test('demo-video reads demo-storyboard.json and records via shared/demo-recorder', async () => {
  test.setTimeout(600_000);
  await runDemoFlow(
    chromium,
    STORYBOARD_PATH,
    process.env.DEMO_OUT ?? '/tmp/demo-recordings',
  );
});