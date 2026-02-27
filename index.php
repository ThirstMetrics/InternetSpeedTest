<?php
// Get the actual request path, stripping /index.php prefix if present
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = preg_replace('#^/index\.php#', '', $requestUri);
if (empty($path)) $path = '/';

// Strip query string for path matching
$pathOnly = strtok($path, '?');

// =====================================================
// NATIVE PHP HANDLERS — bypass Node.js proxy for speed
// =====================================================

// PING — minimal latency response
if ($pathOnly === '/api/speedtest/ping') {
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    // Use microsecond timestamp for precision
    echo json_encode(['t' => round(microtime(true) * 1000)]);
    exit;
}

// UPLOAD — count bytes directly, no proxying
if ($pathOnly === '/api/speedtest/upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');

    // Read raw POST body and count bytes — don't store it
    $bytes = 0;
    $stream = fopen('php://input', 'rb');
    if ($stream) {
        while (!feof($stream)) {
            $chunk = fread($stream, 65536); // 64KB chunks
            $bytes += strlen($chunk);
        }
        fclose($stream);
    }

    echo json_encode(['received' => $bytes, 't' => round(microtime(true) * 1000)]);
    exit;
}

// =====================================================
// PROXY — everything else goes to Node.js
// =====================================================

$target = 'http://127.0.0.1:3003';
$url = $target . $path;
$method = $_SERVER['REQUEST_METHOD'];

$headers = [];
foreach (getallheaders() as $key => $value) {
    $lk = strtolower($key);
    if ($lk === 'host' || $lk === 'content-length') continue;
    $headers[] = "$key: $value";
}
$headers[] = "Host: " . $_SERVER['HTTP_HOST'];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 120);

if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    echo "Proxy error: " . curl_error($ch);
    curl_close($ch);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

foreach (explode("\r\n", $responseHeaders) as $line) {
    if (empty(trim($line))) continue;
    if (stripos($line, 'HTTP/') === 0) continue;
    if (stripos($line, 'transfer-encoding') === 0) continue;
    if (stripos($line, 'content-length') === 0) continue;
    header($line);
}

http_response_code($httpCode);
echo $responseBody;
