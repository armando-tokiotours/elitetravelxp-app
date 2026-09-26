<?php
/**
 * Bluehost cPanel mail relay for tokiotours-app.com (VPS).
 *
 * WHY: Remote SMTP from the VPS authenticates and returns 250 OK, but Bluehost
 * only delivers to local @tokiotours.com mailboxes. External recipients
 * (Gmail, @tokiotours.nl) never arrive. PHP mail() on this host relays outbound.
 *
 * INSTALL (cPanel → File Manager → public_html):
 *   1. Upload this file as: public_html/mail-relay.php
 *   2. Create public_html/.mail-relay-secret with one line = the same secret
 *      as MAIL_RELAY_SECRET on the VPS (.env)
 *   3. Protect the secret file (permissions 600)
 *   4. On VPS set:
 *        MAIL_RELAY_URL=https://tokiotours.com/mail-relay.php
 *        MAIL_RELAY_SECRET=<same secret>
 *   5. Recreate elite-web container
 *
 * POST JSON:
 *   { "secret", "to", "subject", "text"?, "html"?, "from"?, "replyTo"?,
 *     "bcc"?: string[], "attachments"?: [{ filename, contentBase64, contentType? }] }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'POST only']);
  exit;
}

$secretFile = __DIR__ . '/.mail-relay-secret';
$expected = is_readable($secretFile)
  ? trim((string) file_get_contents($secretFile))
  : '';

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '{}', true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
  exit;
}

$got = trim((string) ($data['secret'] ?? ''));
if ($expected === '' || !hash_equals($expected, $got)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
  exit;
}

$to = trim((string) ($data['to'] ?? ''));
$subject = trim((string) ($data['subject'] ?? ''));
$text = (string) ($data['text'] ?? '');
$html = (string) ($data['html'] ?? '');
$from = trim((string) ($data['from'] ?? 'TOKIOTOURS <no_reply@tokiotours.com>'));
$replyTo = trim((string) ($data['replyTo'] ?? 'armando@tokiotours.nl'));
$bcc = $data['bcc'] ?? [];
if (!is_array($bcc)) {
  $bcc = $bcc ? [$bcc] : [];
}
$attachments = $data['attachments'] ?? [];
if (!is_array($attachments)) {
  $attachments = [];
}

if ($to === '' || $subject === '' || ($text === '' && $html === '')) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'to, subject, and text/html are required']);
  exit;
}

if (!filter_var(extractEmail($to), FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid to address']);
  exit;
}

$boundary = '=_Tokio_' . bin2hex(random_bytes(12));
$headers = [];
$headers[] = 'From: ' . sanitizeHeader($from);
$headers[] = 'Reply-To: ' . sanitizeHeader($replyTo);
$headers[] = 'MIME-Version: 1.0';
foreach ($bcc as $b) {
  $b = trim((string) $b);
  if ($b !== '' && filter_var(extractEmail($b), FILTER_VALIDATE_EMAIL)) {
    $headers[] = 'Bcc: ' . sanitizeHeader($b);
  }
}

$body = '';
if (count($attachments) > 0) {
  $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
  $body .= '--' . $boundary . "\r\n";
  if ($html !== '') {
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($html)) . "\r\n";
  } else {
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($text)) . "\r\n";
  }
  foreach ($attachments as $att) {
    if (!is_array($att)) {
      continue;
    }
    $filename = preg_replace('/[^\w.\-]+/', '_', (string) ($att['filename'] ?? 'file.bin')) ?: 'file.bin';
    $ctype = preg_replace('/[^\w.+\-\/]+/', '', (string) ($att['contentType'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
    $b64 = preg_replace('/\s+/', '', (string) ($att['contentBase64'] ?? ''));
    if ($b64 === '') {
      continue;
    }
    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Type: ' . $ctype . '; name="' . $filename . "\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= 'Content-Disposition: attachment; filename="' . $filename . "\"\r\n\r\n";
    $body .= chunk_split($b64) . "\r\n";
  }
  $body .= '--' . $boundary . "--\r\n";
} elseif ($html !== '') {
  $headers[] = 'Content-Type: text/html; charset=UTF-8';
  $body = $html;
} else {
  $headers[] = 'Content-Type: text/plain; charset=UTF-8';
  $body = $text;
}

$envelopeFrom = extractEmail($from) ?: 'no_reply@tokiotours.com';
$ok = @mail(
  $to,
  '=?UTF-8?B?' . base64_encode($subject) . '?=',
  $body,
  implode("\r\n", $headers),
  '-f' . $envelopeFrom
);

if (!$ok) {
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'PHP mail() failed on Bluehost']);
  exit;
}

echo json_encode([
  'ok' => true,
  'via' => 'bluehost-php-mail',
  'to' => $to,
]);

function extractEmail(string $value): string
{
  if (preg_match('/<([^>]+)>/', $value, $m)) {
    return trim($m[1]);
  }
  return trim($value);
}

function sanitizeHeader(string $value): string
{
  return str_replace(["\r", "\n"], '', $value);
}
