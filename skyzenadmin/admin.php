<?php
require('../dbconn.php');
require('auth.php');

$jobCount = 0;
$lcaCount = 0;

$jobsQ = mysqli_query($conn, "SELECT COUNT(*) AS total FROM postings");
if ($jobsQ) $jobCount = mysqli_fetch_assoc($jobsQ)['total'];

$lcaCheck = mysqli_query($conn, "SHOW TABLES LIKE 'lca1'");
if ($lcaCheck && mysqli_num_rows($lcaCheck) > 0) {
    $lcaQ = mysqli_query($conn, "SELECT COUNT(*) AS total FROM lca1");
    if ($lcaQ) $lcaCount = mysqli_fetch_assoc($lcaQ)['total'];
}

$recentJobs = mysqli_query($conn, "SELECT sl, role, company, location FROM postings ORDER BY sl DESC LIMIT 5");
?>
<?php include('header.php'); ?>

<!-- Stat Cards -->
<div class="row">
    <div class="col-sm-6 col-xl-3">
        <div class="stat-card card-blue">
            <i class="fa-solid fa-briefcase card-icon"></i>
            <h6>Total Jobs</h6>
            <h2 class="counter"><?php echo $jobCount; ?></h2>
            <p>Active job postings</p>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="stat-card card-green">
            <i class="fa-solid fa-file-lines card-icon"></i>
            <h6>LCA Posts</h6>
            <h2 class="counter"><?php echo $lcaCount; ?></h2>
            <p>LCA records</p>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="stat-card card-orange">
            <i class="fa-solid fa-clock-rotate-left card-icon"></i>
            <h6>Recent Added</h6>
            <h2><?php echo min($jobCount, 5); ?></h2>
            <p>Last 5 postings</p>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="stat-card card-dark">
            <i class="fa-solid fa-circle-check card-icon"></i>
            <h6>Status</h6>
            <h2 style="font-size:22px; margin-top:8px;">Active</h2>
            <p>System operational</p>
        </div>
    </div>
</div>

<div class="row">
    <!-- Quick Actions -->
    <div class="col-lg-4">
        <div class="content-card">
            <div class="card-header-row">
                <h5><i class="fa-solid fa-bolt text-warning me-2"></i>Quick Actions</h5>
            </div>
            <a href="add.php" class="quick-action">
                <div class="qa-icon" style="background:#fff7f0; color:#fb9b47;"><i class="fa-solid fa-plus"></i></div>
                <div class="qa-text">
                    <strong>Add New Job</strong>
                    <span>Post a new job opening</span>
                </div>
                <i class="fa-solid fa-chevron-right ms-auto" style="color:#ccc;"></i>
            </a>
            <a href="postings.php" class="quick-action">
                <div class="qa-icon" style="background:#eef5fb; color:#0d6efd;"><i class="fa-solid fa-list"></i></div>
                <div class="qa-text">
                    <strong>Manage Jobs</strong>
                    <span>Edit or delete postings</span>
                </div>
                <i class="fa-solid fa-chevron-right ms-auto" style="color:#ccc;"></i>
            </a>
            <a href="../jobs.php" target="_blank" class="quick-action">
                <div class="qa-icon" style="background:#f0fdf4; color:#198754;"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                <div class="qa-text">
                    <strong>View Live Site</strong>
                    <span>See jobs page on website</span>
                </div>
                <i class="fa-solid fa-chevron-right ms-auto" style="color:#ccc;"></i>
            </a>
        </div>
    </div>

    <!-- Recent Jobs -->
    <div class="col-lg-8">
        <div class="content-card">
            <div class="card-header-row">
                <h5><i class="fa-solid fa-clock-rotate-left me-2" style="color:#fb9b47;"></i>Recent Job Postings</h5>
                <a href="postings.php" class="btn btn-sm btn-skyzen px-3">View All</a>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Role</th>
                            <th>Company</th>
                            <th>Location</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if ($recentJobs && mysqli_num_rows($recentJobs) > 0):
                            while ($row = mysqli_fetch_assoc($recentJobs)): ?>
                            <tr>
                                <td><span style="color:#8a9ab0; font-size:12px;">#<?php echo $row['sl']; ?></span></td>
                                <td><span class="role-badge"><?php echo htmlspecialchars($row['role']); ?></span></td>
                                <td><?php echo htmlspecialchars($row['company']); ?></td>
                                <td><i class="fa-solid fa-location-dot" style="color:#fb9b47; font-size:12px; margin-right:4px;"></i><?php echo htmlspecialchars($row['location']); ?></td>
                                <td>
                                    <a href="edit.php?id=<?php echo $row['sl']; ?>" class="btn-icon btn-edit" title="Edit"><i class="fa-solid fa-pen"></i></a>
                                </td>
                            </tr>
                        <?php endwhile; else: ?>
                            <tr><td colspan="5" class="text-center py-4" style="color:#8a9ab0;">No job postings yet.</td></tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

</div></div><!-- close page-content + main-content -->
</div><!-- close d-flex wrapper -->

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>
// Animate counters
document.querySelectorAll('.counter').forEach(el => {
    const target = parseInt(el.innerText);
    let count = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
        count = Math.min(count + step, target);
        el.innerText = count;
        if (count >= target) clearInterval(timer);
    }, 40);
});
</script>
</body>
</html>
