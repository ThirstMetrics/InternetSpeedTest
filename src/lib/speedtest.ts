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

  // Track ramp-up discard (same approach as Ookla: ignore first 2s)
  const RAMP_UP_MS = 2000;
  let bytesAtRampEnd = 0;
  let rampEndMarked = false;

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

        const elapsed = performance.now() - startTime;

        if (!rampEndMarked && elapsed >= RAMP_UP_MS) {
          bytesAtRampEnd = totalBytes;
          rampEndMarked = true;
        }

        const elapsedSec = elapsed / 1000;
        if (rampEndMarked) {
          const settledBytes = totalBytes - bytesAtRampEnd;
          const settledSec = (elapsed - RAMP_UP_MS) / 1000;
          currentMbps = settledSec > 0 ? (settledBytes * 8) / (1_000_000 * settledSec) : 0;
        } else {
          currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);
        }

        onProgress(createState({
          phase: 'download',
          progress: Math.min(99, Math.round((elapsed / DOWNLOAD_DURATION_MS) * 100)),
          download_mbps: Math.round(currentMbps * 100) / 100,
          latency_ms: latency,
          jitter_ms: jitter,
        }));

        launchOne();
        while (activeCount < getTargetConcurrency() && performance.now() - startTime < DOWNLOAD_DURATION_MS) {
          launchOne();
        }
      }).catch(() => {
        activeCount--;
        if (activeCount === 0 && performance.now() - startTime >= DOWNLOAD_DURATION_MS) resolve();
      });
    }

    const initial = 2;
    for (let i = 0; i < initial; i++) launchOne();
  });

  if (rampEndMarked) {
    const settledBytes = totalBytes - bytesAtRampEnd;
    const settledSec = (performance.now() - startTime - RAMP_UP_MS) / 1000;
    return Math.round(((settledBytes * 8) / (1_000_000 * settledSec)) * 100) / 100;
  }
  const totalElapsedSec = (performance.now() - startTime) / 1000;
  return Math.round(((totalBytes * 8) / (1_000_000 * totalElapsedSec)) * 100) / 100;
}

async function measureUpload(
  onProgress: ProgressCallback,
  latency: number,
  jitter: number,
  downloadMbps: number
): Promise<number> {
  const chunkSize = 4 * 1024 * 1024;
  const randomData = new Uint8Array(chunkSize);
  for (let offset = 0; offset < chunkSize; offset += 65536) {
    const len = Math.min(65536, chunkSize - offset);
    crypto.getRandomValues(randomData.subarray(offset, offset + len));
  }
  const uploadBlob = new Blob([randomData]);

  const uploadUrl = `${TEST_SERVER}/api/speedtest/upload`;
  const uploadHeaders = { 'Content-Type': 'application/octet-stream' };

  // Warm up 3 HTTP/2 streams before starting the clock
  const warmup = new Uint8Array(4096);
  crypto.getRandomValues(warmup);
  await Promise.all([
    fetch(uploadUrl, { method: 'POST', body: new Blob([warmup]), headers: uploadHeaders }),
    fetch(uploadUrl, { method: 'POST', body: new Blob([warmup]), headers: uploadHeaders }),
    fetch(uploadUrl, { method: 'POST', body: new Blob([warmup]), headers: uploadHeaders }),
  ]);

  let totalBytes = 0;
  let currentMbps = 0;
  let activeCount = 0;

  // Track cumulative bytes at each completion for ramp-up discard
  const RAMP_UP_MS = 2000;
  let bytesAtRampEnd = 0;
  let rampEndMarked = false;

  const uploadChunk = async (): Promise<number> => {
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadBlob,
      headers: uploadHeaders,
    });
    const result = await resp.json();
    return result.received || chunkSize;
  };

  function getTargetConcurrency(): number {
    const hint = currentMbps > 0 ? currentMbps : downloadMbps * 0.3;
    if (hint > 500) return 12;
    if (hint > 200) return 8;
    if (hint > 100) return 6;
    if (hint > 50) return 4;
    return 3;
  }

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

        const elapsed = performance.now() - startTime;

        // Mark the ramp-up boundary
        if (!rampEndMarked && elapsed >= RAMP_UP_MS) {
          bytesAtRampEnd = totalBytes;
          rampEndMarked = true;
        }

        // Display speed: use post-ramp settled speed when available
        const elapsedSec = elapsed / 1000;
        if (rampEndMarked) {
          const settledBytes = totalBytes - bytesAtRampEnd;
          const settledSec = (elapsed - RAMP_UP_MS) / 1000;
          currentMbps = settledSec > 0 ? (settledBytes * 8) / (1_000_000 * settledSec) : 0;
        } else {
          currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);
        }

        onProgress(createState({
          phase: 'upload',
          progress: Math.min(99, Math.round((elapsed / UPLOAD_DURATION_MS) * 100)),
          download_mbps: downloadMbps,
          upload_mbps: Math.round(currentMbps * 100) / 100,
          latency_ms: latency,
          jitter_ms: jitter,
        }));

        launchOne();
        while (activeCount < getTargetConcurrency() && performance.now() - startTime < UPLOAD_DURATION_MS) {
          launchOne();
        }
      }).catch(() => {
        activeCount--;
        if (activeCount === 0 && performance.now() - startTime >= UPLOAD_DURATION_MS) resolve();
      });
    }

    // Start with minimum 3 connections
    const initial = Math.max(3, getTargetConcurrency());
    for (let i = 0; i < initial; i++) launchOne();
  });

  // Final result: use settled speed (post-ramp-up) if available
  if (rampEndMarked) {
    const settledBytes = totalBytes - bytesAtRampEnd;
    const settledSec = (performance.now() - startTime - RAMP_UP_MS) / 1000;
    return Math.round(((settledBytes * 8) / (1_000_000 * settledSec)) * 100) / 100;
  }
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
