# Frontend Authentication Roadmap

## Overview

This document outlines the plan for implementing JWT authentication in the Liturgical Calendar Frontend to support authenticated write operations (DELETE, PATCH, POST) to the API.

**Related Issues:**

- [LiturgicalCalendarAPI#262](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/issues/262) - ✅ API JWT Implementation (Complete)
- [LiturgicalCalendarFrontend#181](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/issues/181) - 🔄 Frontend JWT Client Implementation (In Progress)

**Status:** Phase 1, Phase 2, Phase 2.4, Phase 2.5, and Phase 3.2 (Session Expiry Warning) complete - as of 2025-12-06

**API Readiness:**
The LiturgicalCalendarAPI now has full JWT authentication implemented with HttpOnly cookie support:

- ✅ `/auth/login` endpoint for obtaining tokens (sets HttpOnly cookies)
- ✅ `/auth/refresh` endpoint for refreshing access tokens (reads/sets cookies)
- ✅ `/auth/logout` endpoint for clearing tokens (clears HttpOnly cookies)
- ✅ `/auth/me` endpoint for checking authentication state (essential for cookie-based auth)
- ✅ PUT/PATCH/DELETE operations on `/data` endpoint require JWT authentication
- ✅ Returns 401 Unauthorized for unauthenticated write requests
- ✅ CORS credentials support (`Access-Control-Allow-Credentials: true`)
- ✅ Supports both HttpOnly cookies (preferred) and Authorization header (backwards compatible)

The frontend can now proceed with implementing JWT client support as outlined in this roadmap.

## Current State

### Protected Operations

The frontend currently performs the following write operations that will require authentication once the API implements JWT protection:

1. **Calendar Deletion** (`assets/js/extending.js:1740`)
   - `DELETE` requests to remove wider region, national, or diocesan calendar definitions
   - Function: `deleteCalendarConfirmClicked()`

2. **Calendar Creation** (`assets/js/extending.js:2090`)
   - `POST` requests to create new calendar definitions
   - Function: `formSubmit()` with `formAction === 'CREATE_CALENDAR'`

3. **Calendar Updates** (`assets/js/extending.js:2929`)
   - `PATCH`/`PUT` requests to modify existing calendar definitions
   - Function: `formSubmit()` with `formAction === 'UPDATE_CALENDAR'`

### Current Request Pattern

```javascript
const headers = new Headers({
    'Accept': 'application/json',
    'Accept-Language': API.locale
});

const request = new Request(API.path, {
    method: 'DELETE', // or 'POST', 'PATCH'
    headers: headers,
    body: formData
});
```

## Implementation Plan

### Phase 1: Basic JWT Authentication ✅ COMPLETE

**Implementation Date:** 2025-11-23

**Files Created:**

- `assets/js/auth.js` - JWT token management module
- `includes/login-modal.php` - Bootstrap 5 login modal

**Files Modified:**

- `assets/js/extending.js` - Added auth helpers and protected all write operations
- `layout/header.php` - Added auth status UI (login/logout buttons)
- `layout/footer.php` - Added API URL constants (BaseUrl, etc.)
- `extending.php` - Included auth module and login modal

**Status:** All Phase 1 requirements implemented and ready for testing.

---

#### 1.1 Login UI

**New Files:**

- `assets/js/auth.js` - Authentication helper functions
- `templates/partials/login-modal.php` - Login modal component

**Features:**

- Bootstrap 5 modal dialog for login
- Username/password form (for initial implementation)
- Remember me option (stores token for longer period)
- Clear error messaging for failed authentication

**Example Login Modal:**

```html
<!-- templates/partials/login-modal.php -->
<div class="modal fade" id="loginModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Administrator Login</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form id="loginForm">
          <div class="mb-3">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label">Password</label>
            <input type="password" class="form-control" id="password" required>
          </div>
          <div class="mb-3 form-check">
            <input type="checkbox" class="form-check-input" id="rememberMe">
            <label class="form-check-label" for="rememberMe">Remember me</label>
          </div>
          <div class="alert alert-danger d-none" id="loginError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" id="loginSubmit">Login</button>
      </div>
    </div>
  </div>
</div>
```

#### 1.2 Token Management (`assets/js/auth.js`)

```javascript
/**
 * Authentication helper module
 */
const Auth = {
    /**
     * Storage keys
     */
    TOKEN_KEY: 'litcal_jwt_token',
    REFRESH_KEY: 'litcal_refresh_token',

    /**
     * Login with username and password
     */
    async login(username, password, rememberMe = false) {
        try {
            const response = await fetch(`${API.protocol}://${API.host}:${API.port}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            this.setToken(data.token, rememberMe);

            if (data.refresh_token) {
                this.setRefreshToken(data.refresh_token, rememberMe);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    /**
     * Store JWT token
     */
    setToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.TOKEN_KEY, token);
    },

    /**
     * Get stored JWT token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) ||
               sessionStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * Store refresh token
     */
    setRefreshToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.REFRESH_KEY, token);
    },

    /**
     * Get refresh token
     */
    getRefreshToken() {
        return localStorage.getItem(this.REFRESH_KEY) ||
               sessionStorage.getItem(this.REFRESH_KEY);
    },

    /**
     * Remove all tokens (logout)
     */
    clearTokens() {
        localStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        sessionStorage.removeItem(this.REFRESH_KEY);
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        // Check if token is expired (decode JWT without verification)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            return payload.exp > now;
        } catch (e) {
            return false;
        }
    },

    /**
     * Refresh access token using refresh token
     */
    async refreshToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(`${API.protocol}://${API.host}:${API.port}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            this.setToken(data.token);
            return data.token;
        } catch (error) {
            this.clearTokens();
            throw error;
        }
    },

    /**
     * Logout
     */
    async logout() {
        const token = this.getToken();

        if (token) {
            try {
                await fetch(`${API.protocol}://${API.host}:${API.port}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        this.clearTokens();
        window.location.reload(); // Refresh to reset UI state
    }
};
```

#### 1.3 Update Request Functions

**Modify `assets/js/extending.js`:**

```javascript
/**
 * Add Authorization header to protected requests
 */
