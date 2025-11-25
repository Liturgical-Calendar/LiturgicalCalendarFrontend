/**
 * Authentication helper module for JWT token management
 * Handles login, logout, token storage, and automatic token refresh
 *
 * @module Auth
 */
const Auth = {
    /**
     * Storage keys for JWT and refresh tokens
     */
    TOKEN_KEY: 'litcal_jwt_token',
    REFRESH_KEY: 'litcal_refresh_token',

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
     * Login with username and password
     *
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @param {boolean} rememberMe - Store token persistently in localStorage
     * @returns {Promise<Object>} Authentication response with token
     * @throws {Error} When login fails
     */
    async login(username, password, rememberMe = false) {
        try {
            const response = await fetch(`${BaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password })
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
            this.setToken(data.access_token, rememberMe);

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
     *
     * @param {string} token - JWT access token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     */
    setToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        const otherStorage = persistent ? sessionStorage : localStorage;

        // Set token in target storage
        storage.setItem(this.TOKEN_KEY, token);

        // Clear from opposite storage to prevent duplicate tokens
        otherStorage.removeItem(this.TOKEN_KEY);
    },

    /**
     * Get stored JWT token
     *
     * @returns {string|null} JWT token or null if not found
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) ||
               sessionStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * Check if tokens are stored persistently (in localStorage)
     * Specifically checks where the refresh token is stored since that's
     * what determines persistence during token refresh operations
     *
     * @returns {boolean} True if refresh token is in localStorage, false otherwise
     */
    isPersistentStorage() {
        return localStorage.getItem(this.REFRESH_KEY) !== null;
    },

    /**
     * Store refresh token
     *
     * @param {string} token - Refresh token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     */
    setRefreshToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        const otherStorage = persistent ? sessionStorage : localStorage;

        // Set token in target storage
        storage.setItem(this.REFRESH_KEY, token);

        // Clear from opposite storage to prevent duplicate tokens
        otherStorage.removeItem(this.REFRESH_KEY);
    },

    /**
     * Get refresh token
     *
     * @returns {string|null} Refresh token or null if not found
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
     * Decode and get JWT token payload
     * Internal helper to centralize JWT parsing logic
     *
     * @returns {Object|null} Decoded JWT payload or null if invalid/missing
     * @private
     */
    getPayload() {
        const token = this.getToken();
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
     * Check if user is authenticated
     * Validates token existence and expiration
     *
     * @returns {boolean} True if authenticated with valid token
     */
    isAuthenticated() {
        const payload = this.getPayload();
        if (!payload) return false;

        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    },

    /**
     * Refresh access token using refresh token
     * Deduplicates concurrent refresh calls to prevent race conditions
     *
     * @returns {Promise<string>} New access token
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
     * @private
     * @returns {Promise<string>} New access token
     * @throws {Error} When refresh fails
     */
    async _doRefreshToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        // Detect which storage tier is currently being used
        const isPersistent = this.isPersistentStorage();

        try {
            const response = await fetch(`${BaseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
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

            const data = await response.json();
            // Write refreshed tokens back to the same storage tier
            this.setToken(data.access_token, isPersistent);
            if (data.refresh_token) {
                this.setRefreshToken(data.refresh_token, isPersistent);
            }
            return data.access_token;
        } catch (error) {
            this.clearTokens();
            throw error;
        }
    },

    /**
     * Logout user
     * Calls logout endpoint and clears all tokens
     *
     * @returns {Promise<void>}
     */
    async logout() {
        const token = this.getToken();

        if (token) {
            try {
                await fetch(`${BaseUrl}/auth/logout`, {
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
    },

    /**
     * Auto-refresh tokens before expiry
     * Checks every minute and refreshes if less than 5 minutes until expiry
     */
    startAutoRefresh() {
        // Prevent multiple concurrent intervals
        if (this._autoRefreshInterval !== null) {
            console.warn('Auto-refresh already running');
            return;
        }

        const checkInterval = 60000; // Check every minute

        this._autoRefreshInterval = setInterval(async () => {
            if (!this.isAuthenticated()) return;

            const payload = this.getPayload();
            if (!payload) return;

            try {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = payload.exp - now;

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
     * @param {Function} warningCallback - Function to call when warning should be shown
     */
    startExpiryWarning(warningCallback) {
        // Prevent multiple concurrent intervals
        if (this._expiryWarningInterval !== null) {
            console.warn('Expiry warning already running');
            return;
        }

        this._expiryWarningInterval = setInterval(() => {
            if (!this.isAuthenticated()) return;

            const payload = this.getPayload();
            if (!payload) return;

            try {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = payload.exp - now;

                // Warn if less than 2 minutes until expiry
                if (timeUntilExpiry > 0 && timeUntilExpiry < 120) {
                    warningCallback('Your session will expire soon. Please save your work.');
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
     *
     * @param {string} permission - Permission to check
     * @returns {boolean} True if user has the permission
     */
    hasPermission(permission) {
        const payload = this.getPayload();
        if (!payload) return false;

        return payload.permissions && payload.permissions.includes(permission);
    },

    /**
     * Check user role (for future RBAC implementation)
     *
     * @param {string} role - Role to check
     * @returns {boolean} True if user has the role
     */
    hasRole(role) {
        const payload = this.getPayload();
        if (!payload) return false;

        return payload.role === role || (payload.roles && payload.roles.includes(role));
    },

    /**
     * Get username from token
     *
     * @returns {string|null} Username or null if not authenticated
     */
    getUsername() {
        const payload = this.getPayload();
        if (!payload) return null;

        return payload.sub || payload.username || 'Admin';
    }
};

// Warn if not using HTTPS in production
if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('Authentication over HTTP is insecure. Use HTTPS in production.');
}

// Start auto-refresh on page load
document.addEventListener('DOMContentLoaded', () => {
    Auth.startAutoRefresh();
});
