<!-- Login Modal for JWT Authentication -->
<div class="modal fade" id="loginModal" tabindex="-1" aria-labelledby="loginModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="loginModalLabel"><?php echo _('Administrator Login'); ?></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="loginForm">
                    <div class="mb-3">
                        <label for="loginUsername" class="form-label"><?php echo _('Username'); ?></label>
                        <input type="text" class="form-control" id="loginUsername" name="username" required autocomplete="username">
                    </div>
                    <div class="mb-3">
                        <label for="loginPassword" class="form-label"><?php echo _('Password'); ?></label>
                        <div class="input-group">
                            <input type="password" class="form-control" id="loginPassword" name="password" required autocomplete="current-password">
                            <button class="btn btn-outline-secondary" type="button" id="togglePassword" title="<?php echo _('Show password'); ?>">
                                <i class="fas fa-eye" id="togglePasswordIcon"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="rememberMe" name="rememberMe">
                        <label class="form-check-label" for="rememberMe"><?php echo _('Remember me'); ?></label>
                    </div>
                    <div class="alert alert-danger d-none" id="loginError" role="alert"></div>
                    <!-- Hidden submit button to enable Enter key submission -->
                    <button type="submit" class="d-none" aria-hidden="true"></button>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo _('Cancel'); ?></button>
                <button type="button" class="btn btn-primary" id="loginSubmit"><?php echo _('Login'); ?></button>
            </div>
        </div>
    </div>
</div>

<script>
// Module-scoped variables to avoid global pollution
let loginModal = null;
let loginSuccessCallback = null;
let expiryWarningShown = false;

/**
 * Initialize authentication UI components
 */
document.addEventListener('DOMContentLoaded', () => {
    // Guard against missing Auth dependency
    if (typeof Auth === 'undefined') {
        console.error('Auth module not loaded - authentication UI will not function');
        return;
    }

    updateAuthUI();

    // Login button click handler
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            showLoginModal();
        });
    }

    // Logout button click handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm(<?php echo json_encode(_('Are you sure you want to logout?')); ?>)) {
                await Auth.logout();
            }
        });
    }

    // Login form submit handler
    const loginSubmit = document.getElementById('loginSubmit');
    if (loginSubmit) {
        loginSubmit.addEventListener('click', async () => {
            await handleLogin();
        });
    }

    // Allow Enter key to submit login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });
    }

    // Toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('loginPassword');
            const toggleIcon = document.getElementById('togglePasswordIcon');
            const toggleButton = document.getElementById('togglePassword');

            if (passwordInput && toggleIcon && toggleButton) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.classList.remove('fa-eye');
                    toggleIcon.classList.add('fa-eye-slash');
                    toggleButton.title = <?php echo json_encode(_('Hide password')); ?>;
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.classList.remove('fa-eye-slash');
                    toggleIcon.classList.add('fa-eye');
                    toggleButton.title = <?php echo json_encode(_('Show password')); ?>;
                }
            }
        });
    }

    // Start session expiry warnings (debounced to show only once per expiry period)
    if (typeof toastr !== 'undefined') {
        Auth.startExpiryWarning((message) => {
            if (expiryWarningShown) return;
            expiryWarningShown = true;
            toastr.warning(message, <?php echo json_encode(_('Session Expiring')); ?>);
        });
    } else {
        // Fallback to console if toastr is not available
        Auth.startExpiryWarning((message) => {
            if (expiryWarningShown) return;
            expiryWarningShown = true;
            console.warn('Session expiring:', message);
        });
    }

    // Focus username input when login modal is shown
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) {
        loginModalElement.addEventListener('shown.bs.modal', () => {
            const usernameInput = document.getElementById('loginUsername');
            if (usernameInput) {
                usernameInput.focus();
            }
        });
    }

    // Initialize permission-based UI elements
    initPermissionUI();
});

/**
 * Show login modal
 *
 * @param {Function} onSuccess - Callback to execute after successful login
 */