function addAuthHeader(headers) {
    const token = Auth.getToken();
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    return headers;
}

/**
 * Handle authentication errors
 */
async function handleAuthError(response, retryCallback) {
    if (response.status === 401) {
        // Token expired, try to refresh
        try {
            await Auth.refreshToken();
            // Retry the original request
            return retryCallback();
        } catch (error) {
            // Refresh failed, prompt for login
            showLoginModal();
            throw new Error('Authentication required');
        }
    } else if (response.status === 403) {
        throw new Error('You do not have permission to perform this action');
    }
    return response;
}

/**
 * Delete calendar with authentication
 * Updated version of deleteCalendarConfirmClicked()
 */
function deleteCalendarConfirmClicked() {
    // Check authentication first
    if (!Auth.isAuthenticated()) {
        showLoginModal(() => deleteCalendarConfirmClicked());
        return;
    }

    const headers = new Headers({
        'Accept': 'application/json',
        'Accept-Language': API.locale
    });

    // Add JWT token
    addAuthHeader(headers);

    const formData = new FormData();
    formData.append('category', deleteCalendarModal.dataset.category);
    formData.append('calendar', deleteCalendarModal.dataset.calendar);

    const request = new Request(API.path, {
        method: 'DELETE',
        headers: headers,
        body: formData
    });

    fetch(request)
        .then(response => handleAuthError(response, () => deleteCalendarConfirmClicked()))
        .then(response => response.json())
        .then(data => {
            // Handle success
            if (data.status === 'success') {
                showSuccessMessage('Calendar deleted successfully');
                // Refresh calendar list
            }
        })
        .catch(error => {
            showErrorMessage(error.message);
        });
}

/**
 * Form submit with authentication
 * Updated version of formSubmit()
 */
function formSubmit(ev) {
    ev.preventDefault();

    // Check authentication for write operations
    const formAction = ev.target.dataset.formAction;
    if (['CREATE_CALENDAR', 'UPDATE_CALENDAR'].includes(formAction)) {
        if (!Auth.isAuthenticated()) {
            showLoginModal(() => formSubmit(ev));
            return;
        }
    }

    const formData = new FormData(ev.target);
    const headers = new Headers({
        'Accept': 'application/json',
        'Accept-Language': API.locale
    });

    // Add JWT token for write operations
    if (['CREATE_CALENDAR', 'UPDATE_CALENDAR'].includes(formAction)) {
        addAuthHeader(headers);
    }

    const method = formAction === 'CREATE_CALENDAR' ? 'POST' : 'PATCH';

    const request = new Request(API.path, {
        method: method,
        headers: headers,
        body: formData
    });

    fetch(request)
        .then(response => handleAuthError(response, () => formSubmit(ev)))
        .then(response => response.json())
        .then(data => {
            // Handle success
        })
        .catch(error => {
            showErrorMessage(error.message);
        });
}

/**
 * Show login modal
 */
