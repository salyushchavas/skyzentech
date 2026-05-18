<?php

session_start();

if(!isset($_SESSION['name'])){
header("Location:index.php");
exit();
}

$user=$_SESSION['name'];

?>