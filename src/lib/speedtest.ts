import type { SpeedTestState } from '@/types';
import { apiUrl } from '@/lib/api';

type ProgressCallback = (state: SpeedTestState) => void;

const LATENCY_ROUNDS = 10;
const DOWNLOAD_DURATION_MS = 10000;
const UPLOAD_DURATION_MS = 10000;

// Dedicated speed test server (SF DigitalOcean droplet) for accurate measurements.
// Falls back to the app server if not configured.
const TEST_SERVER = process.env.NEXT_PUBLIC_TEST_SERVER || '';

function createState(overrides: Partial<SpeedTestState>): SpeedTestState {
  return {
    phase: 'idle',
    progress: 0,
    download_mbps: 0,
    upload_mbps: 0,
    latency_ms: 0,
    jitter_ms: 0,
    ...overrides,
  };
}

// Count bytes received through ReadableStream (measures actual wire bytes)
async function countStreamBytes(response: Response): Promise<number> {
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    return blob.size;
  }
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
  }
  return bytes;
}

async function measureLatency(onProgress: ProgressCallback): Promise<{ latency: number; jitter: number }> {
  const latencies: number[] = [];

  for (let i = 0; i < LATENCY_ROUNDS; i++) {
    const start = performance.now();
    await fetch(`${TEST_SERVER}/api/speedtest/ping`, { cache: 'no-store' });
    const elapsed = performance.now() - start;
    latencies.push(elapsed);

    onProgress(createState({
      phase: 'latency',
      progress: Math.round(((i + 1) / LATENCY_ROUNDS) * 100),
      latency_ms: Math.round(elapsed),
    }));
  }

  latencies.sort((a, b) => a - b);
  const trimmed = latencies.slice(1, -1);
  const avg = trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
  const jitter = trimmed.reduce((sum, v) => sum + Math.abs(v - avg), 0) / trimmed.length;

  return { latency: Math.round(avg), jitter: Math.round(jitter) };
}

async function measureDownload(onProgress: ProgressCallback, latency: number, jitter: number): Promise<number> {
  let totalBytes = 0;
  let currentMbps = 0;
  let activeCount = 0;

  const fetchChunk = async (): Promise<number> => {
    const cacheBust = `?t=${Date.now()}-${Math.random()}`;
    let file: string;
    if (currentMbps > 100) file = '/test-files/100mb.bin';
    else if (currentMbps > 20) file = '/test-files/25mb.bin';
    else file = '/test-files/5mb.bin';
    const response = await fetch(`${TEST_SERVER}${file}` + cacheBust, {
      cache: 'no-store',
      headers: { 'Accept-Encoding': 'identity' },
    });
    return countStreamBytes(response);
  };

  // Continuous pipeline: keep N connections busy at all times
  const startTime = performance.now();

  function getTargetConcurrency(): number {
    if (currentMbps > 500) return 12;
    if (currentMbps > 200) return 8;
    if (currentMbps > 50) return 6;
    if (currentMbps > 10) return 3;
    return 2;
  }

  await new Promise<void>((resolve) => {
    function launchOne() {
      if (performance.now() - startTime >= DOWNLOAD_DURATION_MS) {
        if (activeCount === 0) resolve();
        return;
      }
      activeCount++;
      fetchChunk().then((bytes) => {
        activeCount--;
        totalBytes += bytes;

        const elapsedSec = (performance.now() - startTime) / 1000;
        currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);
        const elapsed = performance.now() - startTime;

        onProgress(createState({
          phase: 'download',
          progress: Math.min(99, Math.round((elapsed / DOWNLOAD_DURATION_MS) * 100)),
          download_mbps: Math.round(currentMbps * 100) / 100,
          latency_ms: latency,
          jitter_ms: jitter,
        }));

        // Immediately launch replacement to keep pipe full
        launchOne();
        // Also ramp up if we need more concurrency
        while (activeCount < getTargetConcurrency() && performance.now() - startTime < DOWNLOAD_DURATION_MS) {
          launchOne();
        }
      }).catch(() => {
        activeCount--;
        if (activeCount === 0 && performance.now() - startTime >= DOWNLOAD_DURATION_MS) resolve();
      });
    }

    // Start initial connections
    const initial = 2;
    for (let i = 0; i < initial; i++) launchOne();
  });

  const totalElapsedSec = (performance.now() - startTime) / 1000;
  return Math.round(((totalBytes * 8) / (1_000_000 * totalElapsedSec)) * 100) / 100;
}