function showLoginModal(onSuccess = null) {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));

    document.getElementById('loginSubmit').onclick = async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        try {
            await Auth.login(username, password, rememberMe);
            loginModal.hide();

            // Call success callback if provided
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            document.getElementById('loginError').textContent = error.message;
            document.getElementById('loginError').classList.remove('d-none');
        }
    };

    loginModal.show();
}
```

#### 1.4 UI Indicators

**Add authentication status indicator to navigation:**

```html
<!-- templates/partials/navbar.php -->
<nav class="navbar navbar-expand-lg navbar-light bg-light">
  <!-- ... existing nav items ... -->

  <div class="navbar-nav ms-auto">
    <div id="authStatus">
      <!-- Logged out state -->
      <button type="button" class="btn btn-sm btn-outline-primary d-none" id="loginBtn">
        Login
      </button>

      <!-- Logged in state -->
      <div class="dropdown d-none" id="userMenu">
        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
          <i class="bi bi-person-circle"></i> <span id="username"></span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><button class="dropdown-item" id="logoutBtn">Logout</button></li>
        </ul>
      </div>
    </div>
  </div>
</nav>

<script>
// Update auth UI on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();

    document.getElementById('loginBtn').onclick = () => showLoginModal();
    document.getElementById('logoutBtn').onclick = () => Auth.logout();
});

function updateAuthUI() {
    const isAuth = Auth.isAuthenticated();
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');

    if (isAuth) {
        loginBtn.classList.add('d-none');
        userMenu.classList.remove('d-none');

        // Decode token to get username (if stored in JWT)
        const token = Auth.getToken();
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('username').textContent = payload.sub || 'Admin';
    } else {
        loginBtn.classList.remove('d-none');
        userMenu.classList.add('d-none');
    }
}
</script>
```

### Phase 2: Enhanced Security ✅ COMPLETE

**Implementation Date:** 2025-11-23

**Status:** All Phase 2 requirements complete (Auto-refresh 2.1, SameSite CSRF Protection 2.2, CSP 2.3)

**Files Modified:**

- `assets/js/auth.js` - Added auto-refresh and expiry warning methods
- `includes/common.php` - Added dynamic CSP headers, HSTS, and SameSite cookie protection
- `README.md` - Added Production Deployment section with nginx and cookie security configuration

---

#### 2.1 Token Auto-Refresh ✅ COMPLETE

**Implementation Date:** 2025-11-23

**Files Modified:**

- `assets/js/auth.js:194-215` - `startAutoRefresh()` method
- `assets/js/auth.js:223-241` - `startExpiryWarning()` bonus feature
- `assets/js/auth.js:303-305` - Auto-start on page load

Silent token refresh before expiry implemented:

```javascript
/**
 * Auto-refresh tokens before expiry
 */
Auth.startAutoRefresh = function() {
    const checkInterval = 60000; // Check every minute

    setInterval(async () => {
        if (!this.isAuthenticated()) return;

        const token = this.getToken();
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = payload.exp - now;

        // Refresh if less than 5 minutes until expiry
        if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
            try {
                await this.refreshToken();
                console.log('Token refreshed automatically');
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }
    }, checkInterval);
};

// Start auto-refresh on page load
document.addEventListener('DOMContentLoaded', () => {
    Auth.startAutoRefresh();
});
```

#### 2.2 CSRF Protection ✅ COMPLETE

**Implementation Date:** 2025-11-23

**Files Modified:**

- `includes/common.php:91-139` - SameSite cookie configuration and helper function
- `README.md` - Cookie Security documentation

**SameSite Cookie Protection implemented** (instead of traditional CSRF tokens):

**Rationale:**

- Application now uses HttpOnly cookies for JWT tokens (as of Phase 2.5)
- SameSite attribute provides built-in CSRF protection for cookie-based auth
- Traditional CSRF tokens are unnecessary with SameSite cookies
- Lightweight solution without server-side token generation complexity

**Implementation:**

```php
// includes/common.php - Automatic session cookie protection
$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';

// Configure PHP session cookies with SameSite protection
ini_set('session.cookie_httponly', '1');  // Prevent JavaScript access
ini_set('session.cookie_samesite', 'Strict');  // CSRF protection
if ($isHttps) {
    ini_set('session.cookie_secure', '1');  // HTTPS only
}

/**
 * Helper function for secure cookies with SameSite protection
 */
