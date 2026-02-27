import type { SpeedTestState } from '@/types';
import { apiUrl } from '@/lib/api';

type ProgressCallback = (state: SpeedTestState) => void;

const LATENCY_ROUNDS = 10;
const DOWNLOAD_DURATION_MS = 10000;
const UPLOAD_DURATION_MS = 10000;

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
    // Fallback to Content-Length if streaming not available
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
    await fetch(apiUrl('/api/speedtest/ping'), { cache: 'no-store' });
    const elapsed = performance.now() - start;
    latencies.push(elapsed);

    onProgress(createState({
      phase: 'latency',
      progress: Math.round(((i + 1) / LATENCY_ROUNDS) * 100),
      latency_ms: Math.round(elapsed),
    }));
  }

  // Drop highest and lowest, average the rest
  latencies.sort((a, b) => a - b);
  const trimmed = latencies.slice(1, -1);
  const avg = trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;

  // Jitter = average deviation from the mean
  const jitter = trimmed.reduce((sum, v) => sum + Math.abs(v - avg), 0) / trimmed.length;

  return { latency: Math.round(avg), jitter: Math.round(jitter) };
}

async function measureDownload(onProgress: ProgressCallback, latency: number, jitter: number): Promise<number> {
  const startTime = performance.now();
  let totalBytes = 0;
  let currentMbps = 0;

  const fetchChunk = async (): Promise<number> => {
    const cacheBust = `?t=${Date.now()}-${Math.random()}`;
    // Use larger file for faster connections to reduce HTTP overhead ratio
    const url = currentMbps > 20 ? '/test-files/25mb.bin' : '/test-files/5mb.bin';
    const response = await fetch(url + cacheBust, {
      cache: 'no-store',
      headers: { 'Accept-Encoding': 'identity' }, // prevent compression inflating results
    });
    // Stream body to count actual bytes received on the wire
    return countStreamBytes(response);
  };

  while (performance.now() - startTime < DOWNLOAD_DURATION_MS) {
    const elapsed = performance.now() - startTime;

    // Ramp concurrency to saturate the pipe (Ookla uses up to 16)
    const concurrency = currentMbps > 200 ? 6 : currentMbps > 50 ? 4 : currentMbps > 10 ? 2 : 1;

    const promises = Array.from({ length: concurrency }, () => fetchChunk());
    const results = await Promise.all(promises);
    totalBytes += results.reduce((sum, bytes) => sum + bytes, 0);

    const elapsedSec = (performance.now() - startTime) / 1000;
    currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);

    onProgress(createState({
      phase: 'download',
      progress: Math.min(99, Math.round((elapsed / DOWNLOAD_DURATION_MS) * 100)),
      download_mbps: Math.round(currentMbps * 100) / 100,
      latency_ms: latency,
      jitter_ms: jitter,
    }));
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
  const startTime = performance.now();
  let totalBytes = 0;
  let currentMbps = 0;

  // Use random data (not zeros) so compression can't artificially inflate throughput
  // crypto.getRandomValues has a 65536-byte limit per call, so fill in chunks
  // 4MB chunks reduce HTTP overhead ratio vs 1MB (PHP post_max_size is 10MB)
  const chunkSize = 4 * 1024 * 1024; // 4MB
  const randomData = new Uint8Array(chunkSize);
  for (let offset = 0; offset < chunkSize; offset += 65536) {
    const len = Math.min(65536, chunkSize - offset);
    crypto.getRandomValues(randomData.subarray(offset, offset + len));
  }
  const uploadData = new Blob([randomData]);

  const uploadChunk = async (): Promise<number> => {
    const resp = await fetch(apiUrl('/api/speedtest/upload'), {
      method: 'POST',
      body: uploadData,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    // Use server-reported bytes received for accuracy
    const result = await resp.json();
    return result.received || chunkSize;
  };

  while (performance.now() - startTime < UPLOAD_DURATION_MS) {
    const elapsed = performance.now() - startTime;

    // Ramp concurrency to saturate the pipe
    const concurrency = currentMbps > 200 ? 6 : currentMbps > 50 ? 4 : currentMbps > 10 ? 2 : 1;

    const promises = Array.from({ length: concurrency }, () => uploadChunk());
    const results = await Promise.all(promises);
    totalBytes += results.reduce((sum, bytes) => sum + bytes, 0);

    const elapsedSec = (performance.now() - startTime) / 1000;
    currentMbps = (totalBytes * 8) / (1_000_000 * elapsedSec);

    onProgress(createState({
      phase: 'upload',
      progress: Math.min(99, Math.round((elapsed / UPLOAD_DURATION_MS) * 100)),
      download_mbps: downloadMbps,
      upload_mbps: Math.round(currentMbps * 100) / 100,
      latency_ms: latency,
      jitter_ms: jitter,
    }));
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
