import type { SpeedTestState } from '@/types';

type ProgressCallback = (state: SpeedTestState) => void;

const LATENCY_ROUNDS = 10;
const DOWNLOAD_DURATION_MS = 10000;
const UPLOAD_DURATION_MS = 10000;
const PROGRESS_INTERVAL_MS = 150;

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

  const RAMP_UP_MS = 2000;
  let bytesAtRampEnd = 0;
  let rampEndMarked = false;

  const startTime = performance.now();

  function computeSpeed() {
    const elapsed = performance.now() - startTime;
    if (!rampEndMarked && elapsed >= RAMP_UP_MS) {
      bytesAtRampEnd = totalBytes;
      rampEndMarked = true;
    }
    if (rampEndMarked) {
      const settledBytes = totalBytes - bytesAtRampEnd;
      const settledSec = (elapsed - RAMP_UP_MS) / 1000;
      currentMbps = settledSec > 0 ? (settledBytes * 8) / (1_000_000 * settledSec) : 0;
    } else {
      const elapsedSec = elapsed / 1000;
      currentMbps = elapsedSec > 0 ? (totalBytes * 8) / (1_000_000 * elapsedSec) : 0;
    }
  }

  function emitProgress() {
    computeSpeed();
    const elapsed = performance.now() - startTime;
    onProgress(createState({
      phase: 'download',
      progress: Math.min(99, Math.round((elapsed / DOWNLOAD_DURATION_MS) * 100)),
      download_mbps: Math.round(currentMbps * 100) / 100,
      latency_ms: latency,
      jitter_ms: jitter,
    }));
  }

  // Smooth UI updates every 150ms — progress and speed always feel alive
  const ticker = setInterval(emitProgress, PROGRESS_INTERVAL_MS);

  // Stream bytes incrementally so totalBytes updates in real time
  const fetchChunk = async (): Promise<void> => {
    const cacheBust = `?t=${Date.now()}-${Math.random()}`;
    let file: string;
    if (currentMbps > 100) file = '/test-files/100mb.bin';
    else if (currentMbps > 20) file = '/test-files/25mb.bin';
    else file = '/test-files/5mb.bin';
    const response = await fetch(`${TEST_SERVER}${file}` + cacheBust, {
      cache: 'no-store',
      headers: { 'Accept-Encoding': 'identity' },
    });
    const reader = response.body?.getReader();
    if (!reader) {
      const blob = await response.blob();
      totalBytes += blob.size;
      return;
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
    }
  };

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
      fetchChunk().then(() => {
        activeCount--;
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

  clearInterval(ticker);

  // Final speed calculation
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

  let completedBytes = 0;
  let currentMbps = 0;
  let activeCount = 0;

  // Track per-connection upload progress via XHR for real-time speed display
  const inflightMap = new Map<number, number>();
  let nextId = 0;

  function getTotalBytes() {
    let inflight = 0;
    for (const loaded of inflightMap.values()) inflight += loaded;
    return completedBytes + inflight;
  }

  const RAMP_UP_MS = 2000;
  let bytesAtRampEnd = 0;
  let rampEndMarked = false;

  const startTime = performance.now();

  function computeSpeed() {
    const elapsed = performance.now() - startTime;
    const totalBytes = getTotalBytes();
    if (!rampEndMarked && elapsed >= RAMP_UP_MS) {
      bytesAtRampEnd = totalBytes;
      rampEndMarked = true;
    }
    if (rampEndMarked) {
      const settledBytes = totalBytes - bytesAtRampEnd;
      const settledSec = (elapsed - RAMP_UP_MS) / 1000;
      currentMbps = settledSec > 0 ? (settledBytes * 8) / (1_000_000 * settledSec) : 0;
    } else {
      const elapsedSec = elapsed / 1000;
      currentMbps = elapsedSec > 0 ? (totalBytes * 8) / (1_000_000 * elapsedSec) : 0;
    }
  }

  function emitProgress() {
    computeSpeed();
    const elapsed = performance.now() - startTime;
    onProgress(createState({
      phase: 'upload',
      progress: Math.min(99, Math.round((elapsed / UPLOAD_DURATION_MS) * 100)),
      download_mbps: downloadMbps,
      upload_mbps: Math.round(currentMbps * 100) / 100,
      latency_ms: latency,
      jitter_ms: jitter,
    }));
  }

  // Smooth UI updates every 150ms
  const ticker = setInterval(emitProgress, PROGRESS_INTERVAL_MS);

  // Use XMLHttpRequest for upload — gives real-time progress via upload.onprogress
  // (fetch() provides zero visibility into upload progress)
  const uploadChunk = (id: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          inflightMap.set(id, e.loaded);
        }
      };
      xhr.onload = () => {
        inflightMap.delete(id);
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result.received || chunkSize);
        } catch {
          resolve(chunkSize);
        }
      };
      xhr.onerror = () => {
        inflightMap.delete(id);
        reject(new Error('Upload failed'));
      };
      xhr.send(uploadBlob);
    });
  };

  function getTargetConcurrency(): number {
    const hint = currentMbps > 0 ? currentMbps : downloadMbps * 0.3;
    if (hint > 500) return 12;
    if (hint > 200) return 8;
    if (hint > 100) return 6;
    if (hint > 50) return 4;
    return 3;
  }

  await new Promise<void>((resolve) => {
    function launchOne() {
      if (performance.now() - startTime >= UPLOAD_DURATION_MS) {
        if (activeCount === 0) resolve();
        return;
      }
      activeCount++;
      const id = nextId++;
      inflightMap.set(id, 0);
      uploadChunk(id).then((bytes) => {
        activeCount--;
        completedBytes += bytes;
        launchOne();
        while (activeCount < getTargetConcurrency() && performance.now() - startTime < UPLOAD_DURATION_MS) {
          launchOne();
        }
      }).catch(() => {
        activeCount--;
        inflightMap.delete(nextId - 1);
        if (activeCount === 0 && performance.now() - startTime >= UPLOAD_DURATION_MS) resolve();
      });
    }

    const initial = Math.max(3, getTargetConcurrency());
    for (let i = 0; i < initial; i++) launchOne();
  });

  clearInterval(ticker);

  // Final speed from completed bytes (all inflight settled by now)
  const totalBytes = completedBytes;
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