function setSecureCookie(
    string $name,
    string $value,
    int $expire = 0,
    string $path = '/',
    string $domain = '',
    string $sameSite = 'Strict'
): bool {
    global $isHttps;

    $options = [
        'expires' => $expire,
        'path' => $path,
        'domain' => $domain,
        'secure' => $isHttps,      // HTTPS only
        'httponly' => true,        // No JavaScript access
        'samesite' => $sameSite    // CSRF protection
    ];

    return setcookie($name, $value, $options);
}
```

**SameSite Options:**

- `Strict` - Cookie only sent for same-site requests (default, maximum protection)
- `Lax` - Cookie sent for top-level navigation (balance between security and usability)
- `None` - Cookie sent for all requests (requires HTTPS, use only when needed)

**Benefits:**

- ✅ Automatic CSRF protection for all cookies
- ✅ No server-side token storage or generation
- ✅ No frontend token validation code needed
- ✅ Essential for HttpOnly cookie-based JWT authentication (Phase 2.5)

#### 2.3 Content Security Policy ✅ COMPLETE

**Implementation Date:** 2025-11-23

**Hybrid Approach Implemented:**

- **PHP** (`common.php:57-81`) - Dynamic CSP with API URL from `.env`
- **nginx** (documented in README.md) - Static security headers for performance

**CSP Headers Implemented:**

```php
// includes/common.php - Dynamic CSP header
header("Content-Security-Policy: " .
    "default-src 'self'; " .
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; " .
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; " .
    "font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; " .
    "img-src 'self' data: https:; " .
    "connect-src 'self' {$apiCspUrl} https://api.github.com; " .
    "frame-ancestors 'none'; " .
    "base-uri 'self'; " .
    "form-action 'self';"
);

// HSTS header (PHP sets this for HTTPS detection)
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
}
```

**nginx Configuration (recommended for production):**

```nginx
# Static headers in nginx for better performance
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

See `README.md` Production Deployment section for full nginx configuration details.

#### 2.4 HttpOnly Cookie Authentication ✅ COMPLETE

**Implementation Date:** 2025-11-27

**Overview:**
Implemented HttpOnly cookie-based JWT storage as a more secure alternative to localStorage/sessionStorage.
This protects tokens from XSS attacks since JavaScript cannot access HttpOnly cookies.

**API Changes (LiturgicalCalendarAPI):**

**New Files:**

- `src/Http/CookieHelper.php` - Helper class for secure cookie management
- `src/Handlers/Auth/MeHandler.php` - New `/auth/me` endpoint

**Modified Files:**

- `src/Handlers/Auth/LoginHandler.php` - Sets HttpOnly cookies after login
- `src/Handlers/Auth/RefreshHandler.php` - Reads refresh token from cookie, sets new access token cookie
- `src/Handlers/Auth/LogoutHandler.php` - Clears HttpOnly cookies on logout
- `src/Http/Middleware/JwtAuthMiddleware.php` - Reads token from cookie first, falls back to header
- `src/Handlers/AbstractHandler.php` - Added CORS credentials support
- `src/Router.php` - Added `/auth/me` route
- `jsondata/schemas/openapi.json` - Documented `/auth/me` endpoint

**Frontend Changes (LiturgicalCalendarFrontend):**

- `assets/js/auth.js` - Added `credentials: 'include'` to all fetch calls, added `checkAuthAsync()` method

**Cookie Configuration:**

```php
// CookieHelper.php - Secure cookie attributes
$cookie = [
    'name' => 'litcal_access_token',  // or 'litcal_refresh_token'
    'value' => $token,
    'path' => '/',                     // '/' for access, '/auth' for refresh
    'httponly' => true,                // Not accessible to JavaScript
    'secure' => $isHttps,              // HTTPS only in production
    'samesite' => 'Lax',               // CSRF protection ('Strict' for refresh token)
    'max-age' => $expiry               // Token expiry in seconds
];
```

**New `/auth/me` Endpoint:**

Essential for cookie-based authentication since JavaScript cannot read HttpOnly cookies to determine auth state:

```javascript
// Frontend usage
const authState = await Auth.checkAuthAsync();
if (authState && authState.authenticated) {
    console.log(`Logged in as: ${authState.username}`);
    console.log(`Roles: ${authState.roles.join(', ')}`);
    console.log(`Token expires: ${new Date(authState.exp * 1000)}`);
}
```

**API Response:**

```json
{
    "authenticated": true,
    "username": "admin",
    "roles": ["admin"],
    "exp": 1735689600
}
```

**CORS Credentials Support:**

For cross-origin requests with cookies, the API now sends:

```http
Access-Control-Allow-Origin: https://example.com  (specific origin, not *)
Access-Control-Allow-Credentials: true
```

**Frontend Fetch Configuration:**

