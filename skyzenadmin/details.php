<?php
require('../dbconn.php');
session_start();

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

$sl = $_SESSION['sl'] ?? '';

$query = "SELECT * FROM postings WHERE sl='$sl'";
$result = mysqli_query($conn,$query);

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
<td><?php echo $role; ?></td>
</tr>

<tr>
<th>Company</th>
<td><?php echo $company; ?></td>
</tr>

<tr>
<th>Location</th>
<td><?php echo $location; ?></td>
</tr>

<tr>
<th>Description</th>
<td><?php echo $description; ?></td>
</tr>

</table>

<br>

<center>
<a href="postings.php" class="btn btn-primary">Back</a>
</center>

</div>

</body>
</html>