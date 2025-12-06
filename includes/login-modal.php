<!-- Session Expiry Warning Toast -->
<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1090;">
    <div id="sessionExpiryToast" class="toast bg-white text-dark border-warning" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
        <div class="toast-header bg-warning text-dark">
            <i class="fas fa-clock me-2"></i>
            <strong class="me-auto"><?php echo _('Session Expiring'); ?></strong>
        </div>
        <div class="toast-body bg-white text-dark">
            <p id="sessionExpiryMessage" class="mb-3"></p>
            <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="sessionExpiryLogout">
                    <i class="fas fa-sign-out-alt me-1"></i><?php echo _('Logout'); ?>
                </button>
                <button type="button" class="btn btn-sm btn-primary" id="sessionExpiryExtend">
                    <i class="fas fa-refresh me-1"></i><?php echo _('Extend Session'); ?>
                </button>
            </div>
        </div>
    </div>
</div>

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
let sessionExpiryToast = null;
let sessionExpiryTimeout = null;

/**
 * Initialize authentication UI components
 * Uses async initialization to wait for auth cache to be populated
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Guard against missing Auth dependency
    if (typeof Auth === 'undefined') {
        console.error('Auth module not loaded - authentication UI will not function');
        return;
    }

    // Wait for auth cache to be populated (auth.js may have already done this)
    // If cache is empty, fetch auth state from server with retry and user feedback
    if (Auth.isAuthenticatedCached() === null) {
        const maxRetries = 2;
        let authState = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            authState = await Auth.updateAuthCache();

            if (!authState.error) {
                break; // Success - no network error
            }

            if (attempt < maxRetries) {
                // Wait before retry (exponential backoff: 1s, 2s)
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        // Show warning if auth check failed after all retries
        if (authState && authState.error) {
            const message = <?php echo json_encode(_('Unable to verify authentication status. The server may be unavailable.')); ?>;
            if (typeof toastr !== 'undefined') {
                toastr.warning(message, <?php echo json_encode(_('Connection Issue')); ?>);
            } else {
                console.warn(message);
            }
        }
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

    // Initialize session expiry warning toast and its event handlers
    initSessionExpiryWarning();

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
    // Always reset callback to prevent stale callbacks from previous modal opens
    loginSuccessCallback = null;

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

    // Store success callback in module scope if provided
    if (onSuccess !== null) {
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

        // Start auto-refresh and expiry warning for new session
        Auth.startAutoRefresh();
        startSessionExpiryWarning();

        // Show success message
        if (typeof toastr !== 'undefined') {
            toastr.success(<?php echo json_encode(_('Login successful')); ?>, <?php echo json_encode(_('Success')); ?>);
        } else {
            console.log('Login successful');
        }

        // Call success callback if provided (check both module-scoped and global fallback)
        if (loginSuccessCallback) {
            loginSuccessCallback();
            loginSuccessCallback = null;
        } else if (typeof window.postLoginCallback === 'function') {
            // Fallback for callbacks set by extending.js before login-modal.php loaded
            window.postLoginCallback();
            window.postLoginCallback = null;
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

/**
 * Format the session expiry message with proper localization
 *
 * @param {number} seconds - Seconds until session expires
 * @returns {string} Localized message
 */
function formatExpiryMessage(seconds) {
    const minutes = Math.ceil(seconds / 60);
    // Use localized message template with proper singular/plural forms
    const singular = <?php echo json_encode(ngettext(
        'Your session will expire in less than %d minute.',
        'Your session will expire in less than %d minutes.',
        1
    )); ?>;
    const plural = <?php echo json_encode(ngettext(
        'Your session will expire in less than %d minute.',
        'Your session will expire in less than %d minutes.',
        2
    )); ?>;
    return (minutes === 1 ? singular : plural).replace('%d', minutes);
}

/**
 * Show the session expiry warning toast
 *
 * @param {number} timeUntilExpiry - Seconds until session expires
 */
function showSessionExpiryToast(timeUntilExpiry) {
    const toastElement = document.getElementById('sessionExpiryToast');
    const messageElement = document.getElementById('sessionExpiryMessage');

    if (!toastElement || !messageElement) {
        console.warn('Session expiry toast elements not found');
        return;
    }

    // Update the message with current time remaining
    messageElement.textContent = formatExpiryMessage(timeUntilExpiry);

    // Initialize Bootstrap Toast if not already done
    if (!sessionExpiryToast) {
        if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
            console.error('Bootstrap Toast is not available - cannot show session expiry toast');
            return;
        }
        sessionExpiryToast = new bootstrap.Toast(toastElement);
    }

    // Show the toast
    sessionExpiryToast.show();
}

/**
 * Hide the session expiry warning toast
 */
function hideSessionExpiryToast() {
    if (sessionExpiryToast) {
        sessionExpiryToast.hide();
    }
}

/**
 * Handle the "Extend Session" button click
 * Attempts to refresh the token and hides the warning on success
 */