```javascript
// All auth-related fetch calls now include credentials
const response = await fetch(`${BaseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',  // Include cookies in cross-origin requests
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({ username, password })
});
```

**API Backwards Compatibility:**

The API maintains backwards compatibility for third-party clients:

1. **API reads tokens from both sources** - Checks HttpOnly cookie first, falls back to Authorization header
2. **API returns tokens in response body** - Third-party clients can still use their own storage

**Note:** As of Phase 2.5, the frontend no longer stores tokens in localStorage/sessionStorage.
See Phase 2.5 below for the current cookie-only implementation.

### Phase 2.5: Full Cookie-Only Authentication ✅ COMPLETE

**Implementation Date:** 2025-12-02

**Overview:**
Migrated the frontend to use HttpOnly cookies exclusively, removing client-side token storage in
localStorage/sessionStorage. This provides maximum security against XSS attacks.

**Files Modified:**

1. **`assets/js/auth.js`**
   - Added auth state caching (`_cachedAuthState`, `_cacheExpiry`, `_cacheDuration`)
   - Added `isAuthenticatedCached()` method for synchronous cache checks
   - Added `updateAuthCache()` method to fetch and cache auth state
   - Updated `isAuthenticated()` to use cached auth state instead of localStorage
   - Updated `login()` to not store tokens locally (relies on HttpOnly cookies)
   - Updated `_doRefreshToken()` to not require body (API reads from cookie)
   - Updated `startAutoRefresh()` and `startExpiryWarning()` to use cached auth state
   - Updated `hasPermission()`, `hasRole()`, `getUsername()` to use cached auth state
   - Deprecated `setToken()`, `getToken()`, `setRefreshToken()`, `getRefreshToken()`, `getPayload()`
   - Updated DOMContentLoaded to initialize auth cache on page load

2. **`assets/js/extending.js`**
   - Deprecated `addAuthHeader()` function (no longer needed)
   - Updated `makeAuthenticatedRequest()` to use `credentials: 'include'` instead of Authorization header

3. **`includes/login-modal.php`**
   - Updated DOMContentLoaded to be async and wait for auth cache population
   - Uses `Auth.isAuthenticatedCached()` to check if cache needs population

**How It Works:**

1. **Page Load:**
   - `auth.js` DOMContentLoaded calls `Auth.updateAuthCache()` to fetch `/auth/me`
   - Cache is populated with auth state (authenticated, username, roles, exp)
   - Auto-refresh timer is started if authenticated

2. **Auth State Checks:**
   - `Auth.isAuthenticated()` returns cached state synchronously
   - `Auth.isAuthenticatedCached()` returns `null` if cache expired (caller can decide to fetch)
   - `Auth.updateAuthCache()` fetches fresh state from server

3. **Authenticated Requests:**
   - All requests use `credentials: 'include'` to send HttpOnly cookies
   - No Authorization headers needed - API reads token from cookie
   - `makeAuthenticatedRequest()` helper handles this automatically

4. **Token Refresh:**
   - API reads refresh token from HttpOnly cookie
   - New tokens are set as HttpOnly cookies in response
   - Frontend just calls the endpoint and updates the cache

**Security Benefits:**

- ✅ **XSS-proof** - No tokens in JavaScript-accessible storage
- ✅ **Simpler code** - No manual Authorization header management
- ✅ **Automatic transmission** - Browser handles cookie sending
- ✅ **Legacy cleanup** - Old tokens in localStorage/sessionStorage are cleared on login

**Migration Notes:**

- Deprecated methods still exist but log warnings when called
- Legacy tokens in localStorage/sessionStorage are cleared on successful login
- Backwards compatible - API still accepts Authorization header as fallback

### Phase 3: User Experience Enhancements

#### 3.1 Permission-Based UI ✅ COMPLETE

**Implementation Date:** 2025-11-23 (as part of Phase 1)

Hide/show UI elements based on authentication:

```javascript
/**
 * Initialize permission-based UI
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

// Usage in HTML:
// <button data-requires-auth class="d-none">Delete Calendar</button>
```

#### 3.2 Session Expiry Warning ✅ COMPLETE

**Implementation Date:** 2025-12-06

**Related Issue:** [#208](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/issues/208)

**Files Modified:**

- `includes/login-modal.php` - Added Bootstrap Toast with action buttons, session expiry warning handlers

**Features Implemented:**

- ✅ Bootstrap Toast warning appears when session has < 2 minutes remaining
- ✅ "Extend Session" button triggers token refresh
- ✅ "Logout" button allows immediate logout from warning
- ✅ Warning auto-dismisses after successful token refresh
- ✅ Countdown updates while toast is visible
- ✅ Warning only shows once per expiry cycle (resets after extension)
- ✅ Success/error toastr notifications for user feedback
- ✅ Proper localization with singular/plural forms

**How It Works:**

1. `Auth.startExpiryWarning()` is called on page load with a callback
2. The callback checks `Auth._cachedAuthState.exp` every 30 seconds
3. When < 2 minutes remain, the Bootstrap Toast is shown with action buttons
4. User can click "Extend Session" to refresh the token, or "Logout" to end session
5. After successful refresh, the toast is hidden and `expiryWarningShown` is reset

**UI Component:**

```html
<!-- Session Expiry Warning Toast -->
<div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="sessionExpiryToast" class="toast" data-bs-autohide="false">
        <div class="toast-header bg-warning text-dark">
            <strong>Session Expiring</strong>
        </div>
        <div class="toast-body">
            <p id="sessionExpiryMessage">Your session will expire in less than 2 minutes.</p>
            <div class="d-flex justify-content-end gap-2">
                <button id="sessionExpiryLogout">Logout</button>
                <button id="sessionExpiryExtend">Extend Session</button>
            </div>
        </div>
    </div>
</div>
```

**Note:** With HttpOnly cookies, JavaScript cannot decode the token directly. The expiry time is
obtained from the `/auth/me` endpoint response, which is cached in `_cachedAuthState`.

### Phase 4: Future Enhancements (Post-JWT)

> **Note:** These are conceptual examples for future API features. All examples use the cookie-only
> authentication model with cached auth state from `/auth/me`. The API would need to include
> permissions/roles in the `/auth/me` response for these features to work.

#### 4.1 Role-Based Access Control (RBAC)

When the API implements RBAC (permissions/roles returned in `/auth/me` response):

```javascript
/**
 * Check user permissions (uses cached auth state)
 */
