<?php
require('../dbconn.php');
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (isset($_SESSION['name']) && $_SESSION['name'] !== '') {
    header("Location: admin.php");
    exit();
}

$error = '';

if (isset($_POST['login'])) {
    $user = trim($_POST['username'] ?? '');
    $pass = $_POST['password'] ?? '';

    $stmt = mysqli_prepare($conn, "SELECT * FROM users WHERE name = ?");
    mysqli_stmt_bind_param($stmt, "s", $user);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $row    = mysqli_fetch_assoc($result);

    if ($row && password_verify($pass, $row['password'])) {
        $_SESSION['name'] = $user;
        $_SESSION['role'] = $row['role'] ?? 'user';
        header("Location: admin.php");
        exit();
    } else {
        $error = 'Invalid username or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login | Skyzen Technologies</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; }
body {
    font-family: 'Inter', sans-serif;
    background: #0f2742;
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
}
/* Background dots */
body::before {
    content: '';
    position: fixed; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
}

.login-wrap {
    display: flex; width: 860px; max-width: 95%;
    border-radius: 24px; overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.4);
    position: relative; z-index: 1;
}

/* Left panel */
.login-left {
    flex: 1;
    background: linear-gradient(155deg, #0f2742 0%, #1a4a7a 100%);
    padding: 50px 40px;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
}
.login-left::before {
    content: '';
    position: absolute;
    width: 300px; height: 300px;
    background: rgba(251,155,71,0.08);
    border-radius: 50%;
    right: -80px; top: -80px;
}
.login-left::after {
    content: '';
    position: absolute;
    width: 200px; height: 200px;
    background: rgba(251,155,71,0.05);
    border-radius: 50%;
    left: -60px; bottom: -60px;
}
.brand-logo {
    width: 52px; height: 52px;
    background: #fb9b47; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 800; color: #fff;
    margin-bottom: 30px;
}
.login-left h2 {
    color: #fff; font-size: 28px; font-weight: 700;
    margin-bottom: 12px; line-height: 1.3;
}
.login-left p { color: #8aabcc; font-size: 14px; line-height: 1.7; margin-bottom: 32px; }
.feature-item {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 16px;
}
.feature-item .fi-icon {
    width: 36px; height: 36px; border-radius: 9px;
    background: rgba(251,155,71,0.15);
    display: flex; align-items: center; justify-content: center;
    color: #fb9b47; font-size: 15px; flex-shrink: 0;
}
.feature-item span { color: #a8c8e8; font-size: 13px; font-weight: 500; }

/* Right panel */
.login-right {
    width: 380px; background: #fff;
    padding: 50px 40px;
    display: flex; flex-direction: column; justify-content: center;
}
.login-right h3 {
    font-size: 22px; font-weight: 700; color: #0f2742; margin-bottom: 6px;
}
.login-right p { color: #8a9ab0; font-size: 13px; margin-bottom: 30px; }

.form-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.input-wrap { position: relative; }
.input-wrap input {
    width: 100%; border: 1.5px solid #e5e7eb;
    border-radius: 12px; padding: 12px 14px 12px 44px;
    font-size: 14px; font-family: 'Inter', sans-serif;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #fafafa; outline: none;
}
.input-wrap input:focus {
    border-color: #fb9b47;
    box-shadow: 0 0 0 3px rgba(251,155,71,0.15);
    background: #fff;
}
.input-wrap .inp-icon {
    position: absolute; left: 14px; top: 50%;
    transform: translateY(-50%); color: #8a9ab0; font-size: 15px;
}
.pw-toggle {
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%); cursor: pointer;
    color: #8a9ab0; font-size: 15px; border: none; background: none;
}
.pw-toggle:hover { color: #0f2742; }

.error-box {
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: 10px; padding: 11px 14px;
    color: #dc3545; font-size: 13px; font-weight: 500;
    margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
}
.btn-login {
    width: 100%; background: #fb9b47; color: #fff;
    border: none; border-radius: 12px; padding: 13px;
    font-size: 15px; font-weight: 600; font-family: 'Inter', sans-serif;
    cursor: pointer; transition: background 0.2s, transform 0.1s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-login:hover { background: #e0862f; }
.btn-login:active { transform: scale(0.98); }

.back-link {
    display: block; text-align: center; margin-top: 20px;
    font-size: 13px; color: #8a9ab0; text-decoration: none;
}
.back-link:hover { color: #0f2742; }
.back-link i { margin-right: 4px; }

@media (max-width: 640px) {
    .login-left { display: none; }
    .login-right { width: 100%; border-radius: 24px; }
}
</style>
</head>
<body>

<div class="login-wrap">
    <!-- Left -->
    <div class="login-left">
        <div class="brand-logo">S</div>
        <h2>Skyzen Admin Portal</h2>
        <p>Manage job postings, track applications, and keep your career page up to date.</p>

        <div class="feature-item">
            <div class="fi-icon"><i class="fa-solid fa-briefcase"></i></div>
            <span>Post & manage job openings</span>
        </div>
        <div class="feature-item">
            <div class="fi-icon"><i class="fa-solid fa-chart-bar"></i></div>
            <span>Dashboard with live stats</span>
        </div>
        <div class="feature-item">
            <div class="fi-icon"><i class="fa-solid fa-shield-halved"></i></div>
            <span>Secure session management</span>
        </div>
    </div>

    <!-- Right -->
    <div class="login-right">
        <h3>Welcome back</h3>
        <p>Sign in to your admin account</p>

        <?php if ($error): ?>
            <div class="error-box">
                <i class="fa-solid fa-circle-xmark"></i>
                <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <form method="POST" id="loginForm">
            <div class="mb-3">
                <label class="form-label">Username</label>
                <div class="input-wrap">
                    <i class="fa-solid fa-user inp-icon"></i>
                    <input type="text" name="username" placeholder="Enter username"
                        value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>" required autofocus>
                </div>
            </div>

            <div class="mb-4">
                <label class="form-label">Password</label>
                <div class="input-wrap">
                    <i class="fa-solid fa-lock inp-icon"></i>
                    <input type="password" id="pwField" name="password" placeholder="Enter password" required>
                    <button type="button" class="pw-toggle" onclick="togglePw()" id="pwToggle">
                        <i class="fa-solid fa-eye" id="pwIcon"></i>
                    </button>
                </div>
            </div>

            <button type="submit" name="login" class="btn-login">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
        </form>

        <a href="../index.html" class="back-link"><i class="fa-solid fa-arrow-left"></i>Back to website</a>
    </div>
</div>

<script>
function togglePw() {
    const f = document.getElementById('pwField');
    const i = document.getElementById('pwIcon');
    if (f.type === 'password') {
        f.type = 'text';
        i.className = 'fa-solid fa-eye-slash';
    } else {
        f.type = 'password';
        i.className = 'fa-solid fa-eye';
    }
}
</script>
</body>
</html>
