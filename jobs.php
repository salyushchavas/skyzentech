<?php
require('dbconn.php');
$sql    = "SELECT * FROM postings ORDER BY sl DESC";
$result = mysqli_query($conn, $sql);
$total  = $result ? mysqli_num_rows($result) : 0;
$jobs   = [];
while ($result && $row = mysqli_fetch_assoc($result)) { $jobs[] = $row; }
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Explore Job Opportunities | Skyzen Technologies LLC</title>
  <meta name="description" content="Browse current IT job openings at Skyzen Technologies LLC. We place candidates with top enterprises including Wells Fargo, JP Morgan, AT&T, Deloitte and more.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.skyzentech.com/jobs.php">
  <link rel="icon" type="image/png" href="images/skyzen-logo.png">
  <link rel="shortcut icon" type="image/png" href="images/skyzen-logo.png">
  <link rel="stylesheet" href="plugins/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="plugins/icofont/icofont.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

<style>
*  { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --dark:   #080d1a;
  --dark2:  #0c1221;
  --dark3:  #111827;
  --orange: #fb9b47;
  --orange2:#ff7c20;
  --navy:   #0f2238;
  --light:  #f8fafc;
  --white:  #ffffff;
  --text:   #e2e8f0;
  --muted:  #8a9ab5;
  --border: rgba(255,255,255,0.08);
}
body { font-family: 'Poppins', sans-serif; background: var(--dark); color: var(--text); }
a, a:hover, a:focus, a:active { text-decoration: none; }

/* ── TOP BAR ─────────────────── */
.top-bar {
  background: rgba(8,13,26,0.95);
  border-bottom: 1px solid var(--border);
  padding: 8px 0; font-size: 13px;
}
.top-bar a { color: var(--muted); transition: color 0.2s; }
.top-bar a:hover { color: var(--orange); }
.top-bar i { margin-right: 5px; color: var(--orange); }
.top-bar .social-link {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid var(--border);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--muted); transition: all 0.2s;
}
.top-bar .social-link:hover { border-color: var(--orange); color: var(--orange); }

