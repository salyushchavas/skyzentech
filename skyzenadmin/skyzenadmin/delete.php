<?php
require('../dbconn.php');
require('auth.php');

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id <= 0) {
    die("Invalid ID");
}

$stmt = mysqli_prepare($conn, "DELETE FROM postings WHERE sl = ?");
mysqli_stmt_bind_param($stmt, "i", $id);

if (mysqli_stmt_execute($stmt)) {
    header("Location: postings.php?deleted=1");
    exit;
} else {
    echo "Delete failed: " . mysqli_error($conn);
}
?>