<?php
require('../dbconn.php');
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$user = $_SESSION['name'] ?? '';

if($user == "")
{
    session_destroy();
    header("Location: index.php");
    exit();
}

if(isset($_POST['close']))
{
    session_destroy();
    header("Location: index.php");
    exit();
}

$sl = isset($_SESSION['sl']) ? (int)$_SESSION['sl'] : 0;

$stmt = mysqli_prepare($conn, "SELECT * FROM postings WHERE sl = ?");
mysqli_stmt_bind_param($stmt, "i", $sl);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$row = mysqli_fetch_assoc($result);

$role = $row['role'];
$company = $row['company'];
$location = $row['location'];
$description = $row['description'];
?>

<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="utf-8">
<title>Sharp Infotech Admin Panel</title>

<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css">

</head>

<body>

<div class="container">

<h2 align="center">Job Details</h2>

<table class="table table-bordered" style="width:70%; margin:auto">

<tr>
<th>Job Title</th>
<td><?php echo htmlspecialchars($role); ?></td>
</tr>

<tr>
<th>Company</th>
<td><?php echo htmlspecialchars($company); ?></td>
</tr>

<tr>
<th>Location</th>
<td><?php echo htmlspecialchars($location); ?></td>
</tr>

<tr>
<th>Description</th>
<td><?php echo htmlspecialchars($description); ?></td>
</tr>

</table>

<br>

<center>
<a href="postings.php" class="btn btn-primary">Back</a>
</center>

</div>

</body>
</html>