async function measureUpload(
  onProgress: ProgressCallback,
  latency: number,
  jitter: number,
  downloadMbps: number
): Promise<number> {
  // Pre-generate random data before starting the clock
  // Keep chunks small so progress updates frequently (4MB × high concurrency saturates pipe)
  const chunkSize = 4 * 1024 * 1024;
  const randomData = new Uint8Array(chunkSize);
  for (let offset = 0; offset < chunkSize; offset += 65536) {
    const len = Math.min(65536, chunkSize - offset);
    crypto.getRandomValues(randomData.subarray(offset, offset + len));
  }
  const uploadBlob = new Blob([randomData]);

  // Warm up the connection before starting the clock
  const warmup = new Uint8Array(1024);
  crypto.getRandomValues(warmup);
  await fetch(`${TEST_SERVER}/api/speedtest/upload`, {
    method: 'POST',
    body: new Blob([warmup]),
    headers: { 'Content-Type': 'application/octet-stream' },
  });

  let totalBytes = 0;
  let currentMbps = 0;
  let activeCount = 0;

  const uploadChunk = async (): Promise<number> => {
    const resp = await fetch(`${TEST_SERVER}/api/speedtest/upload`, {
      method: 'POST',
      body: uploadBlob,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    const result = await resp.json();
    return result.received || chunkSize;
  };

  // Seed initial concurrency from download speed (upload is typically 10-30% of download)
  function getTargetConcurrency(): number {
    // Once we have measured upload data, use that; otherwise estimate conservatively
    const hint = currentMbps > 0 ? currentMbps : downloadMbps * 0.15;
    if (hint > 500) return 12;
    if (hint > 200) return 8;
    if (hint > 100) return 6;
    if (hint > 50) return 4;
    if (hint > 10) return 3;
    return 2;
  }

  // Start clock AFTER data generation and warmup
  const startTime = performance.now();

  await new Promise<void>((resolve) => {
    function launchOne() {
      if (performance.now() - startTime >= UPLOAD_DURATION_MS) {
        if (activeCount === 0) resolve();
        return;
      }
      activeCount++;
      uploadChunk().then((bytes) => {
        activeCount--;
        totalBytes += bytes;

        const elapsedSec = (performance.now() - startTime) / 1000;
        currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);
        const elapsed = performance.now() - startTime;

        onProgress(createState({
          phase: 'upload',
          progress: Math.min(99, Math.round((elapsed / UPLOAD_DURATION_MS) * 100)),
          download_mbps: downloadMbps,
          upload_mbps: Math.round(currentMbps * 100) / 100,
          latency_ms: latency,
          jitter_ms: jitter,
        }));

        // Immediately launch replacement to keep pipe full
        launchOne();
        // Ramp up if needed
        while (activeCount < getTargetConcurrency() && performance.now() - startTime < UPLOAD_DURATION_MS) {
          launchOne();
        }
      }).catch(() => {
        activeCount--;
        if (activeCount === 0 && performance.now() - startTime >= UPLOAD_DURATION_MS) resolve();
      });
    }

    // Start with seeded concurrency
    const initial = getTargetConcurrency();
    for (let i = 0; i < initial; i++) launchOne();
  });

  const totalElapsedSec = (performance.now() - startTime) / 1000;
  return Math.round(((totalBytes * 8) / (1_000_000 * totalElapsedSec)) * 100) / 100;
}

export async function runSpeedTest(onProgress: ProgressCallback): Promise<SpeedTestState> {
  try {
    // Phase 1: Latency
    onProgress(createState({ phase: 'latency', progress: 0 }));
    const { latency, jitter } = await measureLatency(onProgress);

    // Phase 2: Download
    onProgress(createState({ phase: 'download', progress: 0, latency_ms: latency, jitter_ms: jitter }));
    const downloadMbps = await measureDownload(onProgress, latency, jitter);

    // Phase 3: Upload
    onProgress(createState({
      phase: 'upload',
      progress: 0,
      download_mbps: downloadMbps,
      latency_ms: latency,
      jitter_ms: jitter,
    }));
    const uploadMbps = await measureUpload(onProgress, latency, jitter, downloadMbps);

    const finalState = createState({
      phase: 'complete',
      progress: 100,
      download_mbps: downloadMbps,
      upload_mbps: uploadMbps,
      latency_ms: latency,
      jitter_ms: jitter,
    });

    onProgress(finalState);
    return finalState;
  } catch (err) {
    const errorState = createState({
      phase: 'idle',
      error: err instanceof Error ? err.message : 'Speed test failed',
    });
    onProgress(errorState);
    return errorState;
  }
}
