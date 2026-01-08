/**
 * Authentication helper module for JWT token management
 * Handles login, logout, and authentication state management
 *
 * Uses HttpOnly cookie-based authentication exclusively.
 * Cookies are set by the API and cannot be read by JavaScript.
 * Use checkAuthAsync() or isAuthenticatedCached() to verify authentication state.
 *
 * @module Auth
 */
const Auth = {
    /**
     * Storage keys for JWT and refresh tokens
     * @deprecated These are no longer used. Tokens are stored in HttpOnly cookies only.
     */
    TOKEN_KEY: 'litcal_jwt_token',
    REFRESH_KEY: 'litcal_refresh_token',

    /**
     * Cached authentication state from /auth/me endpoint
     * @private
     */
    _cachedAuthState: null,

    /**
     * Cache expiry timestamp (milliseconds since epoch)
     * @private
     */
    _cacheExpiry: 0,

    /**
     * Cache duration in milliseconds (1 minute)
     * @private
     */
    _cacheDuration: 60000,

    /**
     * Interval IDs for auto-refresh and expiry warning timers
     * @private
     */
    _autoRefreshInterval: null,
    _expiryWarningInterval: null,

    /**
     * Promise for in-flight token refresh to prevent race conditions
     * @private
     */
    _refreshPromise: null,

    /**
     * Flag to prevent token writes during logout
     * @private
     */
    _isLoggingOut: false,

    /**
     * Validate that BaseUrl is defined before making API calls
     * @private
     * @param {string} methodName - Name of the calling method for error messages
     * @returns {boolean} True if BaseUrl is valid, false otherwise
     */
    _validateBaseUrl(methodName) {
        if (typeof BaseUrl === 'undefined' || !BaseUrl) {
            console.error(`Auth.${methodName}: BaseUrl is not defined - cannot make API request`);
            return false;
        }
        return true;
    },

    /**
     * Login with username and password
     *
     * The API sets HttpOnly cookies for the tokens automatically.
     * No client-side token storage is performed.
     *
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @param {boolean} rememberMe - Passed to API to control cookie persistence
     * @returns {Promise<Object>} Authentication response
     * @throws {Error} When login fails
     */
    async login(username, password, rememberMe = false) {
        if (!this._validateBaseUrl('login')) {
            throw new Error('API base URL is not configured');
        }

        try {
            const response = await fetch(`${BaseUrl}/auth/login`, {
                method: 'POST',
                credentials: 'include', // Include cookies for cross-origin requests
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password, remember_me: rememberMe })
            });

            if (!response.ok) {
                let message = 'Login failed';
                const text = await response.text();
                if (text) {
                    try {
                        const error = JSON.parse(text);
                        message = error.message || message;
                    } catch {
                        // Response wasn't JSON, use raw text
                        message = text;
                    }
                }
                throw new Error(message);
            }

            const data = await response.json();

            // Update auth cache immediately after successful login
            await this.updateAuthCache();

            // Clear any legacy tokens from localStorage/sessionStorage
            // preserveCache=true keeps the freshly populated auth cache intact
            this.clearTokens(true);

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    /**
     * Store JWT token
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     *             This method is kept for clearing legacy tokens.
     * @param {string} token - JWT access token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     * @returns {boolean} True if storage succeeded, false if storage is unavailable
     */
    setToken(token, persistent = false) {
        console.warn('Auth.setToken() is deprecated. Tokens are now stored in HttpOnly cookies only.');
        try {
            const storage = persistent ? localStorage : sessionStorage;
            const otherStorage = persistent ? sessionStorage : localStorage;

            // Set token in target storage
            storage.setItem(this.TOKEN_KEY, token);

            // Clear from opposite storage to prevent duplicate tokens
            otherStorage.removeItem(this.TOKEN_KEY);
            return true;
        } catch (e) {
            // Storage may be unavailable in hardened privacy modes
            console.warn('Unable to store token:', e.message);
            return false;
        }
    },

    /**
     * Internal method to retrieve raw token without deprecation warning.
     * Used by deprecated methods that need token access without triggering nested warnings.
     *
     * @private
     * @returns {string|null} JWT token or null if not found/unavailable
     */
    _getRawToken() {
        try {
            return localStorage.getItem(this.TOKEN_KEY) ||
                   sessionStorage.getItem(this.TOKEN_KEY);
        } catch {
            // Storage may be unavailable in hardened privacy modes
            return null;
        }
    },

    /**
     * Get stored JWT token
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     *             Use isAuthenticated() or checkAuthAsync() instead.
     * @returns {string|null} JWT token or null if not found/unavailable
     */
    getToken() {
        console.warn('Auth.getToken() is deprecated. Tokens are now stored in HttpOnly cookies only.');
        return this._getRawToken();
    },

    /**
     * Check if tokens are stored persistently (in localStorage)
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     * @returns {boolean} True if refresh token is in localStorage, false otherwise/unavailable
     */
    isPersistentStorage() {
        console.warn('Auth.isPersistentStorage() is deprecated. Tokens are now stored in HttpOnly cookies only.');
        try {
            return localStorage.getItem(this.REFRESH_KEY) !== null;
        } catch (e) {
            // Storage may be unavailable in hardened privacy modes
            console.warn('Unable to check persistent storage:', e.message);
            return false;
        }
    },

    /**
     * Store refresh token
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     *             This method is kept for clearing legacy tokens.
     * @param {string} token - Refresh token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     * @returns {boolean} True if storage succeeded, false if storage is unavailable
     */
    setRefreshToken(token, persistent = false) {
        console.warn('Auth.setRefreshToken() is deprecated. Tokens are now stored in HttpOnly cookies only.');
        try {
            const storage = persistent ? localStorage : sessionStorage;
            const otherStorage = persistent ? sessionStorage : localStorage;

            // Set token in target storage
            storage.setItem(this.REFRESH_KEY, token);

            // Clear from opposite storage to prevent duplicate tokens
            otherStorage.removeItem(this.REFRESH_KEY);
            return true;
        } catch (e) {
            // Storage may be unavailable in hardened privacy modes
            console.warn('Unable to store refresh token:', e.message);
            return false;
        }
    },

    /**
     * Get refresh token
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     *             Use isAuthenticated() or checkAuthAsync() instead.
     * @returns {string|null} Refresh token or null if not found/unavailable
     */
    getRefreshToken() {
        console.warn('Auth.getRefreshToken() is deprecated. Tokens are now stored in HttpOnly cookies only.');
        try {
            return localStorage.getItem(this.REFRESH_KEY) ||
                   sessionStorage.getItem(this.REFRESH_KEY);
        } catch (e) {
            // Storage may be unavailable in hardened privacy modes
            console.warn('Unable to access refresh token storage:', e.message);
            return null;
        }
    },

    /**
     * Remove all legacy tokens from localStorage/sessionStorage
     *
     * @param {boolean} preserveCache - If true, only clear legacy tokens without touching auth cache
     */
    clearTokens(preserveCache = false) {
        // Clear auth cache unless preserveCache is true
        if (!preserveCache) {
            this._cachedAuthState = null;
            this._cacheExpiry = 0;
        }

        // Clear legacy tokens from storage
        try {
            localStorage.removeItem(this.TOKEN_KEY);
            sessionStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_KEY);
            sessionStorage.removeItem(this.REFRESH_KEY);
        } catch (e) {
            // Storage may be unavailable in hardened privacy modes
            // Silently fail - tokens may not have been stored anyway
            console.warn('Unable to clear token storage:', e.message);
        }
    },

    /**
     * Decode and get JWT token payload
     *
     * @deprecated Tokens are now stored in HttpOnly cookies only.
     *             Use checkAuthAsync() to get user info from the server.
     * @returns {Object|null} Decoded JWT payload or null if invalid/missing
     * @private
     */
    getPayload() {
        console.warn('Auth.getPayload() is deprecated. Use checkAuthAsync() instead.');
        const token = this._getRawToken();
        if (!token) return null;

        try {
            // Get the payload segment (second part of JWT)
            let payload = token.split('.')[1];

            // Convert base64url to base64 (RFC 4648)
            // Replace URL-safe characters and add padding
            payload = payload.replace(/-/g, '+').replace(/_/g, '/');

            // Add padding if needed (base64 strings must be multiple of 4)
            const pad = payload.length % 4;
            if (pad) {
                if (pad === 1) {
                    // Invalid base64url - cannot have length % 4 === 1
                    throw new Error('Invalid base64url string');
                }
                payload += new Array(5 - pad).join('=');
            }

            return JSON.parse(atob(payload));
        } catch (e) {
            console.error('Failed to decode JWT token:', e.message);
            return null;
        }
    },

    /**
     * Check if user is authenticated (synchronous, uses cache)
     *
     * Returns the "last known good" authentication state from cache.
     * This method ignores cache expiry to prevent UI flicker when cache
     * expires but user is still logged in.
     *
     * For staleness-aware checks, use isAuthenticatedCached() which returns
     * null when cache is expired. For authoritative server checks, use checkAuthAsync().
     *
     * @returns {boolean} True if last known state was authenticated, false otherwise
     */
    isAuthenticated() {
        return Boolean(this._cachedAuthState?.authenticated);
    },

    /**
     * Check if user is authenticated (synchronous, uses cache)
     * Returns null if auth state is unknown (never checked or cache expired)
     *
     * Three possible return values:
     * - true: definitely logged in (server confirmed)
     * - false: definitely logged out (server confirmed)
     * - null: unknown (never checked or cache expired)
     *
     * @returns {boolean|null} True/false if auth state known, null if unknown
     */
    isAuthenticatedCached() {
        const now = Date.now();

        // Check if cache is valid
        if (this._cachedAuthState !== null && now < this._cacheExpiry) {
            return this._cachedAuthState.authenticated === true;
        }

        // Cache expired or never populated - auth state unknown
        return null;
    },

    /**
     * Check if auth state is known (has been checked with server)
     *
     * @returns {boolean} True if auth state is known (cached), false if unknown
     */
    isAuthStateKnown() {
        const now = Date.now();
        return this._cachedAuthState !== null && now < this._cacheExpiry;
    },

    /**
     * Update the auth cache by fetching from /auth/me
     *
     * @returns {Promise<Object>} Auth state object with authenticated property
     */
    async updateAuthCache() {
        const state = await this.checkAuthAsync();
        this._cachedAuthState = state;
        this._cacheExpiry = Date.now() + this._cacheDuration;
        return state;
    },

    /**
     * Check authentication state with the server
     * Calls /auth/me endpoint to verify session (works with HttpOnly cookies)
     *
     * Returns an object with authenticated property:
     * - { authenticated: true, username, roles, exp, ... } if logged in
     * - { authenticated: false } if not logged in
     * - { authenticated: false, error: true } if network/API error occurred
     *
     * @returns {Promise<Object>} Auth state object (never null)
     */
    async checkAuthAsync() {
        if (!this._validateBaseUrl('checkAuthAsync')) {
            return { authenticated: false, error: true };
        }

        try {
            const response = await fetch(`${BaseUrl}/auth/me`, {
                method: 'GET',
                credentials: 'include', // Include cookies for cross-origin requests
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return { authenticated: false };
            }

            const data = await response.json();
            return data.authenticated ? data : { authenticated: false };
        } catch (error) {
            console.error('Auth check failed:', error);
            return { authenticated: false, error: true };
        }
    },

    /**
     * Refresh access token using refresh token
     * Deduplicates concurrent refresh calls to prevent race conditions
     *
     * @returns {Promise<boolean>} True if refresh succeeded
     * @throws {Error} When refresh fails
     */
    async refreshToken() {
        // Deduplicate concurrent refresh calls
        if ( this._refreshPromise ) {
            return this._refreshPromise;
        }

        this._refreshPromise = this._doRefreshToken();
        try {
            return await this._refreshPromise;
        } finally {
            this._refreshPromise = null;
        }
    },

    /**
     * Internal method to perform the actual token refresh
     *
     * The API reads the refresh token from HttpOnly cookies and sets
     * new access/refresh tokens as HttpOnly cookies in the response.
     *
     * @private
     * @returns {Promise<boolean>} True if refresh succeeded
     * @throws {Error} When refresh fails
     */
    async _doRefreshToken() {
        if (!this._validateBaseUrl('_doRefreshToken')) {
            throw new Error('API base URL is not configured');
        }

        try {
            const response = await fetch(`${BaseUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // Include cookies for cross-origin requests
                headers: {
                    'Accept': 'application/json'
                }
                // No body needed - refresh token is read from HttpOnly cookie
            });

            if (!response.ok) {
                let message = 'Token refresh failed';
                const text = await response.text();
                if (text) {
                    try {
                        const error = JSON.parse(text);
                        message = error.message || message;
                    } catch {
                        // Response wasn't JSON, use raw text
                        message = text;
                    }
                }
                throw new Error(message);
            }

            // If logout started during the refresh, don't update cache
            if (this._isLoggingOut) {
                return true;
            }

            // Update auth cache after successful refresh
            await this.updateAuthCache();

            return true;
        } catch (error) {
            if (!this._isLoggingOut) {
                this.clearTokens();
            }
            throw error;
        }
    },

    /**
     * Admin pages that require authentication
     * @private
     */
    _adminPages: ['admin-dashboard', 'missals-editor', 'extending', 'temporale', 'decrees'],

    /**
     * Check if current page is an admin page
     * @private
     * @returns {boolean} True if on an admin page
     */
    _isAdminPage() {
        const segments = window.location.pathname.split('/').filter(Boolean);
        const currentPage = segments.pop()?.replace('.php', '') || '';
        return this._adminPages.includes(currentPage);
    },

    /**
     * Logout user
     * Calls logout endpoint and clears all tokens
     * Redirects to home page if on an admin page, otherwise reloads
     *
     * @returns {Promise<void>}
     */
    async logout() {
        // Set flag immediately to prevent in-flight refresh from writing tokens
        this._isLoggingOut = true;

        // Stop all timers first to prevent any new refresh attempts
        this.stopAllTimers();

        // Null out any pending refresh promise to prevent token writes
        this._refreshPromise = null;

        // Attempt server logout to clear HttpOnly cookies
        // The server will read the token from cookie, so we don't need to send it in header
        if (this._validateBaseUrl('logout')) {
            try {
                await fetch(`${BaseUrl}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include', // Include cookies for cross-origin requests
                    headers: {
                        'Accept': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        this.clearTokens();

        // Redirect to home if on admin page, otherwise reload
        if (this._isAdminPage()) {
            window.location.href = '/';
        } else {
            window.location.reload();
        }
    },

    /**
     * Auto-refresh tokens before expiry
     * Checks every minute and refreshes if less than 5 minutes until expiry.
     * Uses cached auth state to determine expiry time.
     */
    startAutoRefresh() {
        // Prevent multiple concurrent intervals
        if (this._autoRefreshInterval !== null) {
            console.warn('Auto-refresh already running');
            return;
        }

        const checkInterval = 60000; // Check every minute

        this._autoRefreshInterval = setInterval(async () => {
            // Check cached auth state
            if (!this._cachedAuthState || !this._cachedAuthState.exp) return;

            try {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = this._cachedAuthState.exp - now;

                // Refresh if less than 5 minutes until expiry
                if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
                    await this.refreshToken();
                    console.log('Token refreshed automatically');
                }
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, checkInterval);
    },

    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this._autoRefreshInterval !== null) {
            clearInterval(this._autoRefreshInterval);
            this._autoRefreshInterval = null;
        }
    },

    /**
     * Show warning before token expiry
     * Checks every 30 seconds and warns if less than 2 minutes until expiry
     *
     * @param {Function} warningCallback - Function to call with seconds until expiry.
     *                                     Caller is responsible for i18n/message formatting.
     */
    startExpiryWarning(warningCallback) {
        // Prevent multiple concurrent intervals
        if (this._expiryWarningInterval !== null) {
            console.warn('Expiry warning already running');
            return;
        }

        this._expiryWarningInterval = setInterval(() => {
            // Check cached auth state
            if (!this._cachedAuthState || !this._cachedAuthState.exp) return;

            try {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = this._cachedAuthState.exp - now;

                // Warn if less than 2 minutes until expiry
                if (timeUntilExpiry > 0 && timeUntilExpiry < 120) {
                    warningCallback(timeUntilExpiry);
                }
            } catch (error) {
                console.error('Expiry warning check failed:', error);
            }
        }, 30000); // Check every 30 seconds
    },

    /**
     * Stop expiry warning timer
     */
    stopExpiryWarning() {
        if (this._expiryWarningInterval !== null) {
            clearInterval(this._expiryWarningInterval);
            this._expiryWarningInterval = null;
        }
    },

    /**
     * Stop all timers (auto-refresh and expiry warning)
     * Useful when cleaning up or logging out
     */
    stopAllTimers() {
        this.stopAutoRefresh();
        this.stopExpiryWarning();
    },

    /**
     * Check user permissions (for future RBAC implementation)
     * Uses cached auth state from /auth/me endpoint
     *
     * @param {string} permission - Permission to check
     * @returns {boolean} True if user has the permission
     */
    hasPermission(permission) {
        if (!this._cachedAuthState || !this._cachedAuthState.authenticated) return false;

        const permissions = this._cachedAuthState.permissions;
        return permissions && permissions.includes(permission);
    },

    /**
     * Check user role (for future RBAC implementation)
     * Uses cached auth state from /auth/me endpoint
     *
     * @param {string} role - Role to check
     * @returns {boolean} True if user has the role
     */
    hasRole(role) {
        if (!this._cachedAuthState || !this._cachedAuthState.authenticated) return false;

        const roles = this._cachedAuthState.roles;
        return roles && roles.includes(role);
    },

    /**
     * Get username from cached auth state
     *
     * @returns {string|null} Username or null if not authenticated
     */
    getUsername() {
        if (!this._cachedAuthState || !this._cachedAuthState.authenticated) return null;

        return this._cachedAuthState.username || null;
    }
};

// Warn if not using HTTPS in production
if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('Authentication over HTTP is insecure. Use HTTPS in production.');
}

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch auth state from server to populate cache
    let authState;
    try {
        authState = await Auth.updateAuthCache();
    } catch (error) {
        console.warn('Failed to initialize auth state on page load:', error);
        return;
    }

    if (authState && authState.authenticated) {
        // Start auto-refresh if authenticated
        Auth.startAutoRefresh();
    }
});
