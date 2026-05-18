<?php
require('../dbconn.php');
require('auth.php');

// Only admin can access this page
if ($role !== 'admin') {
    header("Location: admin.php");
    exit();
}

$success = '';
$error   = '';

// ── Change Password ──────────────────────────────────────────
if (isset($_POST['action']) && $_POST['action'] === 'change_password') {
    $current  = $_POST['current_pass'] ?? '';
    $new      = $_POST['new_pass']     ?? '';
    $confirm  = $_POST['confirm_pass'] ?? '';

    if (empty($current) || empty($new) || empty($confirm)) {
        $error = 'All password fields are required.';
    } elseif (strlen($new) < 8) {
        $error = 'New password must be at least 8 characters.';
    } elseif ($new !== $confirm) {
        $error = 'New password and confirmation do not match.';
    } else {
        // Verify current password
        $stmt = mysqli_prepare($conn, "SELECT password FROM users WHERE name = ?");
        mysqli_stmt_bind_param($stmt, 's', $user);
        mysqli_stmt_execute($stmt);
        $res  = mysqli_stmt_get_result($stmt);
        $row  = mysqli_fetch_assoc($res);

        if (!$row || !password_verify($current, $row['password'])) {
            $error = 'Current password is incorrect.';
        } else {
            $hash = password_hash($new, PASSWORD_DEFAULT);
            $upd  = mysqli_prepare($conn, "UPDATE users SET password = ? WHERE name = ?");
            mysqli_stmt_bind_param($upd, 'ss', $hash, $user);
            mysqli_stmt_execute($upd);
            $success = 'password_changed';
        }
    }
}

// ── Add New User ─────────────────────────────────────────────
if (isset($_POST['action']) && $_POST['action'] === 'add_user') {
    $newUsername = trim($_POST['new_username'] ?? '');
    $newPass     = $_POST['new_user_pass']  ?? '';
    $newConfirm  = $_POST['new_user_confirm'] ?? '';
    $newRole     = ($_POST['new_user_role'] ?? 'user') === 'admin' ? 'admin' : 'user';

    if (empty($newUsername) || empty($newPass) || empty($newConfirm)) {
        $error = 'All fields are required to add a user.';
    } elseif (strlen($newPass) < 8) {
        $error = 'Password must be at least 8 characters.';
    } elseif ($newPass !== $newConfirm) {
        $error = 'Passwords do not match.';
    } else {
        // Check if username already exists
        $chk = mysqli_prepare($conn, "SELECT id FROM users WHERE name = ?");
        mysqli_stmt_bind_param($chk, 's', $newUsername);
        mysqli_stmt_execute($chk);
        mysqli_stmt_store_result($chk);

        if (mysqli_stmt_num_rows($chk) > 0) {
            $error = "Username \"$newUsername\" already exists.";
        } else {
            $hash = password_hash($newPass, PASSWORD_DEFAULT);
            $ins  = mysqli_prepare($conn, "INSERT INTO users (name, password, role) VALUES (?, ?, ?)");
            mysqli_stmt_bind_param($ins, 'sss', $newUsername, $hash, $newRole);
            mysqli_stmt_execute($ins);
            $success = 'user_added';
        }
    }
}

// ── Delete User ───────────────────────────────────────────────
if (isset($_GET['delete'])) {
    $delId = (int)$_GET['delete'];
    // Prevent deleting yourself
    $self = mysqli_prepare($conn, "SELECT id FROM users WHERE name = ?");
    mysqli_stmt_bind_param($self, 's', $user);
    mysqli_stmt_execute($self);
    $selfRes = mysqli_stmt_get_result($self);
    $selfRow = mysqli_fetch_assoc($selfRes);

    if ($selfRow && $selfRow['id'] == $delId) {
        $error = 'You cannot delete your own account.';
    } else {
        $del = mysqli_prepare($conn, "DELETE FROM users WHERE id = ?");
        mysqli_stmt_bind_param($del, 'i', $delId);
        mysqli_stmt_execute($del);
        $success = 'user_deleted';
    }
}

// ── Fetch all users ───────────────────────────────────────────
$allUsers = mysqli_query($conn, "SELECT id, name, role FROM users ORDER BY id ASC");

include('header.php');
?>

<?php if ($success === 'password_changed'): ?>
<div class="toast-auto" data-msg="Password changed successfully!" data-type="success"></div>
<?php elseif ($success === 'user_added'): ?>
<div class="toast-auto" data-msg="New user added successfully!" data-type="success"></div>
<?php elseif ($success === 'user_deleted'): ?>
<div class="toast-auto" data-msg="User removed." data-type="success"></div>
<?php endif; ?>

