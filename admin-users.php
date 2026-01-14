<?php

/**
 * Admin Users Management Page
 *
 * Allows administrators to view all users with roles and revoke roles.
 * Lists users who have been granted roles in the Zitadel project.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Check if user has admin role
$isAdmin = $authHelper->roles !== null && in_array('admin', $authHelper->roles, true);

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $usersTitle    = _('Users Management');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($usersTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-users me-2"></i><?php echo htmlspecialchars(_('Users Management'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <?php if (!$isAdmin) : ?>
    <div class="alert alert-danger" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <?php echo htmlspecialchars(_('You do not have permission to access this page. Administrator role required.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </div>
    <?php else : ?>
    <p class="text-muted mb-4"><?php
        $manageUsersDesc = _('Manage users who have been granted roles in the system. You can view user information and revoke roles.');
        echo htmlspecialchars($manageUsersDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <!-- Users Table Card -->
    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-users me-2"></i><?php echo htmlspecialchars(_('Users with Roles'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </h6>
            <button class="btn btn-outline-primary btn-sm" id="refreshBtn">
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body" id="usersTableBody">
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2">
        <a href="admin-dashboard.php" class="btn btn-outline-secondary">
            <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Revoke Role Confirmation Modal -->
    <div class="modal fade" id="revokeModal" tabindex="-1" aria-labelledby="revokeModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="revokeModalLabel">
                        <i class="fas fa-user-minus me-2"></i><?php echo htmlspecialchars(_('Revoke Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <p id="revokeConfirmText"></p>
                    <div id="modalAlerts"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmRevokeBtn">
                        <i class="fas fa-user-minus me-1"></i><?php echo htmlspecialchars(_('Revoke Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <?php endif; ?>

    <?php include_once('./layout/footer.php'); ?>

    <?php if ($isAdmin) : ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const ApiUrl = <?php echo json_encode($apiBaseUrl); ?>;
        const usersTableBody = document.getElementById('usersTableBody');
        const refreshBtn = document.getElementById('refreshBtn');
        const revokeModal = new bootstrap.Modal(document.getElementById('revokeModal'));
        const revokeConfirmText = document.getElementById('revokeConfirmText');
        const modalAlerts = document.getElementById('modalAlerts');
        const confirmRevokeBtn = document.getElementById('confirmRevokeBtn');

        let currentUserId = null;
        let currentRole = null;
        let currentUserName = null;

        // Role display names
        const roleNames = {
            'admin': <?php echo json_encode(_('Administrator')); ?>,
            'developer': <?php echo json_encode(_('Developer')); ?>,
            'calendar_editor': <?php echo json_encode(_('Calendar Editor')); ?>,
            'test_editor': <?php echo json_encode(_('Accuracy Test Editor')); ?>
        };

        /**
         * Load users from the API
         */
        async function loadUsers() {
            usersTableBody.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-spinner fa-spin me-2"></i>${<?php echo json_encode(_('Loading...')); ?>}
                </div>
            `;

            try {
                const response = await fetch(ApiUrl + '/admin/users', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to load users');
                }

                const data = await response.json();
                displayUsers(data.users || []);
            } catch (error) {
                console.error('Error loading users:', error);
                usersTableBody.innerHTML = `
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${<?php echo json_encode(_('Failed to load users. Please try again later.')); ?>}
                    </div>
                `;
            }
        }

        /**
         * Display users in a table
         */
        function displayUsers(users) {
            if (users.length === 0) {
                usersTableBody.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <p class="mb-0">${<?php echo json_encode(_('No users with roles found.')); ?>}</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
            html += `
                <thead>
                    <tr>
                        <th>${<?php echo json_encode(_('User')); ?>}</th>
                        <th>${<?php echo json_encode(_('Roles')); ?>}</th>
                        <th>${<?php echo json_encode(_('User ID')); ?>}</th>
                    </tr>
                </thead>
                <tbody>
            `;

            for (const user of users) {
                const displayName = user.displayName || user.preferredLoginName || user.userId;
                const email = user.email || '';

                // Build roles badges with revoke buttons
                let rolesHtml = '';
                if (user.roles && user.roles.length > 0) {
                    for (const role of user.roles) {
                        const roleName = roleNames[role] || role;
                        const badgeClass = role === 'admin' ? 'bg-danger' : 'bg-primary';
                        rolesHtml += `
                            <span class="badge ${badgeClass} me-1 mb-1">
                                ${escapeHtml(roleName)}
                                <button type="button" class="btn-close btn-close-white ms-1 revoke-btn"
                                        style="font-size: 0.6em;"
                                        data-user-id="${escapeHtml(user.userId)}"
                                        data-role="${escapeHtml(role)}"
                                        data-user-name="${escapeHtml(displayName)}"
                                        data-role-name="${escapeHtml(roleName)}"
                                        title="${<?php echo json_encode(_('Revoke this role')); ?>}">
                                </button>
                            </span>
                        `;
                    }
                } else {
                    rolesHtml = `<span class="text-muted">${<?php echo json_encode(_('No roles')); ?>}</span>`;
                }

                html += `
                    <tr>
                        <td>
                            <strong>${escapeHtml(displayName)}</strong>
                            ${email ? `<br><small class="text-muted">${escapeHtml(email)}</small>` : ''}
                        </td>
                        <td>${rolesHtml}</td>
                        <td>
                            <small class="text-muted">${escapeHtml(user.userId)}</small>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            usersTableBody.innerHTML = html;

            // Add event listeners to revoke buttons
            document.querySelectorAll('.revoke-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openRevokeModal(this.dataset);
                });
            });
        }

        /**
         * Open the revoke confirmation modal
         */
        function openRevokeModal(data) {
            currentUserId = data.userId;
            currentRole = data.role;
            currentUserName = data.userName;

            revokeConfirmText.innerHTML = `
                ${<?php echo json_encode(_('Are you sure you want to revoke the role')); ?>}
                <strong>${escapeHtml(data.roleName)}</strong>
                ${<?php echo json_encode(_('from user')); ?>}
                <strong>${escapeHtml(data.userName)}</strong>?
            `;
            modalAlerts.innerHTML = '';
            revokeModal.show();
        }

        /**
         * Handle revoke confirmation
         */
        confirmRevokeBtn.addEventListener('click', async function() {
            if (!currentUserId || !currentRole) return;

            confirmRevokeBtn.disabled = true;
            const originalText = confirmRevokeBtn.innerHTML;
            confirmRevokeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + <?php echo json_encode(_('Revoking...')); ?>;

            try {
                const response = await fetch(`${ApiUrl}/admin/users/${encodeURIComponent(currentUserId)}/roles/${encodeURIComponent(currentRole)}`, {
                    method: 'DELETE',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Failed to revoke role');
                }

                // Show success message
                modalAlerts.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        ${escapeHtml(data.message || <?php echo json_encode(_('Role revoked successfully.')); ?>)}
                    </div>
                `;

                // Reload users after a short delay
                setTimeout(() => {
                    revokeModal.hide();
                    loadUsers();
                }, 1500);
            } catch (error) {
                console.error('Error revoking role:', error);
                modalAlerts.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${escapeHtml(error.message || <?php echo json_encode(_('Failed to revoke role. Please try again.')); ?>)}
                    </div>
                `;
                confirmRevokeBtn.disabled = false;
                confirmRevokeBtn.innerHTML = originalText;
            }
        });

        /**
         * Refresh button handler
         */
        refreshBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            icon.classList.add('fa-spin');
            loadUsers().finally(() => {
                icon.classList.remove('fa-spin');
            });
        });

        /**
         * Escape HTML entities
         */
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Load users on page load
        loadUsers();
    });
    </script>
    <?php endif; ?>
</body>
</html>