function showLoginModal(onSuccess = null) {
    // Guard against missing bootstrap or modal element
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap library not loaded - cannot show login modal');
        return;
    }

    const loginModalElement = document.getElementById('loginModal');
    if (!loginModalElement) {
        console.error('Login modal element not found');
        return;
    }

    // Initialize modal instance only once
    if (!loginModal) {
        loginModal = new bootstrap.Modal(loginModalElement);
    }

    // Store success callback in module scope
    if (onSuccess) {
        if (typeof onSuccess === 'function') {
            loginSuccessCallback = onSuccess;
        } else {
            console.warn('showLoginModal: onSuccess callback should be a function');
        }
    }

    // Clear previous errors and form values
    const loginError = document.getElementById('loginError');
    const loginForm = document.getElementById('loginForm');

    if (loginError) {
        loginError.classList.add('d-none');
    }
    if (loginForm) {
        loginForm.reset();
    }

    loginModal.show();
}

/**
 * Handle login form submission
 */
async function handleLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const rememberMeInput = document.getElementById('rememberMe');
    const errorDiv = document.getElementById('loginError');
    const loginSubmit = document.getElementById('loginSubmit');

    // Guard against missing form elements
    if (!usernameInput || !passwordInput || !rememberMeInput || !errorDiv || !loginSubmit) {
        console.error('Login form elements not found');
        return;
    }

    // Guard against rapid double-submits
    if (loginSubmit.disabled) {
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeInput.checked;

    if (!username || !password) {
        errorDiv.textContent = <?php echo json_encode(_('Please enter both username and password')); ?>;
        errorDiv.classList.remove('d-none');
        return;
    }

    try {
        // Show loading state
        loginSubmit.disabled = true;
        loginSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + <?php echo json_encode(_('Logging in...')); ?>;

        await Auth.login(username, password, rememberMe);

        // Hide modal with proper cleanup after transition
        const loginModalElement = document.getElementById('loginModal');
        if (loginModalElement && typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getInstance(loginModalElement);

            if (modalInstance) {
                // Add one-time listener for modal hide completion
                loginModalElement.addEventListener('hidden.bs.modal', () => {
                    // Clean up modal backdrop and body styles after transition completes
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                    document.body.classList.remove('modal-open');
                    document.body.style.removeProperty('overflow');
                    document.body.style.removeProperty('padding-right');
                }, { once: true });

                modalInstance.hide();
            }
        }

        // Update UI
        updateAuthUI();
        initPermissionUI();

        // Reset expiry warning flag for new session
        expiryWarningShown = false;

        // Start auto-refresh for new session
        Auth.startAutoRefresh();

        // Show success message
        if (typeof toastr !== 'undefined') {
            toastr.success(<?php echo json_encode(_('Login successful')); ?>, <?php echo json_encode(_('Success')); ?>);
        } else {
            console.log('Login successful');
        }

        // Call success callback if provided
        if (loginSuccessCallback) {
            loginSuccessCallback();
            loginSuccessCallback = null;
        }
    } catch (error) {
        errorDiv.textContent = error.message || <?php echo json_encode(_('Login failed. Please check your credentials.')); ?>;
        errorDiv.classList.remove('d-none');
    } finally {
        // Reset button state
        loginSubmit.disabled = false;
        loginSubmit.textContent = <?php echo json_encode(_('Login')); ?>;
    }
}

/**
 * Update authentication UI based on auth state
 */
function updateAuthUI() {
    const isAuth = Auth.isAuthenticated();
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');

    if (isAuth) {
        if (loginBtn) {
            loginBtn.classList.add('d-none');
        }
        if (userMenu) {
            userMenu.classList.remove('d-none');
        }

        // Display username
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            const username = Auth.getUsername();
            usernameElement.textContent = username || 'Admin';
        }
    } else {
        if (loginBtn) {
            loginBtn.classList.remove('d-none');
        }
        if (userMenu) {
            userMenu.classList.add('d-none');
        }
    }
}

/**
 * Initialize permission-based UI elements
 * Hides/shows elements marked with data-requires-auth attribute
 */
function initPermissionUI() {
    const protectedElements = document.querySelectorAll('[data-requires-auth]');
    const isAuth = Auth.isAuthenticated();

    protectedElements.forEach(el => {
        if (isAuth) {
            el.classList.remove('d-none');
            el.disabled = false;
        } else {
            el.classList.add('d-none');
            el.disabled = true;
        }
    });
}
</script>