<div class="row g-4">

  <!-- ── Change Password ───────────────────────────── -->
  <div class="col-lg-6">
    <div class="content-card h-100">
      <div class="card-header-row">
        <h5><i class="fa-solid fa-key me-2" style="color:#fb9b47;"></i>Change Your Password</h5>
      </div>
      <?php if ($error && isset($_POST['action']) && $_POST['action']==='change_password'): ?>
        <div class="alert-box error mb-3"><i class="fa-solid fa-circle-xmark me-2"></i><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <form method="POST" id="changePassForm" novalidate>
        <input type="hidden" name="action" value="change_password">

        <div class="mb-3">
          <label class="form-label">Current Password</label>
          <div class="pw-wrap">
            <input type="password" name="current_pass" class="form-control" placeholder="Enter current password" required>
            <button type="button" class="pw-toggle" tabindex="-1"><i class="fa-regular fa-eye"></i></button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">New Password</label>
          <div class="pw-wrap">
            <input type="password" name="new_pass" id="newPass" class="form-control" placeholder="Min. 8 characters" required>
            <button type="button" class="pw-toggle" tabindex="-1"><i class="fa-regular fa-eye"></i></button>
          </div>
          <div class="pw-strength mt-2" id="strengthBar">
            <div class="strength-track"><div class="strength-fill" id="strengthFill"></div></div>
            <span id="strengthLabel" class="strength-label"></span>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label">Confirm New Password</label>
          <div class="pw-wrap">
            <input type="password" name="confirm_pass" id="confirmPass" class="form-control" placeholder="Repeat new password" required>
            <button type="button" class="pw-toggle" tabindex="-1"><i class="fa-regular fa-eye"></i></button>
          </div>
          <small id="matchHint" class="mt-1 d-block" style="font-size:12px;"></small>
        </div>

        <button type="submit" class="btn btn-skyzen px-4">
          <i class="fa-solid fa-floppy-disk me-2"></i>Update Password
        </button>
      </form>
    </div>
  </div>

  <!-- ── Add New User ───────────────────────────────── -->
  <div class="col-lg-6">
    <div class="content-card h-100">
      <div class="card-header-row">
        <h5><i class="fa-solid fa-user-plus me-2" style="color:#0d6efd;"></i>Add New Admin User</h5>
      </div>
      <?php if ($error && isset($_POST['action']) && $_POST['action']==='add_user'): ?>
        <div class="alert-box error mb-3"><i class="fa-solid fa-circle-xmark me-2"></i><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <form method="POST" novalidate>
        <input type="hidden" name="action" value="add_user">

        <div class="mb-3">
          <label class="form-label">Username</label>
          <input type="text" name="new_username" class="form-control" placeholder="Enter username" autocomplete="off" required>
        </div>

        <div class="mb-3">
          <label class="form-label">Password</label>
          <div class="pw-wrap">
            <input type="password" name="new_user_pass" class="form-control" placeholder="Min. 8 characters" required>
            <button type="button" class="pw-toggle" tabindex="-1"><i class="fa-regular fa-eye"></i></button>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label">Confirm Password</label>
          <div class="pw-wrap">
            <input type="password" name="new_user_confirm" class="form-control" placeholder="Repeat password" required>
            <button type="button" class="pw-toggle" tabindex="-1"><i class="fa-regular fa-eye"></i></button>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label">Role</label>
          <select name="new_user_role" class="form-select">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary px-4">
          <i class="fa-solid fa-user-plus me-2"></i>Add User
        </button>
      </form>
    </div>
  </div>

  <!-- ── User List ─────────────────────────────────── -->
  <div class="col-12">
    <div class="content-card">
      <div class="card-header-row">
        <h5><i class="fa-solid fa-users me-2" style="color:#198754;"></i>Admin Users</h5>
        <span class="badge bg-secondary"><?= mysqli_num_rows($allUsers) ?> user(s)</span>
      </div>
      <?php if ($error && isset($_GET['delete'])): ?>
        <div class="alert-box error mb-3"><i class="fa-solid fa-circle-xmark me-2"></i><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Role</th>
            <th style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          <?php while ($u = mysqli_fetch_assoc($allUsers)): ?>
          <tr>
            <td style="color:#8a9ab0; font-size:13px;"><?= $u['id'] ?></td>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:#0f2742;
                            display:flex; align-items:center; justify-content:center;
                            color:#fb9b47; font-weight:700; font-size:13px; flex-shrink:0;">
                  <?= strtoupper(substr($u['name'],0,1)) ?>
                </div>
                <span style="font-weight:600;"><?= htmlspecialchars($u['name']) ?></span>
                <?php if ($u['name'] === $user): ?>
                  <span class="badge" style="background:#fff3e0; color:#e0862f; font-size:11px;">You</span>
                <?php endif; ?>
              </div>
            </td>
            <td><span class="role-badge" style="<?= $u['role']==='admin' ? 'background:#fff3e0; color:#e0862f;' : '' ?>"><?= $u['role'] === 'admin' ? 'Admin' : 'User' ?></span></td>
            <td style="text-align:right;">
              <?php if ($u['name'] !== $user): ?>
                <button class="btn-icon btn-del" title="Delete user"
                  onclick="confirmDelete(<?= $u['id'] ?>, '<?= htmlspecialchars($u['name']) ?>')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              <?php else: ?>
                <span style="font-size:12px; color:#8a9ab0;">—</span>
              <?php endif; ?>
            </td>
          </tr>
          <?php endwhile; ?>
        </tbody>
      </table>
    </div>
  </div>

