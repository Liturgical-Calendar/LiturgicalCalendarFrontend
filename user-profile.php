<?php

/**
 * User Profile Page
 *
 * Displays the currently authenticated user's information.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php echo htmlspecialchars(_('User Profile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?> - <?php echo htmlspecialchars(_('Catholic Liturgical Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-user-circle me-2"></i><?php echo htmlspecialchars(_('User Profile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <div class="row">
        <div class="col-lg-8 col-xl-6">
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-id-card me-2"></i><?php echo htmlspecialchars(_('Account Information'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <table class="table table-borderless mb-0">
                        <tbody>
                            <?php if ($authHelper->name !== null) : ?>
                            <tr>
                                <th scope="row" class="text-muted" style="width: 40%;">
                                    <i class="fas fa-user me-2"></i><?php echo htmlspecialchars(_('Full Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td><?php echo htmlspecialchars($authHelper->name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></td>
                            </tr>
                            <?php endif; ?>

                            <?php if ($authHelper->givenName !== null || $authHelper->familyName !== null) : ?>
                            <tr>
                                <th scope="row" class="text-muted">
                                    <i class="fas fa-signature me-2"></i><?php echo htmlspecialchars(_('Given / Family Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td>
                                    <?php
                                    $nameParts = array_filter([
                                        $authHelper->givenName,
                                        $authHelper->familyName
                                    ]);
                                    echo htmlspecialchars(implode(' / ', $nameParts), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    ?>
                                </td>
                            </tr>
                            <?php endif; ?>

                            <tr>
                                <th scope="row" class="text-muted">
                                    <i class="fas fa-at me-2"></i><?php echo htmlspecialchars(_('Username'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td><?php echo htmlspecialchars($authHelper->username ?? '-', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></td>
                            </tr>

                            <?php if ($authHelper->email !== null) : ?>
                            <tr>
                                <th scope="row" class="text-muted">
                                    <i class="fas fa-envelope me-2"></i><?php echo htmlspecialchars(_('Email'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td>
                                    <?php echo htmlspecialchars($authHelper->email, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    <?php if ($authHelper->emailVerified) : ?>
                                        <span class="badge bg-success ms-2" title="<?php echo htmlspecialchars(_('Email verified'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                            <i class="fas fa-check"></i>
                                        </span>
                                    <?php else : ?>
                                        <span class="badge bg-warning text-dark ms-2" title="<?php echo htmlspecialchars(_('Email not verified'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endif; ?>

                            <?php if ($authHelper->sub !== null) : ?>
                            <tr>
                                <th scope="row" class="text-muted">
                                    <i class="fas fa-fingerprint me-2"></i><?php echo htmlspecialchars(_('User ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td><code class="user-select-all"><?php echo htmlspecialchars($authHelper->sub, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></code></td>
                            </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <?php if ($authHelper->roles !== null && count($authHelper->roles) > 0) : ?>
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-user-tag me-2"></i><?php echo htmlspecialchars(_('Roles'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <div class="d-flex flex-wrap gap-2">
                        <?php foreach ($authHelper->roles as $role) : ?>
                            <span class="badge bg-primary fs-6">
                                <i class="fas fa-shield-alt me-1"></i><?php echo htmlspecialchars($role, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <?php if ($authHelper->permissions !== null && count($authHelper->permissions) > 0) : ?>
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-key me-2"></i><?php echo htmlspecialchars(_('Permissions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <div class="d-flex flex-wrap gap-2">
                        <?php foreach ($authHelper->permissions as $permission) : ?>
                            <span class="badge bg-secondary fs-6">
                                <i class="fas fa-lock-open me-1"></i><?php echo htmlspecialchars($permission, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-clock me-2"></i><?php echo htmlspecialchars(_('Session Information'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <table class="table table-borderless mb-0">
                        <tbody>
                            <?php if ($authHelper->exp !== null) : ?>
                            <tr>
                                <th scope="row" class="text-muted" style="width: 40%;">
                                    <i class="fas fa-hourglass-end me-2"></i><?php echo htmlspecialchars(_('Session Expires'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td>
                                    <?php
                                    $expDate = new DateTime('@' . $authHelper->exp);
                                    $expDate->setTimezone(new DateTimeZone(date_default_timezone_get()));
                                    echo htmlspecialchars($expDate->format('Y-m-d H:i:s T'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    ?>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row" class="text-muted">
                                    <i class="fas fa-stopwatch me-2"></i><?php echo htmlspecialchars(_('Time Remaining'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </th>
                                <td id="timeRemaining">
                                    <?php
                                    $remaining = $authHelper->exp - time();
                                    if ($remaining > 0) {
                                        $hours   = floor($remaining / 3600);
                                        $minutes = floor(( $remaining % 3600 ) / 60);
                                        $seconds = $remaining % 60;
                                        if ($hours > 0) {
                                            echo sprintf('%1$d:%2$02d:%3$02d', $hours, $minutes, $seconds);
                                        } else {
                                            echo sprintf('%1$d:%2$02d', $minutes, $seconds);
                                        }
                                    } else {
                                        echo htmlspecialchars(_('Expired'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    }
                                    ?>
                                </td>
                            </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="d-flex gap-2">
                <a href="admin-dashboard.php" class="btn btn-primary" data-requires-auth>
                    <i class="fas fa-tachometer-alt me-2"></i><?php echo htmlspecialchars(_('Admin Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
                <button type="button" class="btn btn-outline-danger" id="logoutBtnProfile">
                    <i class="fas fa-sign-out-alt me-2"></i><?php echo htmlspecialchars(_('Logout'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Logout button handler
        const logoutBtn = document.getElementById('logoutBtnProfile');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function() {
                if (confirm(<?php echo json_encode(_('Are you sure you want to logout?')); ?>)) {
                    await Auth.logout();
                }
            });
        }

        // Update time remaining every second
        const timeRemainingEl = document.getElementById('timeRemaining');
        const sessionExp = <?php echo json_encode($authHelper->exp); ?>;

        if (timeRemainingEl && sessionExp) {
            const timerId = setInterval(function() {
                const remaining = sessionExp - Math.floor(Date.now() / 1000);
                if (remaining > 0) {
                    const hours = Math.floor(remaining / 3600);
                    const minutes = Math.floor((remaining % 3600) / 60);
                    const seconds = remaining % 60;
                    if (hours > 0) {
                        timeRemainingEl.textContent = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
                    } else {
                        timeRemainingEl.textContent = minutes + ':' + String(seconds).padStart(2, '0');
                    }
                } else {
                    timeRemainingEl.textContent = <?php echo json_encode(_('Expired')); ?>;
                    timeRemainingEl.classList.add('text-danger', 'fw-bold');
                    clearInterval(timerId);
                }
            }, 1000);
        }
    });
    </script>
</body>
</html>
