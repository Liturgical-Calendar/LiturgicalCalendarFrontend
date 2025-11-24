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
            const authUrl = APIConfig.port ? `${APIConfig.protocol}://${APIConfig.host}:${APIConfig.port}` : `${APIConfig.protocol}://${APIConfig.host}`;
            const response = await fetch(`${authUrl}/auth/login`, {
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
     *
     * @param {string} token - JWT access token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     */
    setToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.TOKEN_KEY, token);
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
     * Store refresh token
     *
     * @param {string} token - Refresh token
     * @param {boolean} persistent - Store in localStorage (true) or sessionStorage (false)
     */
    setRefreshToken(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.REFRESH_KEY, token);
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
     * Check if user is authenticated
     * Validates token existence and expiration
     *
     * @returns {boolean} True if authenticated with valid token
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
     *
     * @returns {Promise<string>} New access token
     * @throws {Error} When refresh fails
     */
    async refreshToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const authUrl = APIConfig.port ? `${APIConfig.protocol}://${APIConfig.host}:${APIConfig.port}` : `${APIConfig.protocol}://${APIConfig.host}`;
            const response = await fetch(`${authUrl}/auth/refresh`, {
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
     * Logout user
     * Calls logout endpoint and clears all tokens
     *
     * @returns {Promise<void>}
     */
    async logout() {
        const token = this.getToken();

        if (token) {
            try {
                const authUrl = APIConfig.port ? `${APIConfig.protocol}://${APIConfig.host}:${APIConfig.port}` : `${APIConfig.protocol}://${APIConfig.host}`;
                await fetch(`${authUrl}/auth/logout`, {
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
        const checkInterval = 60000; // Check every minute

        setInterval(async () => {
            if (!this.isAuthenticated()) return;

            const token = this.getToken();
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
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
     * Show warning before token expiry
     * Checks every 30 seconds and warns if less than 2 minutes until expiry
     *
     * @param {Function} warningCallback - Function to call when warning should be shown
     */
    startExpiryWarning(warningCallback) {
        setInterval(() => {
            if (!this.isAuthenticated()) return;

            const token = this.getToken();
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
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
     * Check user permissions (for future RBAC implementation)
     *
     * @param {string} permission - Permission to check
     * @returns {boolean} True if user has the permission
     */
    hasPermission(permission) {
        if (!this.isAuthenticated()) return false;

        const token = this.getToken();
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.permissions && payload.permissions.includes(permission);
        } catch (e) {
            return false;
        }
    },

    /**
     * Check user role (for future RBAC implementation)
     *
     * @param {string} role - Role to check
     * @returns {boolean} True if user has the role
     */
    hasRole(role) {
        if (!this.isAuthenticated()) return false;

        const token = this.getToken();
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role === role || (payload.roles && payload.roles.includes(role));
        } catch (e) {
            return false;
        }
    },

    /**
     * Get username from token
     *
     * @returns {string|null} Username or null if not authenticated
     */
    getUsername() {
        if (!this.isAuthenticated()) return null;

        const token = this.getToken();
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.sub || payload.username || 'Admin';
        } catch (e) {
            return null;
        }
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
