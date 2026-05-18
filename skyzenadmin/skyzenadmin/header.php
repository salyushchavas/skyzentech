<?php require('auth.php'); ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skyzen Admin</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f0f2f5; margin: 0; }

/* Sidebar */
.sidebar {
    position: fixed; top: 0; left: 0;
    width: 240px; height: 100vh;
    background: #0f2742;
    display: flex; flex-direction: column;
    z-index: 1000;
    transition: width 0.3s ease;
    box-shadow: 4px 0 20px rgba(0,0,0,0.15);
}
.sidebar-brand {
    padding: 22px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; gap: 12px;
}
.sidebar-brand .brand-icon {
    width: 38px; height: 38px;
    background: #fb9b47;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #fff; font-weight: 700; flex-shrink: 0;
}
.sidebar-brand span { color: #fff; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }
.sidebar-brand small { display: block; color: #8aabcc; font-size: 11px; font-weight: 400; }

.sidebar-nav { padding: 16px 12px; flex: 1; overflow-y: auto; }
.nav-label {
    font-size: 10px; font-weight: 600; letter-spacing: 1.2px;
    color: #4a7099; text-transform: uppercase;
    padding: 12px 8px 6px; margin-top: 4px;
}
.sidebar-nav a {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 10px;
    color: #a8c8e8; text-decoration: none;
    font-size: 14px; font-weight: 500;
    transition: all 0.2s ease; margin-bottom: 3px;
}
.sidebar-nav a i { width: 18px; text-align: center; font-size: 15px; }
.sidebar-nav a:hover { background: rgba(255,255,255,0.08); color: #fff; }
.sidebar-nav a.active { background: #fb9b47; color: #fff; box-shadow: 0 4px 14px rgba(251,155,71,0.35); }
.sidebar-nav a.active i { color: #fff; }

.sidebar-footer {
    padding: 16px 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.sidebar-footer a {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 10px;
    color: #a8c8e8; text-decoration: none;
    font-size: 14px; font-weight: 500;
    transition: all 0.2s;
}
.sidebar-footer a:hover { background: rgba(220,53,69,0.15); color: #ff6b6b; }

/* Main content */
.main-content { margin-left: 240px; min-height: 100vh; }

/* Topbar */
.topbar {
    background: #fff;
    padding: 14px 28px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    position: sticky; top: 0; z-index: 900;
}
.topbar-title { font-size: 18px; font-weight: 700; color: #0f2742; margin: 0; }
.topbar-title small { display: block; font-size: 12px; font-weight: 400; color: #8a9ab0; margin-top: 1px; }
.user-badge {
    display: flex; align-items: center; gap: 10px;
    background: #f0f2f5; border-radius: 30px; padding: 6px 16px 6px 6px;
}
.user-avatar {
    width: 32px; height: 32px; background: #0f2742;
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; color: #fb9b47; font-size: 13px; font-weight: 700;
}
.user-badge span { font-size: 13px; font-weight: 600; color: #0f2742; }

/* Page content */
.page-content { padding: 28px; }

/* Cards */
.stat-card {
    border-radius: 16px; padding: 24px;
    color: #fff; position: relative; overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    margin-bottom: 24px;
}
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(0,0,0,0.15); }
.stat-card .card-icon {
    position: absolute; right: 20px; top: 50%;
    transform: translateY(-50%);
    font-size: 52px; opacity: 0.15;
}
.stat-card h6 { font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 10px; }
.stat-card h2 { font-size: 40px; font-weight: 700; margin: 0; }
.stat-card p { font-size: 12px; margin: 8px 0 0; opacity: 0.7; }

.card-blue   { background: linear-gradient(135deg, #0d6efd, #0a58ca); }
.card-green  { background: linear-gradient(135deg, #198754, #146c43); }
.card-orange { background: linear-gradient(135deg, #fb9b47, #e0862f); }
.card-dark   { background: linear-gradient(135deg, #0f2742, #1a3d60); }

/* Content cards */
.content-card {
    background: #fff; border-radius: 16px;
    padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    margin-bottom: 24px;
}
.content-card .card-header-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
}
.content-card h5 {
    font-size: 16px; font-weight: 700; color: #0f2742; margin: 0;
}

/* Table */
.admin-table { border-collapse: separate; border-spacing: 0; width: 100%; }
.admin-table thead th {
    background: #0f2742; color: #fff;
    padding: 12px 16px; font-size: 12px;
    font-weight: 600; letter-spacing: 0.5px; border: none;
}
.admin-table thead th:first-child { border-radius: 10px 0 0 0; }
.admin-table thead th:last-child { border-radius: 0 10px 0 0; }
.admin-table tbody tr { transition: background 0.15s; }
.admin-table tbody tr:hover { background: #f8fafd; }
.admin-table tbody td {
    padding: 13px 16px; border-bottom: 1px solid #f0f2f5;
    font-size: 14px; color: #374151; vertical-align: middle;
}
.admin-table tbody tr:last-child td { border-bottom: none; }

/* Badges */
.role-badge {
    display: inline-block; background: #eef5fb;
    color: #0f2742; border-radius: 6px;
    padding: 3px 10px; font-size: 13px; font-weight: 500;
}

/* Buttons */
.btn-skyzen { background: #fb9b47; color: #fff; border: none; border-radius: 8px; font-weight: 600; }
.btn-skyzen:hover { background: #e0862f; color: #fff; }
.btn-icon { width: 34px; height: 34px; border-radius: 8px; border: none; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; cursor: pointer; }
.btn-edit  { background: #eef5fb; color: #0d6efd; }
.btn-edit:hover  { background: #0d6efd; color: #fff; }
.btn-del   { background: #fef2f2; color: #dc3545; }
.btn-del:hover   { background: #dc3545; color: #fff; }

/* Form */
.form-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.form-control, .form-select {
    border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 10px 14px; font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #fafafa;
}
.form-control:focus, .form-select:focus {
    border-color: #fb9b47; box-shadow: 0 0 0 3px rgba(251,155,71,0.15);
    background: #fff; outline: none;
}
.form-control.is-invalid { border-color: #dc3545; }

/* Search */
.search-wrap { position: relative; }
.search-wrap input { padding-left: 38px; }
.search-wrap .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #8a9ab0; font-size: 14px; }

/* Quick action btn */
.quick-action {
    display: flex; align-items: center; gap: 14px;
    background: #f8fafd; border: 1.5px solid #e5e7eb;
    border-radius: 12px; padding: 16px 20px;
    text-decoration: none; color: #0f2742;
    transition: all 0.2s; margin-bottom: 12px;
}
.quick-action:hover { border-color: #fb9b47; background: #fff7f0; color: #fb9b47; box-shadow: 0 4px 14px rgba(251,155,71,0.15); }
.quick-action .qa-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.quick-action .qa-text strong { display: block; font-size: 14px; font-weight: 600; }
.quick-action .qa-text span { font-size: 12px; color: #8a9ab0; }

/* Toast */
.toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999; }
.toast-msg {
    background: #fff; border-radius: 12px; padding: 14px 18px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.12);
    display: flex; align-items: center; gap: 12px;
    min-width: 280px; animation: slideIn 0.3s ease;
    border-left: 4px solid #198754;
}
.toast-msg.error { border-left-color: #dc3545; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }

/* Delete modal */
.confirm-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.5); z-index: 9000;
    align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
}
.confirm-overlay.show { display: flex; }
.confirm-box {
    background: #fff; border-radius: 20px; padding: 36px;
    text-align: center; max-width: 380px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: popIn 0.25s ease;
}
@keyframes popIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.confirm-box .confirm-icon { font-size: 52px; color: #dc3545; margin-bottom: 16px; }
.confirm-box h5 { font-weight: 700; color: #0f2742; margin-bottom: 8px; }
.confirm-box p { color: #6b7280; font-size: 14px; margin-bottom: 24px; }

/* Responsive */
@media (max-width: 768px) {
    .sidebar { width: 60px; }
    .sidebar-brand span, .sidebar-brand small, .sidebar-nav a span, .nav-label, .sidebar-footer a span { display: none; }
    .sidebar-nav a { justify-content: center; padding: 12px; }
    .sidebar-nav a i { width: auto; }
    .main-content { margin-left: 60px; }
}
</style>
</head>
<body>

<!-- Delete confirmation overlay -->
<div class="confirm-overlay" id="deleteOverlay">
    <div class="confirm-box">
        <div class="confirm-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h5>Delete Job Posting?</h5>
        <p>This action cannot be undone. The job will be permanently removed.</p>
        <a id="confirmDeleteBtn" href="#" class="btn btn-danger px-4 me-2">Yes, Delete</a>
        <button onclick="document.getElementById('deleteOverlay').classList.remove('show')" class="btn btn-outline-secondary px-4">Cancel</button>
    </div>
</div>

<!-- Toast container -->
<div class="toast-container" id="toastContainer"></div>

<div class="d-flex">
<!-- Sidebar -->
<nav class="sidebar">
    <div class="sidebar-brand">
        <div class="brand-icon">S</div>
        <div>
            <span>Skyzen</span>
            <small>Admin Panel</small>
        </div>
    </div>

    <div class="sidebar-nav">
        <div class="nav-label">Main</div>
        <a href="admin.php" <?php if(basename($_SERVER['PHP_SELF'])=='admin.php') echo 'class="active"'; ?>>
            <i class="fa-solid fa-gauge"></i><span>Dashboard</span>
        </a>
        <div class="nav-label">Jobs</div>
        <a href="postings.php" <?php if(basename($_SERVER['PHP_SELF'])=='postings.php') echo 'class="active"'; ?>>
            <i class="fa-solid fa-briefcase"></i><span>Manage Jobs</span>
        </a>
        <a href="add.php" <?php if(basename($_SERVER['PHP_SELF'])=='add.php') echo 'class="active"'; ?>>
            <i class="fa-solid fa-circle-plus"></i><span>Add Job</span>
        </a>
        <div class="nav-label">Account</div>
        <?php if ($role === 'admin'): ?>
        <a href="users.php" <?php if(basename($_SERVER['PHP_SELF'])=='users.php') echo 'class="active"'; ?>>
            <i class="fa-solid fa-users-gear"></i><span>Users &amp; Password</span>
        </a>
        <?php endif; ?>
    </div>

    <div class="sidebar-footer">
        <a href="logout.php">
            <i class="fa-solid fa-arrow-right-from-bracket"></i><span>Logout</span>
        </a>
    </div>
</nav>

<!-- Main -->
<div class="main-content w-100">
    <div class="topbar">
        <div>
            <p class="topbar-title">
                <?php
                $titles = ['admin.php'=>'Dashboard','postings.php'=>'Manage Jobs','add.php'=>'Add Job','edit.php'=>'Edit Job','users.php'=>'Users & Password'];
                $page = basename($_SERVER['PHP_SELF']);
                echo $titles[$page] ?? 'Admin';
                ?>
                <small><?php echo date('l, d F Y'); ?></small>
            </p>
        </div>
        <div class="user-badge">
            <div class="user-avatar"><?php echo strtoupper(substr($user,0,1)); ?></div>
            <span><?php echo htmlspecialchars($user); ?></span>
        </div>
    </div>
    <div class="page-content">
