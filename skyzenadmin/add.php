<?php
session_start();
require('../dbconn.php');

$user = $_SESSION['name'] ?? '';
if ($user === '') {
    session_destroy();
    header("refresh:3;url=index.php");
    exit();
}

$success = false;
$error   = '';

if (isset($_POST['submit'])) {
    $role     = trim($_POST['f_role']    ?? '');
    $company  = trim($_POST['f_company'] ?? '');
    $location = trim($_POST['f_loc']     ?? '');
    $desc     = trim($_POST['f_desc']    ?? '');

    if ($role && $company && $location && $desc) {
        $stmt = $conn->prepare("INSERT INTO postings (role, company, location, description) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $role, $company, $location, $desc);
        if ($stmt->execute()) {
            $success = true;
        } else {
            $error = 'Database error. Please try again.';
        }
    } else {
        $error = 'All fields are required.';
    }
}
?>
<?php include('header.php'); ?>

<div class="row justify-content-center">
<div class="col-lg-8">
    <div class="content-card">
        <div class="card-header-row">
            <h5><i class="fa-solid fa-circle-plus me-2" style="color:#fb9b47;"></i>Add New Job Posting</h5>
            <a href="postings.php" class="btn btn-sm btn-outline-secondary">
                <i class="fa-solid fa-arrow-left me-1"></i>Back
            </a>
        </div>

        <?php if ($success): ?>
            <div style="text-align:center; padding: 30px 0;">
                <i class="fa-solid fa-circle-check" style="font-size:56px; color:#198754; display:block; margin-bottom:16px;"></i>
                <h5 style="color:#0f2742; font-weight:700;">Job Posted Successfully!</h5>
                <p style="color:#6b7280; margin-bottom:24px;">The new job posting is now live on the website.</p>
                <a href="add.php" class="btn btn-skyzen me-2 px-4">Add Another</a>
                <a href="postings.php" class="btn btn-outline-secondary px-4">View All Jobs</a>
            </div>
        <?php else: ?>

            <?php if ($error): ?>
                <div style="background:#fef2f2; border-left:4px solid #dc3545; border-radius:8px; padding:12px 16px; margin-bottom:20px; color:#b91c1c; font-size:14px;">
                    <i class="fa-solid fa-circle-xmark me-2"></i><?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>

            <form method="POST" id="addForm" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Job Title <span style="color:#dc3545;">*</span></label>
                        <input type="text" name="f_role" class="form-control" placeholder="e.g. Java Developer"
                            value="<?php echo htmlspecialchars($_POST['f_role'] ?? ''); ?>" required>
                        <div class="invalid-feedback">Please enter a job title.</div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Company <span style="color:#dc3545;">*</span></label>
                        <input type="text" name="f_company" class="form-control" placeholder="e.g. Skyzen Technologies"
                            value="<?php echo htmlspecialchars($_POST['f_company'] ?? ''); ?>" required>
                        <div class="invalid-feedback">Please enter the company name.</div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label">Location <span style="color:#dc3545;">*</span></label>
                    <input type="text" name="f_loc" class="form-control" placeholder="e.g. Plano, TX (Remote)"
                        value="<?php echo htmlspecialchars($_POST['f_loc'] ?? ''); ?>" required>
                    <div class="invalid-feedback">Please enter the location.</div>
                </div>

                <div class="mb-4">
                    <label class="form-label">Job Description <span style="color:#dc3545;">*</span></label>
                    <textarea name="f_desc" class="form-control" rows="10" required
                        placeholder="Enter the full job description. Use line breaks for formatting."
                        style="height:auto; white-space:pre-wrap; resize:vertical;"><?php echo htmlspecialchars($_POST['f_desc'] ?? ''); ?></textarea>
                    <div class="invalid-feedback">Please enter the job description.</div>
                    <div style="font-size:12px; color:#8a9ab0; margin-top:6px;">
                        <i class="fa-solid fa-circle-info me-1"></i>Line breaks will be preserved on the live website.
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" name="submit" class="btn btn-skyzen px-5">
                        <i class="fa-solid fa-paper-plane me-2"></i>Post Job
                    </button>
                    <a href="postings.php" class="btn btn-outline-secondary px-4">Cancel</a>
                </div>
            </form>

            <script>
            document.getElementById('addForm').addEventListener('submit', function(e) {
                if (!this.checkValidity()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.classList.add('was-validated');
                }
            });
            </script>
        <?php endif; ?>
    </div>
</div>
</div>

</div></div></div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
