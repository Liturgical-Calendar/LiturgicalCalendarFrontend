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
/**
 * Initialize authentication UI components
 */
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();

    // Login button click handler
    document.getElementById('loginBtn').addEventListener('click', () => {
        showLoginModal();
    });

    // Logout button click handler
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('<?php echo _('Are you sure you want to logout?'); ?>')) {
            await Auth.logout();
        }
    });

    // Login form submit handler
    document.getElementById('loginSubmit').addEventListener('click', async () => {
        await handleLogin();
    });

    // Allow Enter key to submit login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    // Toggle password visibility
    document.getElementById('togglePassword').addEventListener('click', () => {
        const passwordInput = document.getElementById('loginPassword');
        const toggleIcon = document.getElementById('togglePasswordIcon');
        const toggleButton = document.getElementById('togglePassword');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
            toggleButton.title = '<?php echo _('Hide password'); ?>';
        } else {
            passwordInput.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
            toggleButton.title = '<?php echo _('Show password'); ?>';
        }
    });

    // Start session expiry warnings
    Auth.startExpiryWarning((message) => {
        toastr.warning(message, '<?php echo _('Session Expiring'); ?>');
    });
});

/**
 * Show login modal
 *
 * @param {Function} onSuccess - Callback to execute after successful login
 */
function showLoginModal(onSuccess = null) {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));

    // Store success callback
    if (onSuccess) {
        document.getElementById('loginModal').dataset.onSuccess = 'pending';
        window._loginSuccessCallback = onSuccess;
    }

    // Clear previous errors and form values
    document.getElementById('loginError').classList.add('d-none');
    document.getElementById('loginForm').reset();

    loginModal.show();
}

/**
 * Handle login form submission
 */
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        errorDiv.textContent = '<?php echo _('Please enter both username and password'); ?>';
        errorDiv.classList.remove('d-none');
        return;
    }

    try {
        // Show loading state
        document.getElementById('loginSubmit').disabled = true;
        document.getElementById('loginSubmit').innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span><?php echo _('Logging in...'); ?>';

        await Auth.login(username, password, rememberMe);

        // Hide modal
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        loginModal.hide();

        // Ensure backdrop is removed (Bootstrap sometimes leaves it)
        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }, 150);

        // Update UI
        updateAuthUI();

        // Show success message
        toastr.success('<?php echo _('Login successful'); ?>', '<?php echo _('Success'); ?>');

        // Call success callback if provided
        if (window._loginSuccessCallback) {
            window._loginSuccessCallback();
            window._loginSuccessCallback = null;
        }
    } catch (error) {
        errorDiv.textContent = error.message || '<?php echo _('Login failed. Please check your credentials.'); ?>';
        errorDiv.classList.remove('d-none');
    } finally {
        // Reset button state
        document.getElementById('loginSubmit').disabled = false;
        document.getElementById('loginSubmit').textContent = '<?php echo _('Login'); ?>';
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
        loginBtn.classList.add('d-none');
        userMenu.classList.remove('d-none');

        // Display username
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            const username = Auth.getUsername();
            usernameElement.textContent = username || 'Admin';
        }
    } else {
        loginBtn.classList.remove('d-none');
        userMenu.classList.add('d-none');
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

// Update permission UI on page load and after login/logout
document.addEventListener('DOMContentLoaded', initPermissionUI);
</script>