Auth.hasPermission = function(permission) {
    if (!this.isAuthenticated()) return false;

    const permissions = this._cachedAuthState?.permissions;
    return permissions && permissions.includes(permission);
};

/**
 * Check user role (uses cached auth state)
 */
Auth.hasRole = function(role) {
    if (!this.isAuthenticated()) return false;

    const { role: userRole, roles } = this._cachedAuthState || {};
    return userRole === role || (roles && roles.includes(role));
};

// Usage:
if (Auth.hasPermission('calendar:delete')) {
    // Show delete button
}
```

#### 4.2 Multi-Factor Authentication (MFA)

When the API adds MFA (tokens set via HttpOnly cookies by the API):

```javascript
/**
 * Handle MFA challenge
 * API sets HttpOnly cookies on successful verification
 */
async function handleMfaChallenge(challengeToken) {
    const code = await showMfaModal(); // Prompt user for MFA code

    const response = await fetch(`${BaseUrl}/auth/mfa/verify`, {
        method: 'POST',
        credentials: 'include', // Cookie-based auth
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            challenge_token: challengeToken,
            code: code
        })
    });

    if (!response.ok) {
        throw new Error('MFA verification failed');
    }

    // API sets HttpOnly cookies - update local cache
    await Auth.updateAuthCache();
    return await response.json();
}
```

#### 4.3 OAuth/OIDC Integration

When integrating external identity providers (API sets HttpOnly cookies):

```javascript
/**
 * OAuth login flow
 */
