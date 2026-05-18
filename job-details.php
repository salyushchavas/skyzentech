<?php
require('dbconn.php');

$row = null;
if (isset($_GET['id']) && is_numeric($_GET['id'])) {
    $id = (int) $_GET['id'];
    $stmt = $conn->prepare("SELECT * FROM postings WHERE sl = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $row ? htmlspecialchars($row['role']) . ' | ' : ''; ?>Skyzen Technologies LLC</title>
    <link rel="shortcut icon" href="/images/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="plugins/bootstrap/css/bootstrap.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="plugins/icofont/icofont.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .detail-wrap {
            padding: 120px 0 70px;
            background: #f4f6f9;
            min-height: 80vh;
        }
        .detail-card {
            background: #fff;
            border-radius: 14px;
            padding: 45px;
            box-shadow: 0 6px 28px rgba(0,0,0,0.08);
        }
        .job-role {
            font-size: 32px;
            font-weight: 700;
            color: #0f2238;
            margin-bottom: 8px;
        }
        .job-meta-badges { margin-bottom: 25px; }
        .job-meta-badges span {
            display: inline-block;
            background: #eef5fb;
            color: #0f2238;
            border-radius: 20px;
            padding: 5px 16px;
            font-size: 14px;
            font-weight: 500;
            margin-right: 10px;
            margin-bottom: 8px;
        }
        .job-meta-badges span i { margin-right: 5px; color: #fb9b47; }
        .desc-heading {
            font-size: 18px;
            font-weight: 600;
            color: #0f2238;
            margin: 25px 0 12px;
            border-left: 4px solid #fb9b47;
            padding-left: 12px;
        }
        .job-description {
            font-size: 15px;
            line-height: 1.9;
            color: #4d5359;
            white-space: pre-line;
        }
        .action-btns { margin-top: 35px; }
        .action-btns .btn { margin-right: 12px; margin-bottom: 10px; border-radius: 8px; padding: 10px 24px; font-weight: 500; }
        .error-card {
            background: #fff;
            padding: 60px;
            border-radius: 14px;
            box-shadow: 0 6px 28px rgba(0,0,0,0.08);
            text-align: center;
        }
        .error-card i { font-size: 56px; color: #fb9b47; margin-bottom: 20px; display: block; }
        .error-card h4 { color: #0f2238; }
    </style>
</head>
<body>

<!-- Header -->
<header>
    <div class="header-top-bar">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-7">
                    <ul class="top-bar-info list-inline-item pl-0 mb-0">
                        <li class="list-inline-item"><a href="mailto:info@skyzentech.com"><i class="icofont-email mr-2"></i>info@skyzentech.com</a></li>
                        <li class="list-inline-item"><i class="icofont-phone mr-2"></i><a href="tel:4699453339">+1 469-945-3339</a></li>
                    </ul>
                </div>
                <div class="col-lg-5">
                    <ul class="list-inline footer-socials text-right" style="margin:0;">
                        <li class="list-inline-item"><a href="https://www.linkedin.com/company/skyzen-tech-llc/" target="_blank"><i class="icofont-linkedin"></i></a></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <nav class="navbar navbar-expand-lg navigation" id="navbar">
        <div class="container">
            <a class="navbar-brand" href="index.html">
                <img src="images/skyzen-logo.png" alt="Skyzen Logo">
            </a>
            <button class="navbar-toggler collapsed" type="button" data-toggle="collapse" data-target="#navbarmain" aria-controls="navbarmain" aria-expanded="false" aria-label="Toggle navigation">
                <span class="icofont-navigation-menu"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarmain">
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item"><a class="nav-link" href="index.html">HOME</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#what-we-do-block">WHAT WE DO?</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#why-we">WHY WE?</a></li>
                    <li class="nav-item"><a class="nav-link" href="index.html#our-expertise-block">OUR EXPERTISE</a></li>
                    <li class="nav-item active"><a class="nav-link" href="jobs.php">CAREER SUPPORT</a></li>
                    <li class="nav-item">
                        <a href="index.html#contact" class="btn btn-main btn-round-full" style="margin-left:15px;">CONTACT US</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
</header>
<!-- End Header -->

<section class="detail-wrap">
    <div class="container">
        <?php if ($row): ?>
            <div class="detail-card">
                <div class="job-role"><?php echo htmlspecialchars($row['role']); ?></div>

                <div class="job-meta-badges">
                    <span><i class="icofont-building-alt"></i><?php echo htmlspecialchars($row['company']); ?></span>
                    <span><i class="icofont-location-pin"></i><?php echo htmlspecialchars($row['location']); ?></span>
                </div>

                <div class="divider my-3"></div>

                <div class="desc-heading">Job Description</div>
                <div class="job-description"><?php echo htmlspecialchars($row['description']); ?></div>

                <div class="action-btns">
                    <a href="apply-job.php?id=<?php echo urlencode($row['sl']); ?>" class="btn btn-main">Apply Now</a>
                    <a href="jobs.php" class="btn btn-outline-secondary">Back to Jobs</a>
                </div>
            </div>
        <?php else: ?>
            <div class="error-card">
                <i class="icofont-warning"></i>
                <h4>Job Not Found</h4>
                <p>The job posting you're looking for may have been removed or doesn't exist.</p>
                <a href="jobs.php" class="btn btn-main btn-round-full mt-3">Browse All Jobs</a>
            </div>
        <?php endif; ?>
    </div>
</section>

<!-- Footer -->
<div class="page-end-copyright">
    <span>&copy; Copyright Reserved to <span class="text-color">Skyzen</span></span>
    <span class="page-end-separator">|</span>
    <a href="privacy-policy.html">Privacy Policy</a>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
<script src="plugins/bootstrap/js/bootstrap.min.js"></script>
<script src="js/script.js"></script>
<script>
$(window).scroll(function(){
    if ($(this).scrollTop() > 50) {
        $('header').addClass('header-fixed');
    } else {
        $('header').removeClass('header-fixed');
    }
});
</script>
</body>
</html>
