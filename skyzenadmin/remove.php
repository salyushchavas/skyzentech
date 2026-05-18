<?php
require('../dbconn.php');
require('auth.php');

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id <= 0) {
    die("Invalid ID");
}

// Fetch existing record
$stmt = mysqli_prepare($conn, "SELECT role, company, location, description FROM postings WHERE sl = ?");
mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($result);

if (!$row) {
    die("Job posting not found.");
}

if (isset($_POST['update'])) {
    $role     = trim($_POST['role'] ?? '');
    $company  = trim($_POST['company'] ?? '');
    $location = trim($_POST['location'] ?? '');
    $desc     = trim($_POST['description'] ?? '');

    $update = mysqli_prepare($conn, "UPDATE postings SET role = ?, company = ?, location = ?, description = ? WHERE sl = ?");
    mysqli_stmt_bind_param($update, "ssssi", $role, $company, $location, $desc, $id);

    if (mysqli_stmt_execute($update)) {
        header("Location: postings.php?updated=1");
        exit;
    } else {
        echo "Update failed: " . mysqli_error($conn);
    }
}
?>

<?php include('header.php'); ?>

<div class="container">
    <h3>Edit Job</h3>

    <form method="post">
        <div class="mb-3">
            <label>Role</label>
            <input type="text" name="role" class="form-control" value="<?php echo htmlspecialchars($row['role']); ?>" required>
        </div>

        <div class="mb-3">
            <label>Company</label>
            <input type="text" name="company" class="form-control" value="<?php echo htmlspecialchars($row['company']); ?>" required>
        </div>

        <div class="mb-3">
            <label>Location</label>
            <input type="text" name="location" class="form-control" value="<?php echo htmlspecialchars($row['location']); ?>" required>
        </div>

        <div class="mb-3">
            <label>Description</label>
            <textarea name="description" class="form-control" rows="6" required><?php echo htmlspecialchars($row['description']); ?></textarea>
        </div>

        <button type="submit" name="update" class="btn btn-primary">Update</button>
    </form>
</div>