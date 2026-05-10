/**
 * Shared toast notification utility.
 *
 * Loaded globally via layout/footer.php after Bootstrap, so any page
 * (inline scripts, ES modules, regular scripts) can call
 * window.showToast(message, type).
 *
 * Usage:
 *   showToast('Saved!', 'success');
 *   showToast('Something went wrong', 'danger');
 *
 * Auto-creates a `.toast-container` in document.body on first use with
 * fixed bottom-right positioning. Toasts auto-hide after 5s and remove
 * themselves from the DOM when hidden.
 */
(function (global) {
    'use strict';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    const ICONS = {
        success: 'fa-check-circle',
        danger:  'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info:    'fa-info-circle'
    };

    function showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.style.position = 'fixed';
            container.style.bottom = '1rem';
            container.style.right = '1rem';
            container.style.zIndex = '1100';
            document.body.appendChild(container);
        }

        const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const icon = ICONS[type] || ICONS.info;
        container.insertAdjacentHTML('beforeend',
            '<div id="' + toastId + '" class="toast align-items-center text-bg-' + type + ' border-0" role="alert" aria-live="assertive" aria-atomic="true">'
            + '<div class="d-flex">'
            +   '<div class="toast-body"><i class="fas ' + icon + ' me-2"></i>' + escapeHtml(message) + '</div>'
            +   '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>'
            + '</div>'
            + '</div>'
        );

        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 5000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', function () { toastEl.remove(); });
    }

    global.showToast = showToast;
})(window);