Auth.loginWithOAuth = function(provider) {
    const authUrl = `${BaseUrl}/auth/oauth/${provider}`;
    const redirectUri = window.location.origin + '/auth/callback';

    // Store return URL before redirect
    sessionStorage.setItem('oauth_return_to', window.location.pathname);
    window.location.href = `${authUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;
};

/**
 * Handle OAuth callback
 * API sets HttpOnly cookies on successful authentication
 */
Auth.handleOAuthCallback = async function() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
        throw new Error('No authorization code received');
    }

    const response = await fetch(`${BaseUrl}/auth/oauth/callback`, {
        method: 'POST',
        credentials: 'include', // Cookie-based auth
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ code, state })
    });

    if (!response.ok) {
        throw new Error('OAuth authentication failed');
    }

    // API sets HttpOnly cookies - update local cache
    await this.updateAuthCache();

    // Redirect to original page
    const returnTo = sessionStorage.getItem('oauth_return_to') || '/';
    sessionStorage.removeItem('oauth_return_to');
    window.location.href = returnTo;
};
```

## Security Considerations

### 1. Token Storage

**Current Approach:** Cookie-only (HttpOnly secure cookies)

**As of 2025-12-02**, the frontend uses HttpOnly cookies exclusively for token storage:

| Storage Method  | XSS Safe | CSRF Safe | Cross-Tab | Status                        |
| --------------- | -------- | --------- | --------- | ----------------------------- |
| HttpOnly Cookie | Yes      | SameSite  | Yes       | Current - sole token storage  |
| sessionStorage  | No       | Yes       | No        | Legacy - cleared on login     |
| localStorage    | No       | Yes       | Yes       | Legacy - cleared on login     |

**How it works:**

1. **Login** - API sets HttpOnly cookies; frontend clears any legacy localStorage/sessionStorage tokens
2. **Auth State** - Frontend calls `/auth/me` endpoint and caches the response
3. **API Requests** - Browser automatically sends HttpOnly cookies via `credentials: 'include'`
4. **API Validation** - Reads token from HttpOnly cookie (falls back to Authorization header for backwards compatibility)

**Cookie Configuration:**

| Cookie                 | Path    | SameSite | Secure     | HttpOnly |
| ---------------------- | ------- | -------- | ---------- | -------- |
| `litcal_access_token`  | `/`     | Lax      | Yes (prod) | Yes      |
| `litcal_refresh_token` | `/auth` | Strict   | Yes (prod) | Yes      |

**Security Benefits:**

- ✅ **XSS-proof** - Tokens cannot be accessed by JavaScript
- ✅ **CSRF protection** - SameSite attribute prevents cross-site request forgery
- ✅ **Secure transmission** - Cookies only sent over HTTPS in production
- ✅ **Path restriction** - Refresh token only sent to `/auth` endpoints

**Historical Note - Hybrid Approach (Phase 2.4, deprecated):**

Prior to Phase 2.5, the frontend used a hybrid approach where the API set HttpOnly cookies AND
returned tokens in the response body. The frontend stored tokens in localStorage/sessionStorage
for client-side convenience, and requests included both cookies (automatic) and Authorization
headers (manual). This was replaced with cookie-only authentication in Phase 2.5 for maximum
XSS protection.

### 2. HTTPS Enforcement

**Critical:** Authentication MUST use HTTPS in production

```javascript
// Add check in auth.js
if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('Authentication over HTTP is insecure. Use HTTPS in production.');
}
```

### 3. Token Validation

**Never trust client-side token validation alone**

- Frontend token expiry check is for UX only
- Server MUST validate all tokens
- Frontend should gracefully handle 401 responses even if token appears valid

### 4. Sensitive Data Exposure

**Do NOT store sensitive data in JWT payload**

- Use opaque identifiers (user ID, not full user object)
- Avoid storing permissions/roles if they change frequently
- Keep payload minimal to reduce token size

## Testing Plan

### Manual Testing Checklist

**Authentication Flow:**

- [ ] Login flow with valid credentials sets HttpOnly cookies
- [ ] Login flow with invalid credentials shows error, no cookies set
- [ ] Login clears any legacy tokens from localStorage/sessionStorage
- [ ] Logout clears HttpOnly cookies (verify via DevTools → Application → Cookies)
- [ ] UI updates correctly based on auth state (login/logout buttons)

**Cookie Behavior:**

- [ ] Access token cookie has correct attributes (HttpOnly, SameSite=Lax, Secure in prod)
- [ ] Refresh token cookie has correct attributes (HttpOnly, SameSite=Strict, Path=/auth)
- [ ] Cookies are automatically sent with `credentials: 'include'` requests
- [ ] Cross-origin requests include cookies when CORS is configured

**Server-Side Session Validation:**

- [ ] `/auth/me` returns authenticated state when valid cookie present
- [ ] `/auth/me` returns `{ authenticated: false }` when no cookie or expired
- [ ] Authenticated DELETE request succeeds (cookie sent automatically)
- [ ] Authenticated POST request succeeds
- [ ] Authenticated PATCH request succeeds
- [ ] Unauthenticated write request fails with 401

**Token Lifecycle:**

- [ ] Token refresh works via HttpOnly cookie (no body needed)
- [ ] Auto-refresh triggers before token expiry
- [ ] Expiry warning shown when token near expiration
- [ ] Session persists across page reloads (cookie retained)

**Security:**

- [ ] HTTPS enforcement warning shown on HTTP (non-localhost)
- [ ] No tokens visible in JavaScript (localStorage/sessionStorage empty)
- [ ] DevTools Network tab shows no Authorization headers (cookies only)

### Automated Testing (E2E with Playwright)

```javascript
// Example Playwright test for cookie-based auth
test('login sets HttpOnly cookies', async ({ page, context }) => {
    await page.goto('/extending.php');

    // Perform login
    await page.click('#loginBtn');
    await page.fill('#loginUsername', 'testuser');
    await page.fill('#loginPassword', 'testpassword');
    await page.click('#loginSubmit');

    // Verify cookies are set (HttpOnly cookies visible in context)
    const cookies = await context.cookies();
    const accessCookie = cookies.find(c => c.name === 'litcal_access_token');
    const refreshCookie = cookies.find(c => c.name === 'litcal_refresh_token');

    expect(accessCookie).toBeDefined();
    expect(accessCookie.httpOnly).toBe(true);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie.httpOnly).toBe(true);

    // Verify no tokens in localStorage/sessionStorage
    const localStorageToken = await page.evaluate(() =>
        localStorage.getItem('litcal_jwt_token')
    );
    expect(localStorageToken).toBeNull();
});

test('authenticated request uses cookies automatically', async ({ page }) => {
    // Login first (sets cookies)
    await loginAsTestUser(page);

    // Intercept API request to verify no Authorization header
    let authHeaderUsed = false;
    await page.route('**/data/**', async (route, request) => {
        if (request.headers()['authorization']) {
            authHeaderUsed = true;
        }
        await route.continue();
    });

    // Perform authenticated action
    await performCalendarUpdate(page);

    // Verify Authorization header was NOT used (cookies only)
    expect(authHeaderUsed).toBe(false);
});
```

## Migration Path

### From No Auth → JWT

1. **API deployed first** - Returns 401 for write operations without token
2. **Frontend gracefully degrades** - Shows login modal when 401 encountered
3. **No breaking changes** - Read operations (GET) remain public
4. **Progressive rollout** - Can deploy to staging/production independently

### From JWT → Supabase/WorkOS (if needed)

1. **Gradual migration** - Both systems can coexist temporarily
2. **Backend changes minimal** - Just swap validation middleware
3. **Frontend updates** - Replace Auth module with Supabase SDK
4. **User migration** - Export users or implement account linking

## Deployment Checklist

### Pre-Production

- [ ] Test all authentication flows in staging environment
- [ ] Verify HTTPS configuration
- [ ] Test token expiry and refresh mechanisms
- [ ] Review CSP headers
- [ ] Audit error messages (avoid leaking sensitive info)
- [ ] Test across different browsers
- [ ] Verify mobile responsiveness of login modal

### Production

- [ ] Ensure API is deployed with JWT endpoints
- [ ] Update frontend environment variables for API URL
- [ ] Clear browser caches to avoid old JavaScript
- [ ] Monitor error logs for authentication failures
- [ ] Have rollback plan ready
- [ ] Document new authentication requirements for users

## Open Questions

1. **User Management**
   - Who creates the first admin user? (API seed script?)
   - How do we handle password resets without email infrastructure?
   - Should we implement account lockout after failed login attempts?

2. **Token Lifetime**
   - What should be the default access token TTL? (15 minutes? 1 hour?)
   - What should be the refresh token TTL? (7 days? 30 days?)
   - Should "Remember me" extend both or just refresh token?

3. **Permissions**
   - Is simple authentication enough, or do we need role-based permissions from the start?
   - Who should have access to which calendars (all vs. specific nations/dioceses)?

4. **Backward Compatibility**
   - Should we version the API (/v1/ vs /v2/) when adding auth?
   - How long to support unauthenticated writes (if at all)?

## Related Documentation

- [API Authentication Roadmap](../../LiturgicalCalendarAPI/docs/enhancements/AUTHENTICATION_ROADMAP.md)
- [API Issue #262: JWT Implementation](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/issues/262)
- [Frontend Issue #181: JWT Client Implementation](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/issues/181)

## Timeline

| Phase     | Description                                | Estimated Effort | Status      |
| --------- | ------------------------------------------ | ---------------- | ----------- |
| Phase 1   | Basic JWT authentication                   | 2-3 weeks        | COMPLETE    |
| Phase 2   | Enhanced security (CSRF, auto-refresh)     | 1 week           | COMPLETE    |
| Phase 2.4 | HttpOnly Cookie Authentication             | 1-2 days         | COMPLETE    |
| Phase 2.5 | Full Cookie-Only Authentication            | 1 week           | COMPLETE    |
| Phase 3.1 | Permission-Based UI                        | -                | COMPLETE    |
| Phase 3.2 | Session Expiry Warning                     | 1 day            | COMPLETE    |
| Phase 4   | Future enhancements (RBAC, MFA, OAuth)     | As needed        | Future      |

**Note:** Timeline assumes sequential implementation coordinated with API development.
