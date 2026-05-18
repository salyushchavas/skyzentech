<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if(!isset($_SESSION['name'])){
    header("Location:index.php");
    exit();
}

$user = $_SESSION['name'];
$role = $_SESSION['role'] ?? 'user';

?>