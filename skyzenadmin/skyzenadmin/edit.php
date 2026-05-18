<?php
require('../dbconn.php');
require('auth.php');

$id = isset($_GET['id']) && is_numeric($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) { header("Location: postings.php"); exit(); }

$stmt = mysqli_prepare($conn, "SELECT role, company, location, description FROM postings WHERE sl = ?");
mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($result);
if (!$row) { header("Location: postings.php"); exit(); }

$success = false;
$error   = '';

if (isset($_POST['update'])) {
    $role     = trim($_POST['role']        ?? '');
    $company  = trim($_POST['company']     ?? '');
    $location = trim($_POST['location']    ?? '');
    $desc     = trim($_POST['description'] ?? '');

    if ($role && $company && $location && $desc) {
        $upd = mysqli_prepare($conn, "UPDATE postings SET role=?, company=?, location=?, description=? WHERE sl=?");
        mysqli_stmt_bind_param($upd, "ssssi", $role, $company, $location, $desc, $id);
        if (mysqli_stmt_execute($upd)) {
            $row = ['role'=>$role,'company'=>$company,'location'=>$location,'description'=>$desc];
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
            <h5><i class="fa-solid fa-pen me-2" style="color:#fb9b47;"></i>Edit Job Posting <span style="color:#8a9ab0; font-size:13px; font-weight:400;">#<?php echo $id; ?></span></h5>
            <a href="postings.php" class="btn btn-sm btn-outline-secondary">
                <i class="fa-solid fa-arrow-left me-1"></i>Back
            </a>
        </div>

        <?php if ($success): ?>
            <div style="background:#f0fdf4; border-left:4px solid #198754; border-radius:8px; padding:14px 18px; margin-bottom:20px; color:#166534; font-size:14px;">
                <i class="fa-solid fa-circle-check me-2"></i>Job updated successfully! <a href="postings.php" style="color:#166534; font-weight:600; margin-left:8px;">View all jobs →</a>
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div style="background:#fef2f2; border-left:4px solid #dc3545; border-radius:8px; padding:12px 16px; margin-bottom:20px; color:#b91c1c; font-size:14px;">
                <i class="fa-solid fa-circle-xmark me-2"></i><?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <form method="POST" id="editForm" novalidate>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Job Title <span style="color:#dc3545;">*</span></label>
                    <input type="text" name="role" class="form-control"
                        value="<?php echo htmlspecialchars($row['role']); ?>" required>
                    <div class="invalid-feedback">Please enter a job title.</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Company <span style="color:#dc3545;">*</span></label>
                    <input type="text" name="company" class="form-control"
                        value="<?php echo htmlspecialchars($row['company']); ?>" required>
                    <div class="invalid-feedback">Please enter the company name.</div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Location <span style="color:#dc3545;">*</span></label>
                <input type="text" name="location" class="form-control"
                    value="<?php echo htmlspecialchars($row['location']); ?>" required>
                <div class="invalid-feedback">Please enter the location.</div>
            </div>

            <div class="mb-4">
                <label class="form-label">Job Description <span style="color:#dc3545;">*</span></label>
                <textarea name="description" class="form-control" rows="10" required
                    style="height:auto; white-space:pre-wrap; resize:vertical;"><?php echo htmlspecialchars($row['description']); ?></textarea>
                <div class="invalid-feedback">Please enter the job description.</div>
            </div>

            <div class="d-flex gap-2">
                <button type="submit" name="update" class="btn btn-skyzen px-5">
                    <i class="fa-solid fa-floppy-disk me-2"></i>Save Changes
                </button>
                <a href="postings.php" class="btn btn-outline-secondary px-4">Cancel</a>
            </div>
        </form>
    </div>
</div>
</div>

</div></div></div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>
document.getElementById('editForm').addEventListener('submit', function(e) {
    if (!this.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('was-validated');
    }
});
</script>
</body>
</html>
