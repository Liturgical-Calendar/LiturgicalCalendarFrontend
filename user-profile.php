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
    <title><?php
        $profileTitle  = _('User Profile');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($profileTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
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
                                        <button type="button" class="btn btn-outline-primary btn-sm ms-2" id="resendVerificationBtn">
                                            <i class="fas fa-paper-plane me-1"></i><?php echo htmlspecialchars(_('Resend verification'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                        </button>
                                        <button type="button" class="btn btn-outline-success btn-sm ms-2" id="refreshSessionBtn"
                                                title="<?php echo htmlspecialchars(_('Click after verifying your email to update your session'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                            <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh session'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                        </button>
                                        <div id="resendVerificationAlert" class="mt-2"></div>
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

            <div class="card shadow mb-4">
                <div class="card-header py-3 d-flex justify-content-between align-items-center">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-user-tag me-2"></i><?php echo htmlspecialchars(_('Roles'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                    <?php if ($authHelper->emailVerified) : ?>
                    <a href="request-access.php" class="btn btn-outline-primary btn-sm" data-requires-auth>
                        <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Request Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </a>
                    <?php else : ?>
                    <button type="button" class="btn btn-outline-secondary btn-sm" disabled
                            title="<?php echo htmlspecialchars(_('Email verification required'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                        <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Request Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <?php endif; ?>
                </div>
                <div class="card-body">
                    <?php if (!$authHelper->emailVerified) : ?>
                    <div class="alert alert-warning mb-3">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <?php
                        $verifyEmailMsg = _('You must verify your email address before you can request a role. Please check your inbox for a verification email.');
                        echo htmlspecialchars($verifyEmailMsg, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>
                    </div>
                    <?php endif; ?>
                    <?php if ($authHelper->roles !== null && count($authHelper->roles) > 0) : ?>
                    <div class="d-flex flex-wrap gap-2">
                        <?php foreach ($authHelper->roles as $role) : ?>
                            <span class="badge bg-primary fs-6">
                                <i class="fas fa-shield-alt me-1"></i><?php echo htmlspecialchars($role, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                    <?php else : ?>
                    <p class="text-muted mb-0">
                        <?php $noRolesMsg = _('No roles assigned yet. Request a role to access additional features.'); ?>
                        <i class="fas fa-info-circle me-2"></i><?php
                            echo htmlspecialchars($noRolesMsg, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>
                    </p>
                    <?php endif; ?>
                </div>
            </div>

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
                                <td>
                                    <span id="timeRemaining" aria-hidden="true"><?php
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
                                    ?></span>
                                    <span id="timeRemainingAnnounce" class="visually-hidden" aria-live="polite"></span>
                                </td>
                            </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <?php
            $hasCalendarRole = $authHelper->hasRole('admin')
                || $authHelper->hasRole('calendar_editor')
                || $authHelper->hasRole('test_editor');
            ?>
            <div class="d-flex gap-2 flex-wrap">
                <?php if ($hasCalendarRole) : ?>
                <a href="admin-dashboard.php" class="btn btn-primary" data-requires-auth>
                    <i class="fas fa-tachometer-alt me-2"></i><?php echo htmlspecialchars(_('Admin Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
                <?php endif; ?>
                <?php if ($authHelper->hasRole('developer')) : ?>
                <a href="developer-dashboard.php" class="btn btn-info" data-requires-auth>
                    <i class="fas fa-code me-2"></i><?php echo htmlspecialchars(_('Developer Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
                <?php endif; ?>
                <button type="button" class="btn btn-outline-danger" id="logoutBtnProfile">
                    <i class="fas fa-sign-out-alt me-2"></i><?php echo htmlspecialchars(_('Logout'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const ApiUrl = <?php echo json_encode($apiBaseUrl); ?>;

        // Logout button handler
        const logoutBtn = document.getElementById('logoutBtnProfile');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function() {
                if (confirm(<?php echo json_encode(_('Are you sure you want to logout?')); ?>)) {
                    await Auth.logout();
                }
            });
        }

        // Refresh session button handler
        const refreshSessionBtn = document.getElementById('refreshSessionBtn');
        if (refreshSessionBtn) {
            refreshSessionBtn.addEventListener('click', async function() {
                refreshSessionBtn.disabled = true;
                const originalHtml = refreshSessionBtn.innerHTML;
                refreshSessionBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + <?php echo json_encode(_('Refreshing...')); ?>;

                try {
                    const success = await Auth.refreshToken();
                    if (success) {
                        // Reload page to show updated verification status
                        window.location.reload();
                    } else {
                        throw new Error(<?php echo json_encode(_('Session refresh failed')); ?>);
                    }
                } catch (error) {
                    console.error('Error refreshing session:', error);
                    alert(error.message || <?php echo json_encode(_('Failed to refresh session. Please try logging out and back in.')); ?>);
                    refreshSessionBtn.disabled = false;
                    refreshSessionBtn.innerHTML = originalHtml;
                }
            });
        }

        // Resend verification email button handler
        const resendBtn = document.getElementById('resendVerificationBtn');
        const resendAlert = document.getElementById('resendVerificationAlert');
        if (resendBtn && resendAlert) {
            resendBtn.addEventListener('click', async function() {
                resendBtn.disabled = true;
                const originalHtml = resendBtn.innerHTML;
                resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + <?php echo json_encode(_('Sending...')); ?>;
                resendAlert.innerHTML = '';

                try {
                    const response = await fetch(ApiUrl + '/auth/email-verification/resend', {
                        method: 'POST',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include'
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || data.error || <?php echo json_encode(_('Failed to send verification email')); ?>);
                    }

                    const successMsg = <?php echo json_encode(_('Verification email sent. After clicking the verification link, use the "Refresh session" button to update your status.')); ?>;
                    resendAlert.innerHTML = `
                        <div class="alert alert-success alert-dismissible fade show py-2" role="alert">
                            <i class="fas fa-check-circle me-2"></i>
                            ${escapeHtml(data.message || successMsg)}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>
                    `;
                    // Keep button disabled for 60 seconds to prevent spam
                    setTimeout(() => {
                        resendBtn.disabled = false;
                        resendBtn.innerHTML = originalHtml;
                    }, 60000);
                } catch (error) {
                    console.error('Error resending verification:', error);
                    resendAlert.innerHTML = `
                        <div class="alert alert-danger alert-dismissible fade show py-2" role="alert">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${escapeHtml(error.message || <?php echo json_encode(_('Failed to send verification email. Please try again.')); ?>)}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>
                    `;
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = originalHtml;
                }
            });
        }

        /**
         * Escape HTML entities
         */
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Update time remaining every second
        const timeRemainingEl = document.getElementById('timeRemaining');
        const announceEl = document.getElementById('timeRemainingAnnounce');
        const sessionExp = <?php echo json_encode($authHelper->exp); ?>;

        if (timeRemainingEl && sessionExp) {
            // Track which milestones have been announced to avoid repetition
            const announcedMilestones = new Set();
            const milestones = [300, 60, 30]; // 5 minutes, 1 minute, 30 seconds

            // Announcement messages
            const announceMessages = {
                300: <?php echo json_encode(_('Session expires in 5 minutes')); ?>,
                60: <?php echo json_encode(_('Session expires in 1 minute')); ?>,
                30: <?php echo json_encode(_('Session expires in 30 seconds')); ?>,
                0: <?php echo json_encode(_('Session expired')); ?>
            };

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

                    // Announce at meaningful intervals for screen readers
                    if (announceEl) {
                        for (const milestone of milestones) {
                            if (remaining <= milestone && !announcedMilestones.has(milestone)) {
                                announcedMilestones.add(milestone);
                                announceEl.textContent = announceMessages[milestone];
                                break;
                            }
                        }
                    }
                } else {
                    timeRemainingEl.textContent = <?php echo json_encode(_('Expired')); ?>;
                    timeRemainingEl.classList.add('text-danger', 'fw-bold');
                    if (announceEl && !announcedMilestones.has(0)) {
                        announcedMilestones.add(0);
                        announceEl.textContent = announceMessages[0];
                    }
                    clearInterval(timerId);
                }
            }, 1000);
        }
    });
    </script>
</body>
</html>
