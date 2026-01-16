<?php

/**
 * Request Access Page
 *
 * Allows authenticated users to request a role (developer, calendar_editor, test_editor).
 * This page is shown after registration when a user has no roles assigned.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Valid roles that can be requested
$validRoles = [
    'developer'       => [
        'name'        => _('Developer'),
        'description' => _('API consumer - can register applications and generate API keys'),
        'icon'        => 'fas fa-code',
    ],
    'calendar_editor' => [
        'name'        => _('Calendar Editor'),
        'description' => _('Can edit national and diocesan calendar data'),
        'icon'        => 'fas fa-calendar-alt',
    ],
    'test_editor'     => [
        'name'        => _('Accuracy Test Editor'),
        'description' => _('Can create and manage accuracy tests'),
        'icon'        => 'fas fa-vial',
    ],
];

// Check if user already has roles
$hasRoles = $authHelper->roles !== null && count($authHelper->roles) > 0;

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <?php
    $requestAccessTitle = htmlspecialchars(_('Request Access'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $calendarTitle      = htmlspecialchars(_('Catholic Liturgical Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?>
    <title><?php echo $requestAccessTitle; ?> - <?php echo $calendarTitle; ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-user-shield me-2"></i><?php echo htmlspecialchars(_('Request Access'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <?php if ($hasRoles) : ?>
    <div class="alert alert-info" role="alert">
        <i class="fas fa-info-circle me-2"></i>
        <?php echo htmlspecialchars(_('You already have one or more roles assigned. You can request additional roles below.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </div>
    <?php else : ?>
    <div class="alert alert-warning" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <?php echo htmlspecialchars(_('Your account does not have any roles assigned yet. Please select a role below to request access.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </div>
    <?php endif; ?>

    <div class="row">
        <div class="col-lg-8 col-xl-6">
            <!-- Existing Requests Status -->
            <div class="card shadow mb-4" id="existingRequestsCard">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-history me-2"></i><?php echo htmlspecialchars(_('Your Role Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body" id="existingRequestsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>

            <!-- Request New Role Form -->
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-plus-circle me-2"></i><?php echo htmlspecialchars(_('Request a Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <form id="roleRequestForm">
                        <div class="mb-4">
                            <label class="form-label fw-bold"><?php echo htmlspecialchars(_('Select a Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <div class="row g-3">
                                <?php foreach ($validRoles as $roleKey => $roleInfo) : ?>
                                <div class="col-12">
                                    <div class="form-check role-option">
                                        <?php $safeRoleKey = htmlspecialchars($roleKey, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                        <input class="form-check-input" type="radio"
                                            name="role"
                                            id="role_<?php echo $safeRoleKey; ?>"
                                            value="<?php echo $safeRoleKey; ?>">
                                        <label class="form-check-label w-100" for="role_<?php echo htmlspecialchars($roleKey, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                            <div class="card border-0 bg-light">
                                                <div class="card-body py-2">
                                                    <div class="d-flex align-items-center">
                                                        <i class="<?php echo htmlspecialchars($roleInfo['icon'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?> fa-2x text-primary me-3"></i>
                                                        <div>
                                                            <strong><?php echo htmlspecialchars($roleInfo['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></strong>
                                                            <p class="mb-0 small text-muted"><?php echo htmlspecialchars($roleInfo['description'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <div class="mb-4">
                            <?php
                            $justificationLabel = htmlspecialchars(_('Justification'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            $optionalLabel      = htmlspecialchars(_('optional'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            $placeholderText    = htmlspecialchars(_('Please describe why you need this role...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            $helpText           = htmlspecialchars(_('Providing a justification helps administrators review your request faster.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            ?>
                            <label for="justification" class="form-label fw-bold">
                                <?php echo $justificationLabel; ?>
                                <span class="text-muted fw-normal">(<?php echo $optionalLabel; ?>)</span>
                            </label>
                            <textarea class="form-control" id="justification" name="justification"
                                rows="3" placeholder="<?php echo $placeholderText; ?>"></textarea>
                            <div class="form-text"><?php echo $helpText; ?></div>
                        </div>

                        <div id="formAlerts"></div>

                        <button type="submit" class="btn btn-primary" id="submitBtn">
                            <i class="fas fa-paper-plane me-2"></i><?php echo htmlspecialchars(_('Submit Request'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </button>
                    </form>
                </div>
            </div>

            <div class="d-flex gap-2">
                <a href="user-profile.php" class="btn btn-outline-secondary">
                    <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Profile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <script>
    document.addEventListener('DOMContentLoaded', async function() {
        const ApiUrl = <?php echo json_encode($apiBaseUrl); ?>;
        const existingRequestsBody = document.getElementById('existingRequestsBody');
        const roleRequestForm = document.getElementById('roleRequestForm');
        const formAlerts = document.getElementById('formAlerts');
        const submitBtn = document.getElementById('submitBtn');
        const currentRoles = <?php echo json_encode($authHelper->roles ?? []); ?>;
        const currentUserEmail = <?php echo json_encode($authHelper->email ?? ''); ?>;
        const currentUserName = <?php echo json_encode($authHelper->name ?? $authHelper->username ?? ''); ?>;

        // Role display names
        const roleNames = {
            'developer': <?php echo json_encode(_('Developer')); ?>,
            'calendar_editor': <?php echo json_encode(_('Calendar Editor')); ?>,
            'test_editor': <?php echo json_encode(_('Accuracy Test Editor')); ?>
        };

        // Status display info
        const statusInfo = {
            'pending': { class: 'bg-warning text-dark', icon: 'fas fa-clock', text: <?php echo json_encode(_('Pending')); ?> },
            'approved': { class: 'bg-success', icon: 'fas fa-check', text: <?php echo json_encode(_('Approved')); ?> },
            'rejected': { class: 'bg-danger', icon: 'fas fa-times', text: <?php echo json_encode(_('Rejected')); ?> }
        };

        /**
         * Load existing role requests
         */
        async function loadExistingRequests() {
            try {
                const response = await fetch(ApiUrl + '/auth/role-requests', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    // API uses application/problem+json format with 'detail' and 'title' fields
                    const errorMsg = errorData.detail || errorData.error || errorData.message || errorData.title || `HTTP ${response.status}`;
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                displayExistingRequests(data.requests || []);
            } catch (error) {
                console.error('Error loading requests:', error);
                const errorMessage = error.message || <?php echo json_encode(_('Unknown error')); ?>;
                existingRequestsBody.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${<?php echo json_encode(_('Could not load your existing requests.')); ?>}
                        <br><small class="text-muted">${escapeHtml(errorMessage)}</small>
                    </div>
                `;
            }
        }

        /**
         * Display existing requests in the card
         */
        function displayExistingRequests(requests) {
            if (requests.length === 0) {
                existingRequestsBody.innerHTML = `
                    <p class="text-muted mb-0">
                        <i class="fas fa-inbox me-2"></i>
                        ${<?php echo json_encode(_('You have not made any role requests yet.')); ?>}
                    </p>
                `;
                return;
            }

            let html = '<div class="list-group list-group-flush">';
            for (const request of requests) {
                const status = statusInfo[request.status] || statusInfo['pending'];
                const roleName = roleNames[request.requested_role] || request.requested_role;
                const createdAt = new Date(request.created_at).toLocaleDateString();

                html += `
                    <div class="list-group-item px-0">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <strong>${escapeHtml(roleName)}</strong>
                                <br><small class="text-muted">${<?php echo json_encode(_('Requested')); ?>}: ${createdAt}</small>
                                <?php // phpcs:ignore Generic.Files.LineLength ?>
                                ${request.justification ? `<br><small class="text-muted fst-italic">"${escapeHtml(request.justification.substring(0, 100))}${request.justification.length > 100 ? '...' : ''}"</small>` : ''}
                                <?php // phpcs:ignore Generic.Files.LineLength ?>
                                ${request.review_notes ? `<br><small class="text-secondary"><strong>${<?php echo json_encode(_('Admin notes')); ?>}:</strong> ${escapeHtml(request.review_notes)}</small>` : ''}
                            </div>
                            <span class="badge ${status.class}">
                                <i class="${status.icon} me-1"></i>${status.text}
                            </span>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
            existingRequestsBody.innerHTML = html;

            // Update form - disable roles that already have pending requests
            updateFormState(requests);
        }

        /**
         * Update form state based on existing requests
         */
        function updateFormState(requests) {
            const pendingRoles = requests
                .filter(r => r.status === 'pending')
                .map(r => r.requested_role);

            document.querySelectorAll('input[name="role"]').forEach(input => {
                const role = input.value;
                const hasPending = pendingRoles.includes(role);
                const hasRole = currentRoles.includes(role);
                const label = input.closest('.role-option').querySelector('.card');

                if (hasPending || hasRole) {
                    input.disabled = true;
                    label.classList.add('opacity-50');

                    // Add badge
                    const badge = document.createElement('span');
                    badge.className = 'badge ' + (hasRole ? 'bg-success' : 'bg-warning text-dark') + ' ms-2';
                    badge.innerHTML = hasRole
                        ? '<i class="fas fa-check me-1"></i>' + <?php echo json_encode(_('Already have')); ?>
                        : '<i class="fas fa-clock me-1"></i>' + <?php echo json_encode(_('Pending')); ?>;

                    const strong = label.querySelector('strong');
                    if (strong && !strong.querySelector('.badge')) {
                        strong.appendChild(badge);
                    }
                }
            });
        }

        /**
         * Handle form submission
         */
        roleRequestForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            formAlerts.innerHTML = '';

            const role = document.querySelector('input[name="role"]:checked');
            if (!role) {
                showAlert('danger', <?php echo json_encode(_('Please select a role.')); ?>);
                return;
            }

            const justification = document.getElementById('justification').value.trim();

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>' + <?php echo json_encode(_('Submitting...')); ?>;

            try {
                const response = await fetch(ApiUrl + '/auth/role-requests', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        role: role.value,
                        justification: justification || null,
                        email: currentUserEmail || null,
                        name: currentUserName || null
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Request failed');
                }

                showAlert('success', data.message || <?php echo json_encode(_('Your role request has been submitted successfully.')); ?>);

                // Reset form and reload requests
                roleRequestForm.reset();
                await loadExistingRequests();
            } catch (error) {
                console.error('Error submitting request:', error);
                showAlert('danger', error.message || <?php echo json_encode(_('Failed to submit request. Please try again.')); ?>);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + <?php echo json_encode(_('Submit Request')); ?>;
            }
        });

        /**
         * Show alert message
         */
        function showAlert(type, message) {
            formAlerts.innerHTML = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${escapeHtml(message)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
        }

        /**
         * Escape HTML entities
         */
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Highlight selected role
        document.querySelectorAll('input[name="role"]').forEach(input => {
            input.addEventListener('change', function() {
                document.querySelectorAll('.role-option .card').forEach(card => {
                    card.classList.remove('border-primary', 'border-2');
                    card.classList.add('border-0');
                });
                if (this.checked) {
                    const card = this.closest('.role-option').querySelector('.card');
                    card.classList.remove('border-0');
                    card.classList.add('border-primary', 'border-2');
                }
            });
        });

        // Load existing requests on page load
        await loadExistingRequests();
    });
    </script>

    <style>
    .role-option .form-check-input {
        margin-top: 0.75rem;
    }
    .role-option .card {
        cursor: pointer;
        transition: border-color 0.15s ease-in-out;
    }
    .role-option .card:hover:not(.opacity-50) {
        border-color: var(--bs-primary) !important;
        border-width: 1px !important;
    }
    </style>
</body>
</html>
