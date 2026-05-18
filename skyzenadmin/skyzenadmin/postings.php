<?php
require('../dbconn.php');
require('auth.php');

$sql    = "SELECT * FROM postings ORDER BY sl DESC";
$result = mysqli_query($conn, $sql);
?>
<?php include('header.php'); ?>

<div class="content-card">
    <div class="card-header-row">
        <h5><i class="fa-solid fa-briefcase me-2" style="color:#fb9b47;"></i>All Job Postings</h5>
        <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="search-wrap">
                <i class="fa-solid fa-magnifying-glass search-icon"></i>
                <input type="text" id="searchInput" class="form-control form-control-sm" placeholder="Search jobs..." style="width:200px; padding-left:36px;">
            </div>
            <a href="add.php" class="btn btn-skyzen btn-sm px-3">
                <i class="fa-solid fa-plus me-1"></i>Add Job
            </a>
        </div>
    </div>

    <div class="table-responsive">
        <table class="admin-table" id="jobsTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Description</th>
                    <th style="text-align:center;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if ($result && mysqli_num_rows($result) > 0):
                    while ($row = mysqli_fetch_assoc($result)): ?>
                    <tr>
                        <td><span style="color:#8a9ab0; font-size:12px;">#<?php echo $row['sl']; ?></span></td>
                        <td><span class="role-badge"><?php echo htmlspecialchars($row['role']); ?></span></td>
                        <td><?php echo htmlspecialchars($row['company']); ?></td>
                        <td><i class="fa-solid fa-location-dot" style="color:#fb9b47; font-size:12px; margin-right:4px;"></i><?php echo htmlspecialchars($row['location']); ?></td>
                        <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#6b7280; font-size:13px;">
                            <?php echo htmlspecialchars(mb_strimwidth(strip_tags($row['description']), 0, 80, '...')); ?>
                        </td>
                        <td style="text-align:center;">
                            <a href="edit.php?id=<?php echo $row['sl']; ?>" class="btn-icon btn-edit me-1" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </a>
                            <button class="btn-icon btn-del" title="Delete"
                                onclick="confirmDelete('delete.php?id=<?php echo $row['sl']; ?>')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                <?php endwhile; else: ?>
                    <tr>
                        <td colspan="6" class="text-center py-5">
                            <i class="fa-solid fa-briefcase" style="font-size:40px; color:#d1d5db; display:block; margin-bottom:12px;"></i>
                            <span style="color:#8a9ab0;">No job postings yet. <a href="add.php" style="color:#fb9b47;">Add one now.</a></span>
                        </td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

</div></div></div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>
// Live search
document.getElementById('searchInput').addEventListener('input', function(){
    const q = this.value.toLowerCase();
    document.querySelectorAll('#jobsTable tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
});

// Delete confirm
function confirmDelete(url) {
    document.getElementById('confirmDeleteBtn').href = url;
    document.getElementById('deleteOverlay').classList.add('show');
}

// Show toast if redirected with ?deleted=1
const params = new URLSearchParams(window.location.search);
if (params.get('deleted') === '1') showToast('Job deleted successfully.', false);
if (params.get('updated') === '1') showToast('Job updated successfully.', false);

function showToast(msg, isError) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast-msg' + (isError ? ' error' : '');
    t.innerHTML = `<i class="fa-solid fa-${isError ? 'circle-xmark' : 'circle-check'}" style="color:${isError?'#dc3545':'#198754'}; font-size:20px;"></i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}
</script>
</body>
</html>