async function handleExtendSession() {
    const extendButton = document.getElementById('sessionExpiryExtend');
    const originalContent = extendButton ? extendButton.innerHTML : '';

    try {
        // Show loading state
        if (extendButton) {
            extendButton.disabled = true;
            extendButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' +
                <?php echo json_encode(_('Extending...')); ?>;
        }

        // Clear the auto-logout timeout
        if (sessionExpiryTimeout) {
            clearTimeout(sessionExpiryTimeout);
            sessionExpiryTimeout = null;
        }

        // Refresh the token
        await Auth.refreshToken();

        // Hide the warning toast
        hideSessionExpiryToast();

        // Restart auto-refresh and expiry warning for the new session
        Auth.startAutoRefresh();
        startSessionExpiryWarning();

        // Show success notification
        if (typeof toastr !== 'undefined') {
            toastr.success(
                <?php echo json_encode(_('Your session has been extended.')); ?>,
                <?php echo json_encode(_('Session Extended')); ?>
            );
        }
    } catch (error) {
        console.error('Failed to extend session:', error);

        // Show error notification
        if (typeof toastr !== 'undefined') {
            toastr.error(
                <?php echo json_encode(_('Failed to extend session. Please login again.')); ?>,
                <?php echo json_encode(_('Error')); ?>
            );
        }

        // Hide the warning and show login modal
        hideSessionExpiryToast();
        showLoginModal();
    } finally {
        // Reset button state
        if (extendButton) {
            extendButton.disabled = false;
            extendButton.innerHTML = originalContent;
        }
    }
}

/**
 * Handle the "Logout" button click from the session expiry warning
 * Toast remains visible if user cancels, allowing them to extend session instead
 */
async function handleSessionExpiryLogout() {
    if (confirm(<?php echo json_encode(_('Are you sure you want to logout?')); ?>)) {
        // Clear the auto-logout timeout
        if (sessionExpiryTimeout) {
            clearTimeout(sessionExpiryTimeout);
            sessionExpiryTimeout = null;
        }
        hideSessionExpiryToast();
        await Auth.logout();
    }
}

/**
 * Handle automatic logout when session expires
 * Called when user ignores the expiry warning
 */
async function handleAutoLogout() {
    // Clear the timeout reference
    sessionExpiryTimeout = null;

    // Hide the warning toast
    hideSessionExpiryToast();

    // Show notification
    if (typeof toastr !== 'undefined') {
        toastr.warning(
            <?php echo json_encode(_('Your session has expired. Please login again.')); ?>,
            <?php echo json_encode(_('Session Expired')); ?>
        );
    }

    // Clear tokens and reload (this will show the logged-out state)
    Auth.clearTokens();
    Auth.stopAllTimers();

    // Update UI to show logged-out state
    updateAuthUI();
    initPermissionUI();
}

/**
 * Expiry warning callback - handles the warning display and timers
 * Extracted to a named function so it can be reused after re-login
 *
 * @param {number} timeUntilExpiry - Seconds until token expires
 */
function expiryWarningCallback(timeUntilExpiry) {
    if (expiryWarningShown) {
        // Update the message if toast is already visible
        const messageElement = document.getElementById('sessionExpiryMessage');
        if (messageElement) {
            messageElement.textContent = formatExpiryMessage(timeUntilExpiry);
        }
        // Update the auto-logout timer to stay in sync with actual expiry time
        if (sessionExpiryTimeout) {
            clearTimeout(sessionExpiryTimeout);
            sessionExpiryTimeout = setTimeout(handleAutoLogout, timeUntilExpiry * 1000);
        }
        return;
    }

    expiryWarningShown = true;

    // Stop auto-refresh - user must explicitly extend session
    Auth.stopAutoRefresh();

    // Set auto-logout timer for when the token actually expires
    if (sessionExpiryTimeout) {
        clearTimeout(sessionExpiryTimeout);
    }
    sessionExpiryTimeout = setTimeout(handleAutoLogout, timeUntilExpiry * 1000);

    // Show the warning toast
    showSessionExpiryToast(timeUntilExpiry);
}

/**
 * Start or restart the session expiry warning timer
 * Can be called after login to restart the warning system
 */
function startSessionExpiryWarning() {
    // Reset the warning flag
    expiryWarningShown = false;

    // Clear any existing auto-logout timeout
    if (sessionExpiryTimeout) {
        clearTimeout(sessionExpiryTimeout);
        sessionExpiryTimeout = null;
    }

    // Stop any existing expiry warning timer before starting a new one
    Auth.stopExpiryWarning();

    // Start the expiry warning timer with our callback
    Auth.startExpiryWarning(expiryWarningCallback);
}

/**
 * Initialize the session expiry warning system
 * Sets up the Bootstrap Toast and its event handlers
 *
 * Flow:
 * 1. Auto-refresh runs normally until warning threshold
 * 2. When warning appears: stop auto-refresh, set auto-logout timer
 * 3. User clicks "Extend": refresh token, restart auto-refresh
 * 4. User does nothing: auto-logout when token expires
 */
function initSessionExpiryWarning() {
    // Set up event handlers for toast buttons (only once)
    const extendButton = document.getElementById('sessionExpiryExtend');
    const logoutButton = document.getElementById('sessionExpiryLogout');

    if (extendButton) {
        extendButton.addEventListener('click', handleExtendSession);
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleSessionExpiryLogout);
    }

    // Start the expiry warning timer
    startSessionExpiryWarning();
}
</script>
