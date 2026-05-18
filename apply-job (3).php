<?php
require 'dbconn.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'PHPMailer-master/src/Exception.php';
require 'PHPMailer-master/src/PHPMailer.php';
require 'PHPMailer-master/src/SMTP.php';

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$role = 'Unknown Role';

$stmt = mysqli_prepare($conn, "SELECT role FROM postings WHERE sl = ?");
mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

if ($row = mysqli_fetch_assoc($result)) {
    $role = $row['role'];
} else {
    die("Invalid job posting.");
}

if (isset($_POST['submit'])) {
    $name   = trim($_POST['name'] ?? '');
    $email  = trim($_POST['email'] ?? '');
    $phone  = trim($_POST['phone'] ?? '');
    $degree = trim($_POST['degree'] ?? '');
    $exp    = trim($_POST['experience'] ?? '');

    if ($name === '' || $email === '' || $phone === '') {
        die("Please fill all required fields.");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        die("Invalid email address.");
    }

    if (!isset($_FILES['resume']) || $_FILES['resume']['error'] !== UPLOAD_ERR_OK) {
        die("Resume upload failed.");
    }

    $allowedExtensions = ['pdf', 'doc', 'docx'];
    $maxFileSize = 5 * 1024 * 1024; // 5 MB

    $resumeName = $_FILES['resume']['name'];
    $resumeTmp  = $_FILES['resume']['tmp_name'];
    $resumeSize = $_FILES['resume']['size'];

    $ext = strtolower(pathinfo($resumeName, PATHINFO_EXTENSION));

    if (!in_array($ext, $allowedExtensions)) {
        die("Only PDF, DOC, and DOCX files are allowed.");
    }

    if ($resumeSize > $maxFileSize) {
        die("Resume file is too large. Maximum allowed size is 5 MB.");
    }

    $uploadDir = __DIR__ . '/resume/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $safeFileName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($resumeName, PATHINFO_FILENAME)) . '.' . $ext;
    $uploadPath = $uploadDir . $safeFileName;

    if (!move_uploaded_file($resumeTmp, $uploadPath)) {
        die("Failed to save uploaded resume.");
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'careers@sharpitco.com';
        $mail->Password   = 'qxtzxwzmurpgxajt';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        $mail->setFrom('careers@sharpitco.com', 'Sharp IT Careers');
        $mail->addAddress('careers@sharpitco.com', 'HR Team');
        $mail->addReplyTo($email, $name);

        $mail->addAttachment($uploadPath, $resumeName);

        $mail->isHTML(true);
        $mail->Subject = "New Job Application - " . $role;

        $mail->Body = "
            <h3>New Job Application</h3>
            <p><strong>Job Role:</strong> " . htmlspecialchars($role) . "</p>
            <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
            <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
            <p><strong>Phone:</strong> " . htmlspecialchars($phone) . "</p>
            <p><strong>Degree:</strong> " . htmlspecialchars($degree) . "</p>
            <p><strong>Experience:</strong> " . htmlspecialchars($exp) . "</p>
        ";

        $mail->AltBody = "New Job Application\n\n"
            . "Job Role: $role\n"
            . "Name: $name\n"
            . "Email: $email\n"
            . "Phone: $phone\n"
            . "Degree: $degree\n"
            . "Experience: $exp\n";

        $mail->send();

        echo "<script>alert('Application sent successfully'); window.location.href='jobs.php';</script>";
        exit;
    } catch (Exception $e) {
        echo "Mailer Error: " . htmlspecialchars($mail->ErrorInfo);
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Apply Job</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body style="background:#f4f6f9">
<div class="container">
    <div style="max-width:600px;margin:auto;margin-top:60px;background:#fff;padding:30px;border-radius:8px">
        <h3>Apply for <?php echo htmlspecialchars($role); ?></h3>
        <hr>

        <form method="post" enctype="multipart/form-data">
            <div class="form-group">
                <label>Job Role</label>
                <input type="text" class="form-control" value="<?php echo htmlspecialchars($role); ?>" readonly>
            </div>

            <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" class="form-control" required>
            </div>

            <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" class="form-control" required>
            </div>

            <div class="form-group">
                <label>Phone</label>
                <input type="text" name="phone" class="form-control" required>
            </div>

            <div class="form-group">
                <label>Degree</label>
                <input type="text" name="degree" class="form-control">
            </div>

            <div class="form-group">
                <label>Experience</label>
                <input type="text" name="experience" class="form-control">
            </div>

            <div class="form-group">
                <label>Upload Resume</label>
                <input type="file" name="resume" class="form-control" accept=".pdf,.doc,.docx" required>
            </div>

            <button type="submit" name="submit" class="btn btn-success">Submit Application</button>
            <a href="jobs.php" class="btn btn-secondary">Back</a>
        </form>
    </div>
</div>
</body>
</html>