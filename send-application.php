<?php
declare(strict_types=1);

function clean_input(string $key): string
{
	return trim((string)($_POST[$key] ?? ''));
}

function render_response(string $title, string $message, bool $success): void
{
	$color = $success ? '#1f9a58' : '#c0392b';
	$bg = $success ? '#f2fcf6' : '#fff4f3';

	echo '<!DOCTYPE html>';
	echo '<html lang="en">';
	echo '<head>';
	echo '<meta charset="UTF-8">';
	echo '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
	echo '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>';
	echo '<style>
		body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(145deg, #edf4fb, #f8fbff); }
		.card { max-width: 680px; width: 100%; background: #fff; border: 1px solid #e4edf6; border-radius: 14px; box-shadow: 0 14px 35px rgba(21, 58, 99, 0.13); padding: 24px; }
		.badge { display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 0.82rem; font-weight: 700; color: ' . $color . '; background: ' . $bg . '; margin-bottom: 10px; }
		h1 { margin: 0 0 10px; color: #1a3653; font-size: 1.45rem; }
		p { margin: 0; color: #38536e; line-height: 1.65; }
		a { display: inline-block; margin-top: 16px; color: #1f5fae; text-decoration: none; font-weight: 600; }
		a:hover { text-decoration: underline; }
	</style>';
	echo '</head>';
	echo '<body>';
	echo '<section class="card">';
	echo '<span class="badge">' . ($success ? 'Success' : 'Notice') . '</span>';
	echo '<h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>';
	echo '<p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p>';
	echo '<a href="jobs.php">Back to Job Openings</a>';
	echo '</section>';
	echo '</body>';
	echo '</html>';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	render_response('Invalid Request', 'This endpoint accepts job application form submissions only.', false);
	exit;
}

$firstName = clean_input('first_name');
$lastName = clean_input('last_name');
$email = filter_var(clean_input('email'), FILTER_VALIDATE_EMAIL) ?: '';
$phone = clean_input('phone');
$skills = clean_input('skills');
$jobTitle = clean_input('job_title');
$country = clean_input('country');
$state = clean_input('state');
$city = clean_input('city');
$salary = clean_input('salary');
$experience = clean_input('years_experience');

$required = [
	$firstName,
	$lastName,
	$email,
	$phone,
	$skills,
	$jobTitle,
	$country,
	$state,
	$city,
	$salary,
	$experience
];

foreach ($required as $value) {
	if ($value === '') {
		render_response('Submission Failed', 'Please complete all required fields before submitting your application.', false);
		exit;
	}
}

if (!isset($_FILES['resume']) || !is_array($_FILES['resume'])) {
	render_response('Submission Failed', 'Resume upload is required.', false);
	exit;
}

$resume = $_FILES['resume'];
if (($resume['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
	render_response('Submission Failed', 'Unable to process the uploaded resume. Please try again.', false);
	exit;
}

$maxFileSize = 5 * 1024 * 1024;
if (($resume['size'] ?? 0) > $maxFileSize) {
	render_response('Submission Failed', 'Resume size exceeds the 5MB limit.', false);
	exit;
}

$tmpPath = (string)$resume['tmp_name'];
$originalName = (string)$resume['name'];
$safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $originalName) ?: 'resume';
$extension = strtolower((string)pathinfo($safeName, PATHINFO_EXTENSION));

$allowedExt = ['pdf', 'doc', 'docx'];
if (!in_array($extension, $allowedExt, true)) {
	render_response('Submission Failed', 'Invalid resume format. Allowed formats: PDF, DOC, DOCX.', false);
	exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = $finfo ? (string)finfo_file($finfo, $tmpPath) : '';
if ($finfo) {
	finfo_close($finfo);
}

$allowedMime = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/octet-stream'
];

if ($mimeType !== '' && !in_array($mimeType, $allowedMime, true)) {
	render_response('Submission Failed', 'Resume content type is not allowed.', false);
	exit;
}

$to = 'careers@sharpitco.com';
$subject = 'New Job Application';
$applicantName = $firstName . ' ' . $lastName;

$bodyText = "Applicant Name: {$applicantName}\n"
	. "Email: {$email}\n"
	. "Phone: {$phone}\n"
	. "Skills: {$skills}\n"
	. "Job Title: {$jobTitle}\n"
	. "Experience: {$experience}\n"
	. "Salary Expectation: {$salary}\n"
	. "Country: {$country}\n"
	. "State: {$state}\n"
	. "City: {$city}\n";

$boundary = '==Multipart_Boundary_x' . md5((string)microtime()) . 'x';

$headers = [];
$headers[] = 'From: Sharp Infotech Careers <careers@sharpitco.com>';
$headers[] = 'Reply-To: ' . $email;
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

$fileContent = file_get_contents($tmpPath);
if ($fileContent === false) {
	render_response('Submission Failed', 'Unable to read uploaded resume for email attachment.', false);
	exit;
}

$attachment = chunk_split(base64_encode($fileContent));

$message = '';
$message .= '--' . $boundary . "\r\n";
$message .= "Content-Type: text/plain; charset=UTF-8\r\n";
$message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
$message .= $bodyText . "\r\n";

$message .= '--' . $boundary . "\r\n";
$message .= 'Content-Type: ' . $mimeType . '; name="' . $safeName . '"' . "\r\n";
$message .= "Content-Transfer-Encoding: base64\r\n";
$message .= 'Content-Disposition: attachment; filename="' . $safeName . '"' . "\r\n\r\n";
$message .= $attachment . "\r\n";
$message .= '--' . $boundary . '--';

$sent = mail($to, $subject, $message, implode("\r\n", $headers));

if ($sent) {
	render_response('Application Submitted', 'Your application has been submitted successfully.', true);
	exit;
}

render_response('Submission Failed', 'Your application could not be sent at this time. Please try again later.', false);
