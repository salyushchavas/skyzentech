<?php
require('dbconn.php');

$job = null;
$id  = isset($_GET['id']) && is_numeric($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id > 0) {
    $stmt = $conn->prepare("SELECT sl, role, company, location FROM postings WHERE sl = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $job = $stmt->get_result()->fetch_assoc();
}

$success = false;
$error   = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $job) {
    $name     = trim($_POST['name']     ?? '');
    $email    = trim($_POST['email']    ?? '');
    $phone    = trim($_POST['phone']    ?? '');
    $linkedin = trim($_POST['linkedin'] ?? '');
    $message  = trim($_POST['message']  ?? '');
    $consent  = isset($_POST['consent']);

    // Validation
    if ($name === '' || $email === '' || $message === '') {
        $error = 'Please fill in all required fields.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Please enter a valid email address.';
    } elseif (!$consent) {
        $error = 'You must agree to the consent statement before submitting.';
    } else {
        // Resume upload handling
        $resumeData     = null;
        $resumeName     = null;
        $resumeMime     = null;
        $allowedTypes   = ['application/pdf', 'application/msword',
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        $allowedExts    = ['pdf', 'doc', 'docx'];
        $maxSize        = 5 * 1024 * 1024; // 5 MB

        if (!empty($_FILES['resume']['name'])) {
            $file     = $_FILES['resume'];
            $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $fsize    = $file['size'];
            $ftype    = $file['type'];

            if ($file['error'] !== UPLOAD_ERR_OK) {
                $error = 'Resume upload failed. Please try again.';
            } elseif (!in_array($ext, $allowedExts)) {
                $error = 'Invalid file type. Only PDF, DOC, and DOCX are allowed.';
            } elseif ($fsize > $maxSize) {
                $error = 'Resume file is too large. Maximum allowed size is 5 MB.';
            } else {
                $resumeData = file_get_contents($file['tmp_name']);
                $resumeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);
                $resumeMime = $ftype;
            }
        }

        if ($error === '') {
            // Build email
            $to      = 'info@skyzentech.com';
            $subject = 'Job Application: ' . $job['role'] . ' — ' . $name;
            $boundary = '----=_Part_' . md5(uniqid('', true));

            $textBody = "New Job Application Received\n"
                      . str_repeat("=", 40) . "\n\n"
                      . "Position  : " . $job['role']     . "\n"
                      . "Company   : " . $job['company']  . "\n"
                      . "Location  : " . $job['location'] . "\n\n"
                      . str_repeat("-", 40) . "\n"
                      . "Applicant Details\n"
                      . str_repeat("-", 40) . "\n"
                      . "Name      : $name\n"
                      . "Email     : $email\n"
                      . "Phone     : " . ($phone    ?: 'Not provided') . "\n"
                      . "LinkedIn  : " . ($linkedin ?: 'Not provided') . "\n"
                      . "Resume    : " . ($resumeName ? $resumeName . ' (attached)' : 'Not provided') . "\n\n"
                      . str_repeat("-", 40) . "\n"
                      . "Cover Letter / Message\n"
                      . str_repeat("-", 40) . "\n"
                      . $message . "\n";

            $headers  = "From: noreply@skyzentech.com\r\n";
            $headers .= "Reply-To: $email\r\n";
            $headers .= "MIME-Version: 1.0\r\n";

            if ($resumeData) {
                // Multipart email with attachment
                $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

                $body  = "--$boundary\r\n";
                $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
                $body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
                $body .= $textBody . "\r\n\r\n";

                $body .= "--$boundary\r\n";
                $body .= "Content-Type: $resumeMime; name=\"$resumeName\"\r\n";
                $body .= "Content-Transfer-Encoding: base64\r\n";
                $body .= "Content-Disposition: attachment; filename=\"$resumeName\"\r\n\r\n";
                $body .= chunk_split(base64_encode($resumeData)) . "\r\n";
                $body .= "--$boundary--";
            } else {
                // Plain text email
                $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
                $body = $textBody;
            }

            if (mail($to, $subject, $body, $headers)) {
                $success = true;
            } else {
                $error = 'Failed to send your application. Please email us directly at info@skyzentech.com';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Apply<?php echo $job ? ' – ' . htmlspecialchars($job['role']) : ''; ?> | Skyzen Technologies LLC</title>
    <link rel="shortcut icon" href="/images/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="plugins/bootstrap/css/bootstrap.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="plugins/icofont/icofont.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .apply-wrap { padding: 120px 0 70px; background: #f4f6f9; min-height: 80vh; }
        .apply-card {
            background: #fff; border-radius: 14px; padding: 45px;
            box-shadow: 0 6px 28px rgba(0,0,0,0.08);
            max-width: 780px; margin: 0 auto;
        }
        .apply-card h2 { font-size: 28px; font-weight: 700; color: #0f2238; margin-bottom: 6px; }
        .job-badge {
            display: flex; flex-wrap: wrap; gap: 10px;
            background: #eef5fb; border-radius: 10px;
            padding: 12px 18px; margin-bottom: 28px;
        }
        .job-badge span { font-size: 14px; color: #0f2238; font-weight: 500; }
        .job-badge i { color: #fb9b47; margin-right: 5px; }
        .form-label { font-weight: 500; color: #0f2238; margin-bottom: 6px; }
        .form-group { margin-bottom: 20px; }
        .required-star { color: #fb9b47; }

        /* Resume upload */
        .resume-drop {
            border: 2px dashed #d1d5db;
            border-radius: 12px; padding: 30px 20px;
            text-align: center; cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
            background: #fafafa; position: relative;
        }
        .resume-drop:hover, .resume-drop.dragover {
            border-color: #fb9b47; background: #fff7f0;
        }
        .resume-drop input[type="file"] {
            position: absolute; inset: 0; opacity: 0;
            cursor: pointer; width: 100%; height: 100%;
        }
        .resume-drop .drop-icon { font-size: 38px; color: #d1d5db; margin-bottom: 10px; display: block; }
        .resume-drop .drop-icon.active { color: #fb9b47; }
        .resume-drop p { margin: 0; font-size: 14px; color: #6b7280; }
        .resume-drop strong { color: #0f2238; }
        .resume-drop .file-types { font-size: 12px; color: #9ca3af; margin-top: 6px; }
        .file-chosen {
            display: none; margin-top: 12px;
            background: #f0fdf4; border: 1px solid #86efac;
            border-radius: 8px; padding: 10px 14px;
            font-size: 13px; color: #166534;
            align-items: center; gap: 8px;
        }
        .file-chosen.show { display: flex; }
        .file-chosen .remove-file { margin-left: auto; cursor: pointer; color: #dc3545; background: none; border: none; font-size: 15px; }

        /* Consent checkbox */
        .consent-wrap {
            border: 1.5px solid #e5e7eb; border-radius: 10px;
            padding: 14px 16px; margin-bottom: 22px;
            transition: border-color 0.2s;
        }
        .consent-wrap:has(input:checked) { border-color: #fb9b47; background: #fff7f0; }
        .consent-wrap label {
            display: flex; align-items: flex-start; gap: 12px;
            cursor: pointer; margin: 0;
        }
        .consent-wrap input[type="checkbox"] {
            width: 18px; height: 18px; flex-shrink: 0;
            margin-top: 2px; accent-color: #fb9b47; cursor: pointer;
        }
        .consent-wrap .consent-text { font-size: 13px; color: #4b5563; line-height: 1.6; }
        .consent-wrap .consent-text a { color: #fb9b47; }

        .btn-apply {
            background: #fb9b47; color: #fff; border: none;
            padding: 12px 36px; border-radius: 30px;
            font-weight: 600; font-size: 15px;
            transition: background 0.3s; cursor: pointer;
        }
        .btn-apply:hover { background: #e0862f; color: #fff; }
        .btn-apply:disabled { background: #d1d5db; cursor: not-allowed; }

        .success-box { text-align: center; padding: 40px 20px; }
        .success-box .success-icon { font-size: 64px; color: #28a745; display: block; margin-bottom: 20px; }
        .success-box h4 { color: #0f2238; margin-bottom: 12px; }

        .alert-skyzen {
            background: #fff3e0; border-left: 4px solid #fb9b47;
            color: #7a4a00; border-radius: 6px;
            padding: 12px 18px; margin-bottom: 20px; font-size: 14px;
        }
        .alert-skyzen.error {
            background: #fef2f2; border-left-color: #dc3545; color: #b91c1c;
        }
    </style>
</head>
<body>

<!-- Header -->
<header>
    <div class="header-top-bar">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-7">
                    <ul class="top-bar-info list-inline-item pl-0 mb-0">
                        <li class="list-inline-item"><a href="mailto:info@skyzentech.com"><i class="icofont-email mr-2"></i>info@skyzentech.com</a></li>
                        <li class="list-inline-item"><i class="icofont-phone mr-2"></i><a href="tel:4699453339">+1 469-945-3339</a></li>
                    </ul>
                </div>
                <div class="col-lg-5">
                    <ul class="list-inline footer-socials text-right" style="margin:0;">
                        <li class="list-inline-item"><a href="https://www.linkedin.com/company/skyzen-tech-llc/" target="_blank"><i class="icofont-linkedin"></i></a></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <nav class="navbar navbar-expand-lg navigation" id="navbar">
        <div class="container">
            <a class="navbar-brand" href="index.html">
                <img src="images/skyzen-logo.png" alt="Skyzen Logo">
            </a>
            <button class="navbar-toggler collapsed" type="button" data-toggle="collapse" data-target="#navbarmain" aria-controls="navbarmain" aria-expanded="false" aria-label="Toggle navigation">
                <span class="icofont-navigation-menu"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarmain">
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item"><a class="nav-link" href="index.html">HOME</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#what-we-do-block">WHAT WE DO?</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#why-we">WHY WE?</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#our-expertise-block">OUR EXPERTISE</a></li>
                    <li class="nav-item active"><a class="nav-link" href="jobs.php">CAREER SUPPORT</a></li>
                    <li class="nav-item">
                        <a href="index.html#contact" class="btn btn-main btn-round-full" style="margin-left:15px;">CONTACT US</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
</header>

<section class="apply-wrap">
    <div class="container">
        <div class="apply-card">

            <?php if (!$job): ?>
                <div class="text-center py-4">
                    <i class="icofont-warning" style="font-size:50px; color:#fb9b47; display:block; margin-bottom:16px;"></i>
                    <h4 style="color:#0f2238;">Invalid Job Posting</h4>
                    <p>This job could not be found. Please browse available openings.</p>
                    <a href="jobs.php" class="btn btn-main btn-round-full mt-3">Browse Jobs</a>
                </div>

            <?php elseif ($success): ?>
                <div class="success-box">
                    <i class="icofont-check-circled success-icon"></i>
                    <h4>Application Submitted!</h4>
                    <p>Thank you for applying for <strong><?php echo htmlspecialchars($job['role']); ?></strong>.<br>
                    Our team will review your application and get back to you soon at <strong><?php echo htmlspecialchars($_POST['email'] ?? ''); ?></strong>.</p>
                    <a href="jobs.php" class="btn btn-main btn-round-full mt-3">Browse More Jobs</a>
                </div>

            <?php else: ?>
                <h2>Apply for this Position</h2>
                <div class="divider my-3"></div>

                <div class="job-badge">
                    <span><i class="icofont-briefcase"></i><?php echo htmlspecialchars($job['role']); ?></span>
                    <span><i class="icofont-building-alt"></i><?php echo htmlspecialchars($job['company']); ?></span>
                    <span><i class="icofont-location-pin"></i><?php echo htmlspecialchars($job['location']); ?></span>
                </div>

                <?php if ($error): ?>
                    <div class="alert-skyzen error">
                        <i class="icofont-warning-alt" style="margin-right:6px;"></i><?php echo htmlspecialchars($error); ?>
                    </div>
                <?php endif; ?>

                <form method="POST" enctype="multipart/form-data" id="applyForm">

                    <!-- Name -->
                    <div class="form-group">
                        <label class="form-label">Full Name <span class="required-star">*</span></label>
                        <input type="text" name="name" class="form-control"
                            placeholder="Your full name"
                            value="<?php echo htmlspecialchars($_POST['name'] ?? ''); ?>" required>
                    </div>

                    <!-- Email + Phone -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="form-label">Email Address <span class="required-star">*</span></label>
                                <input type="email" name="email" class="form-control"
                                    placeholder="you@example.com"
                                    value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="form-label">Phone Number</label>
                                <input type="tel" name="phone" class="form-control"
                                    placeholder="+1 (___) ___-____"
                                    value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>">
                            </div>
                        </div>
                    </div>

                    <!-- LinkedIn -->
                    <div class="form-group">
                        <label class="form-label">LinkedIn Profile URL</label>
                        <input type="text" name="linkedin" class="form-control"
                            placeholder="https://linkedin.com/in/yourprofile"
                            value="<?php echo htmlspecialchars($_POST['linkedin'] ?? ''); ?>">
                    </div>

                    <!-- Resume Upload -->
                    <div class="form-group">
                        <label class="form-label">Resume / CV</label>
                        <div class="resume-drop" id="resumeDrop">
                            <input type="file" name="resume" id="resumeInput" accept=".pdf,.doc,.docx">
                            <i class="icofont-upload-alt drop-icon" id="dropIcon"></i>
                            <p><strong>Click to upload</strong> or drag and drop your resume</p>
                            <p class="file-types">PDF, DOC, DOCX &nbsp;·&nbsp; Max 5 MB</p>
                        </div>
                        <div class="file-chosen" id="fileChosen">
                            <i class="icofont-file-document" style="font-size:18px; color:#fb9b47;"></i>
                            <span id="fileName"></span>
                            <button type="button" class="remove-file" id="removeFile" title="Remove file">
                                <i class="icofont-close-circled"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Cover Letter -->
                    <div class="form-group">
                        <label class="form-label">Cover Letter / Message <span class="required-star">*</span></label>
                        <textarea name="message" class="form-control" rows="6" required
                            placeholder="Tell us about yourself and why you're a great fit for this role..."
                            style="height:auto;"><?php echo htmlspecialchars($_POST['message'] ?? ''); ?></textarea>
                    </div>

                    <!-- Consent Checkbox -->
                    <div class="consent-wrap">
                        <label>
                            <input type="checkbox" name="consent" id="consentBox" <?php echo isset($_POST['consent']) ? 'checked' : ''; ?>>
                            <span class="consent-text">
                                By submitting this form you agree to be contacted by Skyzen Technologies LLC regarding your application.
                                Message and data rates may apply. You can opt out at any time by replying "STOP".
                                See our <a href="privacy-policy.html">Privacy Policy</a>.
                            </span>
                        </label>
                    </div>

                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <button type="submit" class="btn-apply" id="submitBtn" disabled>
                            <i class="icofont-paper-plane" style="margin-right:6px;"></i>Submit Application
                        </button>
                        <a href="job-details.php?id=<?php echo $job['sl']; ?>"
                            class="btn btn-outline-secondary"
                            style="border-radius:30px; padding:10px 24px;">
                            View Job Details
                        </a>
                    </div>

                </form>
            <?php endif; ?>
        </div>
    </div>
</section>

<!-- Footer -->
<div class="page-end-copyright">
    <span>&copy; Copyright Reserved to <span class="text-color">Skyzen</span></span>
    <span class="page-end-separator">|</span>
    <a href="privacy-policy.html">Privacy Policy</a>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
<script src="plugins/bootstrap/js/bootstrap.min.js"></script>
<script src="js/script.js"></script>
<script>
// Sticky header
$(window).scroll(function(){
    $('header').toggleClass('header-fixed', $(this).scrollTop() > 50);
});

// Enable submit only when consent is checked
const consentBox = document.getElementById('consentBox');
const submitBtn  = document.getElementById('submitBtn');
function toggleSubmit() {
    submitBtn.disabled = !consentBox.checked;
}
consentBox.addEventListener('change', toggleSubmit);
toggleSubmit(); // run on load

// Resume drag & drop + file picker
const resumeInput = document.getElementById('resumeInput');
const resumeDrop  = document.getElementById('resumeDrop');
const fileChosen  = document.getElementById('fileChosen');
const fileName    = document.getElementById('fileName');
const dropIcon    = document.getElementById('dropIcon');
const removeFile  = document.getElementById('removeFile');

resumeInput.addEventListener('change', function() {
    if (this.files.length > 0) showFile(this.files[0]);
});

resumeDrop.addEventListener('dragover', function(e) {
    e.preventDefault(); this.classList.add('dragover');
});
resumeDrop.addEventListener('dragleave', function() {
    this.classList.remove('dragover');
});
resumeDrop.addEventListener('drop', function(e) {
    e.preventDefault(); this.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        resumeInput.files = dt.files;
        showFile(file);
    }
});

function showFile(file) {
    const allowed = ['pdf','doc','docx'];
    const ext = file.name.split('.').pop().toLowerCase();
    const maxSize = 5 * 1024 * 1024;

    if (!allowed.includes(ext)) {
        alert('Invalid file type. Please upload PDF, DOC, or DOCX only.');
        resumeInput.value = '';
        return;
    }
    if (file.size > maxSize) {
        alert('File too large. Maximum size is 5 MB.');
        resumeInput.value = '';
        return;
    }
    fileName.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    fileChosen.classList.add('show');
    dropIcon.classList.add('active');
}

removeFile.addEventListener('click', function() {
    resumeInput.value = '';
    fileChosen.classList.remove('show');
    dropIcon.classList.remove('active');
    fileName.textContent = '';
});
</script>
</body>
</html>
