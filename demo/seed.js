// Loads the sample semester into the demo's in-memory storage before the
// calendar page reads it.
import { sampleData } from '../lib/sample-data.js';

const { canvas, myu } = sampleData();
await chrome.storage.local.set({
  canvas, myu, sample: true,
  settings: { reading: true, mode: 'rules' },
});