/* ── NAVBAR ──────────────────── */
.main-nav {
  background: transparent;
  padding: 12px 0;
  position: sticky; top: 0; z-index: 1000;
}
.main-nav .nav-inner {
  max-width: 1280px;
  width: calc(100% - 60px);
  margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  background: #2a2d35;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 50px;
  padding: 10px 28px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.main-nav.scrolled .nav-inner { background: #2a2d35; }
.nav-brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
.nav-brand:hover { opacity: 0.85; }
.brand-icon { width: 42px; height: 42px; background: transparent; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.brand-icon img { width: 36px; height: 36px; object-fit: contain; display: block; }
.brand-name { font-size: 18px; font-weight: 800; letter-spacing: 1px; line-height: 1.1; text-transform: uppercase; }
.brand-name .sky { color: #fff; }
.brand-name .zen { color: var(--orange); }
.brand-name small { display: block; font-size: 10px; font-weight: 400; color: rgba(255,255,255,0.5); letter-spacing: 1.5px; text-transform: uppercase; }
.nav-links { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; }
.nav-links li a {
  color: rgba(255,255,255,0.75); font-size: 12px; font-weight: 500;
  padding: 7px 11px; border-radius: 8px; letter-spacing: 0.3px;
  transition: all 0.2s; display: block; white-space: nowrap;
}
.nav-links li a:hover { color: #fff; background: rgba(255,255,255,0.07); }
.nav-links li a.active { color: #fff; background: rgba(255,255,255,0.1); }
.nav-jobs-link {
  color: var(--orange) !important; font-size: 12px !important;
  border: 1px solid rgba(251,155,71,0.35) !important;
  border-radius: 8px !important; padding: 6px 12px !important;
  display: flex; align-items: center; gap: 5px;
  transition: all 0.2s !important;
}
.nav-jobs-link:hover {
  background: rgba(251,155,71,0.12) !important;
  border-color: var(--orange) !important;
}
.nav-jobs-link i { font-size: 13px; }
.nav-jobs-link::after { display: none !important; }
.nav-cta {
  background: linear-gradient(135deg, var(--orange), var(--orange2));
  color: var(--white) !important; padding: 9px 22px !important;
  border-radius: 30px !important; font-weight: 600 !important;
  box-shadow: 0 4px 18px rgba(251,155,71,0.35);
  transition: box-shadow 0.3s, transform 0.2s !important;
}
.nav-cta:hover { box-shadow: 0 6px 24px rgba(251,155,71,0.5) !important; transform: translateY(-1px); background: linear-gradient(135deg, #e0862f, #fb9b47) !important; }
.nav-cta::after { display: none !important; }
.nav-toggle {
  display: none; background: none; border: 1px solid var(--border);
  color: var(--text); padding: 6px 10px; border-radius: 8px; cursor: pointer;
}

/* ── HERO BANNER ─────────────── */
.jobs-hero {
  background: linear-gradient(135deg, var(--dark) 0%, #0d1f3c 60%, #0f2238 100%);
  padding: 90px 0 70px;
  text-align: center;
  position: relative; overflow: hidden;
  border-bottom: 1px solid var(--border);
}
.jobs-hero::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(251,155,71,0.08) 0%, transparent 70%);
}
.jobs-hero .eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(251,155,71,0.1); border: 1px solid rgba(251,155,71,0.25);
  color: var(--orange); border-radius: 25px;
  padding: 6px 18px; font-size: 13px; font-weight: 500;
  margin-bottom: 24px;
}
.jobs-hero .eyebrow span {
  width: 7px; height: 7px; background: var(--orange);
  border-radius: 50%; animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
.jobs-hero h1 {
  font-size: clamp(32px, 5vw, 54px);
  font-weight: 800; color: var(--white);
  line-height: 1.15; margin-bottom: 18px;
  position: relative;
}
.jobs-hero h1 span {
  background: linear-gradient(135deg, var(--orange), var(--orange2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.jobs-hero p {
  font-size: 16px; color: var(--muted); max-width: 580px;
  margin: 0 auto 36px; line-height: 1.8; position: relative;
}
.hero-stats {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; flex-wrap: wrap; position: relative;
  margin-top: 8px;
}
.hero-logo-item {
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(251,155,71,0.25);
  border-radius: 12px;
  padding: 12px 24px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s;
}
.hero-logo-item:hover { background: rgba(251,155,71,0.12); border-color: rgba(251,155,71,0.5); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(251,155,71,0.15); }
.hero-logo-item img { height: 30px; object-fit: contain; filter: brightness(1.8); opacity: 0.9; transition: all 0.3s; }
.hero-logo-item:hover img { filter: brightness(2); opacity: 1; }

/* ── SEARCH + FILTER BAR ──────── */
.filter-bar {
  background: var(--dark2);
  border-bottom: 1px solid var(--border);
  padding: 20px 0;
  position: sticky; top: 73px; z-index: 900;
}
.search-wrap { position: relative; }
.search-wrap input {
  width: 100%; background: rgba(255,255,255,0.05);
  border: 1.5px solid var(--border); border-radius: 12px;
  color: var(--white); padding: 12px 16px 12px 44px;
  font-size: 14px; font-family: 'Poppins', sans-serif;
  transition: border-color 0.2s;
}
.search-wrap input::placeholder { color: var(--muted); }
.search-wrap input:focus { outline: none; border-color: var(--orange); background: rgba(255,255,255,0.07); }
.search-wrap .si {
  position: absolute; left: 14px; top: 50%;
  transform: translateY(-50%); color: var(--muted); font-size: 16px;
}
.filter-count {
  color: var(--muted); font-size: 13px; font-weight: 500;
  display: flex; align-items: center; justify-content: flex-end; height: 100%;
}
.filter-count strong { color: var(--orange); margin: 0 4px; }

/* ── JOBS GRID ───────────────── */
.jobs-section { padding: 60px 0 80px; }

.job-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 18px; padding: 28px;
  height: 100%; display: flex; flex-direction: column;
  transition: all 0.3s ease;
  position: relative; overflow: hidden;
}
.job-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--orange), var(--orange2));
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.3s ease;
}
.job-card:hover { border-color: rgba(251,155,71,0.3); transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); background: rgba(255,255,255,0.05); }
.job-card:hover::before { transform: scaleX(1); }

.job-role {
  font-size: 18px; font-weight: 700; color: var(--white);
  margin-bottom: 14px; line-height: 1.3;
}
.job-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.job-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 500; padding: 4px 10px;
  border-radius: 20px; border: 1px solid var(--border);
  color: var(--muted);
}
.job-badge i { font-size: 13px; }
.job-badge.company { color: #7dd3fc; border-color: rgba(125,211,252,0.2); background: rgba(125,211,252,0.06); }
.job-badge.location { color: #86efac; border-color: rgba(134,239,172,0.2); background: rgba(134,239,172,0.06); }
.job-badge.salary   { color: var(--orange); border-color: rgba(251,155,71,0.2); background: rgba(251,155,71,0.06); }
.job-badge.exp      { color: #c4b5fd; border-color: rgba(196,181,253,0.2); background: rgba(196,181,253,0.06); }

.job-desc {
  font-size: 13px; color: var(--muted); line-height: 1.7;
  flex: 1; margin-bottom: 20px;
}
.job-actions { display: flex; gap: 10px; margin-top: auto; }
.btn-view {
  flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600;
  border: 1.5px solid var(--border); color: var(--text);
  background: transparent; text-align: center;
  transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-view:hover { border-color: rgba(255,255,255,0.3); color: var(--white); background: rgba(255,255,255,0.06); }
.btn-apply {
  flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600;
  background: linear-gradient(135deg, var(--orange), var(--orange2));
  color: var(--white); border: none; text-align: center;
  transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(251,155,71,0.3);
}
.btn-apply:hover { box-shadow: 0 6px 20px rgba(251,155,71,0.45); transform: translateY(-1px); color: var(--white); }

/* No jobs */
.no-jobs {
  text-align: center; padding: 80px 30px;
  border: 1px dashed var(--border); border-radius: 20px;
  background: rgba(255,255,255,0.02);
}
.no-jobs i { font-size: 56px; color: var(--orange); opacity: 0.5; margin-bottom: 20px; display: block; }
.no-jobs h4 { color: var(--white); font-size: 22px; margin-bottom: 10px; }
.no-jobs p  { color: var(--muted); font-size: 15px; margin-bottom: 24px; }

/* ── FOOTER ──────────────────── */
footer {
  background: #050a14;
  border-top: 1px solid var(--border);
  padding: 36px 0;
}
.footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px;
}
.footer-inner span { font-size: 13px; color: var(--muted); }
.footer-inner a { font-size: 13px; color: var(--muted); transition: color 0.2s; }
.footer-inner a:hover { color: var(--orange); }

/* ── MOBILE ──────────────────── */
@media (max-width: 991px) {
  .nav-links { display: none; flex-direction: column; position: absolute; top: 100%; left: 0; right: 0; background: rgba(8,13,26,0.98); padding: 16px; border-bottom: 1px solid var(--border); gap: 4px; }
  .nav-links.open { display: flex; }
  .nav-toggle { display: block; }
  .filter-count { justify-content: flex-start; margin-top: 10px; }
  .job-actions { flex-direction: column; }
  .btn-view, .btn-apply { flex: none; }
}
@media (max-width: 576px) {
  .hero-stats { gap: 24px; }
}
</style>
</head>
<body>

<header>
  <div class="top-bar">
    <div class="container">
      <div class="d-flex align-items-center justify-content-between">
        <div style="display:flex; gap:24px; flex-wrap:wrap;">
          <a href="mailto:info@skyzentech.com"><i class="icofont-email"></i>info@skyzentech.com</a>
          <a href="tel:4699453339"><i class="icofont-phone"></i>+1 469-945-3339</a>
        </div>
        <div class="d-flex gap-2">
          <a href="https://www.linkedin.com/company/skyzen-tech-llc/" target="_blank" class="social-link">
            <i class="icofont-linkedin"></i>
          </a>
        </div>
      </div>
    </div>
  </div>

  <nav class="main-nav" id="mainNav">
    <div class="container">
    <div class="nav-inner">
      <a href="index.html" class="nav-brand">
        <div class="brand-icon"><img src="images/skyzen-logo.png" alt="Skyzen"></div>
        <div class="brand-name"><span class="sky">SKY</span><span class="zen">ZEN</span><small>Technologies LLC</small></div>
      </a>

      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">
        <i class="icofont-navigation-menu"></i>
      </button>

      <ul class="nav-links" id="navLinks">
        <li><a href="index.html">HOME</a></li>
        <li><a href="index.html#what-we-do">SERVICES</a></li>
        <li><a href="index.html#why-we">WHY WE?</a></li>
        <li><a href="index.html#our-expertise">OUR EXPERTISE</a></li>
        <li><a href="index.html#career-support">CAREER SUPPORT</a></li>
        <li><a href="jobs.php" class="nav-jobs-link active"><i class="icofont-briefcase"></i> EXPLORE JOBS</a></li>
        <li><a href="index.html#contact" class="nav-cta">HIRE TALENT</a></li>
      </ul>
    </div>
    </div>
  </nav>
</header>

<!-- HERO -->
<div class="jobs-hero">
  <div class="container" style="position:relative;">
    <div class="eyebrow"><span></span> Career Opportunities</div>
    <h1>Find Your Next <span>Role</span></h1>
    <p>We connect skilled professionals with top enterprises including <span style="white-space:nowrap;">Wells Fargo</span>, JP Morgan, AT&T, Deloitte & more.</p>
    <div class="hero-stats">
      <div class="hero-logo-item"><img src="images/client-logos/1.jpg" alt="Client"></div>
      <div class="hero-logo-item"><img src="images/client-logos/2.jpg" alt="Client"></div>
      <div class="hero-logo-item"><img src="images/client-logos/3.jpg" alt="Client"></div>
      <div class="hero-logo-item"><img src="images/client-logos/4.jpg" alt="Client"></div>
      <div class="hero-logo-item"><img src="images/client-logos/5.jpg" alt="Client"></div>
      <div class="hero-logo-item"><img src="images/client-logos/6.jpg" alt="Client"></div>
    </div>
  </div>
</div>

<!-- SEARCH + FILTER BAR -->
<div class="filter-bar">
  <div class="container">
    <div class="row align-items-center">
      <div class="col-md-8">
        <div class="search-wrap">
          <i class="icofont-search si"></i>
          <input type="text" id="jobSearch" placeholder="Search by role, company or location…" autocomplete="off">
        </div>
      </div>
      <div class="col-md-4">
        <div class="filter-count" id="jobCount">
          Showing <strong><?= $total ?></strong> position<?= $total !== 1 ? 's' : '' ?>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- JOBS GRID -->
<section class="jobs-section">
  <div class="container">
    <?php if (count($jobs) > 0): ?>
    <div class="row g-4" id="jobGrid">
      <?php foreach ($jobs as $job): ?>
      <div class="col-md-6 col-lg-4 job-item"
           data-role="<?= strtolower(htmlspecialchars($job['role'])) ?>"
           data-company="<?= strtolower(htmlspecialchars($job['company'])) ?>"
           data-location="<?= strtolower(htmlspecialchars($job['location'])) ?>">
        <div class="job-card">
          <div class="job-role"><?= htmlspecialchars($job['role']) ?></div>

          <div class="job-meta">
            <span class="job-badge company"><i class="icofont-building"></i><?= htmlspecialchars($job['company']) ?></span>
            <span class="job-badge location"><i class="icofont-location-pin"></i><?= htmlspecialchars($job['location']) ?></span>
            <?php if (!empty($job['salary'])): ?>
            <span class="job-badge salary"><i class="icofont-dollar"></i><?= htmlspecialchars($job['salary']) ?></span>
            <?php endif; ?>
            <?php if (!empty($job['expirience'])): ?>
            <span class="job-badge exp"><i class="icofont-clock-time"></i><?= htmlspecialchars($job['expirience']) ?></span>
            <?php endif; ?>
          </div>

          <div class="job-desc">
            <?php
              $desc = strip_tags($job['description']);
              echo htmlspecialchars(mb_strimwidth($desc, 0, 120, '…'));
            ?>
          </div>

          <div class="job-actions">
            <a href="job-details.php?id=<?= $job['sl'] ?>" class="btn-view"><i class="icofont-eye"></i> View Details</a>
            <a href="apply-job.php?id=<?= $job['sl'] ?>" class="btn-apply"><i class="icofont-paper-plane"></i> Apply Now</a>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>

    <!-- Empty search result -->
    <div id="noResults" style="display:none;">
      <div class="no-jobs">
        <i class="icofont-search-2"></i>
        <h4>No Matching Jobs Found</h4>
        <p>Try a different keyword — or browse all positions below.</p>
        <button onclick="document.getElementById('jobSearch').value=''; filterJobs();" class="btn-apply" style="padding:12px 28px; border-radius:12px; font-size:14px;">Clear Search</button>
      </div>
    </div>

    <?php else: ?>
    <div class="no-jobs">
      <i class="icofont-briefcase"></i>
      <h4>No Job Openings Right Now</h4>
      <p>We're always growing — please check back soon for new opportunities.</p>
      <a href="index.html#contact" class="btn-apply" style="padding:12px 28px; border-radius:12px; font-size:14px; display:inline-flex; width:auto;">Contact Us</a>
    </div>
    <?php endif; ?>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-inner">
      <span>&copy; 2025 Skyzen Technologies LLC. All rights reserved.</span>
      <a href="privacy-policy.html">Privacy Policy</a>
    </div>
  </div>
</footer>

<script>
// ── Navbar scroll effect ──
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 50));

// ── Mobile nav toggle ──
document.getElementById('navToggle').addEventListener('click', function() {
  document.getElementById('navLinks').classList.toggle('open');
});
document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

// ── Live job search ──
function filterJobs() {
  const q     = document.getElementById('jobSearch').value.toLowerCase().trim();
  const items = document.querySelectorAll('.job-item');
  let   shown = 0;

  items.forEach(item => {
    const match = !q ||
      item.dataset.role.includes(q) ||
      item.dataset.company.includes(q) ||
      item.dataset.location.includes(q);
    item.style.display = match ? '' : 'none';
    if (match) shown++;
  });

  // Update count
  const countEl = document.getElementById('jobCount');
  countEl.innerHTML = `Showing <strong>${shown}</strong> position${shown !== 1 ? 's' : ''}`;

  // Show/hide no-results
  const noRes = document.getElementById('noResults');
  if (noRes) noRes.style.display = shown === 0 ? 'block' : 'none';
}

document.getElementById('jobSearch').addEventListener('input', filterJobs);
</script>
</body>
</html>
