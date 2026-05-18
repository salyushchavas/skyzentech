<?php
declare(strict_types=1);

$redirect = 'index.html#contact';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . $redirect);
    exit;
}

function clean_input(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

$firstName = clean_input($_POST['firstName'] ?? '');
$lastName = clean_input($_POST['lastName'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = clean_input($_POST['phone'] ?? '');
$message = trim($_POST['message'] ?? '');

if ($firstName === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: index.html?contact=invalid#contact');
    exit;
}

$to = 'info@skyzentech.com';
$subject = 'New contact form submission from Skyzen website';
$fullName = trim($firstName . ' ' . $lastName);

$bodyLines = [
    'A new message was submitted from the Skyzen website contact form.',
    '',
    'Name: ' . ($fullName !== '' ? $fullName : $firstName),
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    '',
    'Message:',
    $message,
];

$body = implode(PHP_EOL, $bodyLines);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Skyzen Website <info@skyzentech.com>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($to, $subject, $body, implode("\r\n", $headers));

header('Location: index.html?contact=' . ($sent ? 'success' : 'error') . '#contact');
exit;
