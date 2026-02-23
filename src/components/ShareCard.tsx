'use client';

import { useState } from 'react';

interface ShareCardProps {
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  jitter_ms: number;
  location?: string;
  timestamp?: string;
  onClose?: () => void;
}

export default function ShareCard({
  download_mbps,
  upload_mbps,
  latency_ms,
  jitter_ms,
  location,
  timestamp,
  onClose,
}: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  const formatDate = (isoString?: string) => {
    if (!isoString) return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    const shareData = {
      title: 'My Internet Speed Test Results',
      text: `Download: ${download_mbps.toFixed(1)} Mbps | Upload: ${upload_mbps.toFixed(1)} Mbps | Ping: ${latency_ms.toFixed(0)} ms`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
          fallbackCopyToClipboard();
        }
      }
    } else {
      fallbackCopyToClipboard();
    }
  };

  const fallbackCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyLink = async () => {
    await fallbackCopyToClipboard();
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* Screenshot Card - Fixed Size 280x160px */}
      <div
        id="share-card"
        className="relative w-[280px] h-[160px] bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Branding */}
        <div className="absolute top-2 right-3">
          <span className="text-xs font-semibold text-gray-500">SpeedTest</span>
        </div>

        {/* Main Content */}
        <div className="flex flex-col justify-between h-full p-4 pt-6">
          {/* Speed Results */}
          <div className="flex items-end gap-4">
            {/* Download - Large and Green */}
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-[#10b981]">
                {download_mbps.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">Mbps Down</span>
            </div>

            {/* Upload - Smaller and Purple */}
            <div className="flex flex-col mb-1">
              <span className="text-xl font-semibold text-[#8b5cf6]">
                {upload_mbps.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">Mbps Up</span>
            </div>

            {/* Ping - Amber */}
            <div className="flex flex-col mb-1">
              <span className="text-xl font-semibold text-[#f59e0b]">
                {latency_ms.toFixed(0)}
              </span>
              <span className="text-xs text-gray-400">ms</span>
            </div>
          </div>

          {/* Location & Date */}
          <div className="flex flex-col gap-0.5">
            {location && (
              <span className="text-xs text-gray-400">{location}</span>
            )}
            <span className="text-xs text-gray-500">
              {formatDate(timestamp)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          Share
        </button>
        <button
          onClick={handleCopyLink}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-md transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