</div><!-- /row -->

<!-- Delete user confirm overlay -->
<div class="confirm-overlay" id="userDeleteOverlay">
  <div class="confirm-box">
    <div class="confirm-icon"><i class="fa-solid fa-user-xmark"></i></div>
    <h5>Remove Admin User?</h5>
    <p id="delUserMsg">This user will lose all access to the admin panel.</p>
    <a id="confirmUserDeleteBtn" href="#" class="btn btn-danger px-4 me-2">Yes, Remove</a>
    <button onclick="document.getElementById('userDeleteOverlay').classList.remove('show')"
            class="btn btn-outline-secondary px-4">Cancel</button>
  </div>
</div>

<style>
/* Password wrap */
.pw-wrap { position: relative; }
.pw-wrap .form-control { padding-right: 42px; }
.pw-toggle {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: #8a9ab0; cursor: pointer; font-size: 15px; padding: 0;
  transition: color 0.2s;
}
.pw-toggle:hover { color: #fb9b47; }

/* Strength bar */
.pw-strength { display: flex; align-items: center; gap: 10px; }
.strength-track { flex: 1; height: 4px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.strength-fill { height: 100%; width: 0; border-radius: 4px; transition: width 0.3s, background 0.3s; }
.strength-label { font-size: 11px; font-weight: 600; min-width: 44px; }

/* Alert box */
.alert-box {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
}
.alert-box.error { background: #fef2f2; color: #dc3545; border: 1px solid #fecaca; }
.alert-box.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
</style>

<script>
// ── Password show/hide toggles ──
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', function() {
    const inp = this.previousElementSibling;
    const icon = this.querySelector('i');
    if (inp.type === 'password') {
      inp.type = 'text';
      icon.classList.replace('fa-eye','fa-eye-slash');
    } else {
      inp.type = 'password';
      icon.classList.replace('fa-eye-slash','fa-eye');
    }
  });
});

// ── Password strength ──
const newPassInput = document.getElementById('newPass');
const confirmInput = document.getElementById('confirmPass');
if (newPassInput) {
  newPassInput.addEventListener('input', function() {
    const val = this.value;
    let score = 0;
    if (val.length >= 8)            score++;
    if (/[A-Z]/.test(val))          score++;
    if (/[0-9]/.test(val))          score++;
    if (/[^A-Za-z0-9]/.test(val))   score++;

    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    const levels = [
      { w:'25%', bg:'#ef4444', txt:'Weak',   col:'#ef4444' },
      { w:'50%', bg:'#f97316', txt:'Fair',   col:'#f97316' },
      { w:'75%', bg:'#eab308', txt:'Good',   col:'#eab308' },
      { w:'100%',bg:'#22c55e', txt:'Strong', col:'#22c55e' },
    ];
    const lv = levels[Math.max(0, score - 1)];
    fill.style.width      = val ? lv.w  : '0';
    fill.style.background = lv.bg;
    label.textContent     = val ? lv.txt : '';
    label.style.color     = lv.col;
    checkMatch();
  });
}

// ── Confirm match hint ──
function checkMatch() {
  if (!confirmInput || !newPassInput) return;
  const hint = document.getElementById('matchHint');
  if (!confirmInput.value) { hint.textContent = ''; return; }
  if (newPassInput.value === confirmInput.value) {
    hint.textContent = '✓ Passwords match';
    hint.style.color = '#16a34a';
  } else {
    hint.textContent = '✗ Passwords do not match';
    hint.style.color = '#dc3545';
  }
}
if (confirmInput) confirmInput.addEventListener('input', checkMatch);

// ── Delete user confirm ──
function confirmDelete(id, name) {
  document.getElementById('delUserMsg').textContent = `Remove "${name}" from admin access?`;
  document.getElementById('confirmUserDeleteBtn').href = `users.php?delete=${id}`;
  document.getElementById('userDeleteOverlay').classList.add('show');
}

// ── Auto-toast on load ──
document.querySelectorAll('.toast-auto').forEach(el => {
  showToast(el.dataset.msg, el.dataset.type);
});

function showToast(msg, type) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast-msg' + (type === 'error' ? ' error' : '');
  t.innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-xmark':'fa-circle-check'}" style="color:${type==='error'?'#dc3545':'#198754'};font-size:18px;"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}
</script>

<?php
// close page-content + main-content + d-flex wrapper (opened by header.php)
echo '</div></div></div>';
echo '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>';
echo '</body></html>';
?>
