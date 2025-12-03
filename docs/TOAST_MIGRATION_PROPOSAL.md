# Toast Notification Migration Proposal

This document proposes migrating from jQuery toastr to native Bootstrap toasts using the
`use-bootstrap-toaster` library.

## Current State

The frontend currently uses the jQuery toastr plugin for toast notifications:

```javascript
toastr["success"](message, title);
toastr["error"](message, title);
toastr["warning"](message, title);
toastr["info"](message, title);
```

**Toastr advantages:**

- Simple API with built-in icons for each toast type
- Automatic color styling based on type
- Well-established and widely used

**Toastr disadvantages:**

- Requires jQuery dependency
- Additional CSS/JS assets to load
- Styling doesn't match Bootstrap 5 design language
- Not maintained as actively as Bootstrap ecosystem

## Proposed Solution

Migrate to [use-bootstrap-toaster](https://github.com/use-bootstrap/use-bootstrap-toaster), a lightweight
Bootstrap 5 toast wrapper.

### Library Overview

- **Version**: 1.0.3 (June 2024)
- **License**: MIT
- **Size**: Lightweight, leverages Bootstrap's built-in toast component
- **TypeScript**: Includes type definitions

### Installation

**NPM:**

```bash
npm install use-bootstrap-toaster
```

**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/use-bootstrap-toaster@1.0.3/dist/use-bootstrap-toaster.min.js"></script>
```

### Basic Usage

```javascript
import toast from 'use-bootstrap-toaster';

// Simple toast
toast('Hello, world! This is a toast message.');

// With options
toast({
    header: 'Success',
    body: 'Operation completed successfully',
    classes: 'bg-success text-white',
    delay: 5000
});
```

### Available Options

| Option      | Type    | Default       | Description                                       |
|-------------|---------|---------------|---------------------------------------------------|
| animation   | boolean | true          | Apply CSS fade transition                         |
| autohide    | boolean | true          | Automatically dismiss after delay                 |
| delay       | number  | 4000          | Delay in milliseconds before hiding               |
| gap         | number  | 16            | Space between multiple toasts (px)                |
| margin      | string  | '1rem'        | Margin from corner                                |
| placement   | string  | 'top-right'   | Position: top-right, top-left, bottom-right, etc. |
| classes     | string  | ''            | Additional CSS classes                            |
| header      | string  | ''            | Header content (can include icon, title, time)    |
| body        | string  | ''            | Main toast message                                |

### Methods

```javascript
// Hide a specific toast
const myToast = toast({ body: 'Message', autohide: false });
myToast.hide();

// Hide all toasts
toast.hide();
```

## Migration Strategy

### Phase 1: Create Compatibility Wrapper

Create a wrapper that provides the same API as toastr but uses Bootstrap toasts internally.
This allows incremental migration without changing existing code immediately.

**Proposed wrapper (`assets/js/toast-wrapper.js`):**

```javascript
/**
 * Toast notification wrapper providing toastr-compatible API
 * using use-bootstrap-toaster under the hood.
 */

// Icon mappings for each toast type (using Bootstrap Icons)
const TOAST_CONFIG = {
    success: {
        icon: '<i class="bi bi-check-circle-fill text-success me-2"></i>',
        classes: 'border-success',
        headerClass: 'bg-success-subtle'
    },
    error: {
        icon: '<i class="bi bi-x-circle-fill text-danger me-2"></i>',
        classes: 'border-danger',
        headerClass: 'bg-danger-subtle'
    },
    warning: {
        icon: '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>',
        classes: 'border-warning',
        headerClass: 'bg-warning-subtle'
    },
    info: {
        icon: '<i class="bi bi-info-circle-fill text-info me-2"></i>',
        classes: 'border-info',
        headerClass: 'bg-info-subtle'
    }
};

/**
 * Show a toast notification
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {string} message - Toast message body
 * @param {string} title - Toast header title
 * @param {object} options - Additional options
 * @returns {object} Toast instance with hide() method and DOM element
 */
function showToast(type, message, title, options = {}) {
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

    const toastOptions = {
        header: {
            icon: config.icon,
            title: title || type.charAt(0).toUpperCase() + type.slice(1),
            closeBtn: true
        },
        body: message,
        classes: config.classes,
        placement: 'top-right',
        delay: type === 'error' ? 0 : 5000, // Errors don't auto-hide
        autohide: type !== 'error',
        ...options
    };

    const instance = toast(toastOptions);

    // Return jQuery-like object for compatibility with .attr() calls
    return {
        hide: () => instance.hide(),
        attr: (name, value) => {
            if (instance.element) {
                instance.element.setAttribute(name, value);
            }
            return this;
        }
    };
}

// Export toastr-compatible API
const toastrCompat = {
    success: (message, title, options) => showToast('success', message, title, options),
    error: (message, title, options) => showToast('error', message, title, options),
    warning: (message, title, options) => showToast('warning', message, title, options),
    info: (message, title, options) => showToast('info', message, title, options),
    hide: () => toast.hide()
};

// For backwards compatibility, also support toastr["type"] syntax
export default new Proxy(toastrCompat, {
    get(target, prop) {
        return target[prop];
    }
});
```

### Phase 2: Add Bootstrap Icons

Ensure Bootstrap Icons are available. Add to `layout/header.php`:

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
```

### Phase 3: Update Script Includes

Replace toastr with the new wrapper in `layout/footer.php`:

```html
<!-- Remove: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css" rel="stylesheet">

<!-- Add: -->
<script src="https://cdn.jsdelivr.net/npm/use-bootstrap-toaster@1.0.3/dist/use-bootstrap-toaster.min.js"></script>
<script src="/assets/js/toast-wrapper.js"></script>
```

### Phase 4: Gradual Code Migration

With the compatibility wrapper in place, existing code continues to work. Over time, update
call sites to use the cleaner API directly:

**Before (toastr):**

```javascript
toastr["success"]('Calendar saved successfully', 'Success');
toastr["error"](error.message, 'Error');
```

**After (direct use-bootstrap-toaster):**

```javascript
toast({
    header: { icon: '<i class="bi bi-check-circle-fill"></i>', title: 'Success' },
    body: 'Calendar saved successfully',
    classes: 'border-success'
});
```

### Phase 5: Update E2E Tests

Update test selectors to match new toast structure:

```typescript
// Before
await page.waitForSelector('.toast-success');

// After
await page.waitForSelector('.toast.border-success');
// Or use data attributes
await page.waitForSelector('[data-toast-type="success"]');
```

## Considerations

### Icons

Bootstrap native toasts don't include icons by default. Options:

1. **Bootstrap Icons** (recommended) - Already used elsewhere in the project
2. **Font Awesome** - Already loaded for other icons
3. **Custom SVG icons** - Inline SVGs for minimal dependencies

### Styling

The wrapper can apply consistent styling via CSS classes:

- `border-{type}` for colored borders
- `bg-{type}-subtle` for subtle background colors
- Custom CSS for exact toastr-like appearance if desired

### Accessibility

Bootstrap toasts include proper ARIA attributes by default:

- `role="alert"`
- `aria-live="assertive"` or `aria-live="polite"`
- `aria-atomic="true"`

### Browser Support

use-bootstrap-toaster supports the same browsers as Bootstrap 5:

- Chrome, Firefox, Safari, Edge (latest versions)
- No IE11 support (same as Bootstrap 5)

## Files to Modify

1. `layout/header.php` - Add Bootstrap Icons CSS
2. `layout/footer.php` - Replace toastr with use-bootstrap-toaster
3. `assets/js/toast-wrapper.js` - New compatibility wrapper (create)
4. `assets/js/extending.js` - Update toast calls (optional with wrapper)
5. `assets/js/auth.js` - Update toast calls (if any)
6. `e2e/*.spec.ts` - Update toast selectors in tests

## Timeline

| Phase | Description                  | Effort    |
|-------|------------------------------|-----------|
| 1     | Create compatibility wrapper | 2-3 hours |
| 2     | Add Bootstrap Icons          | 15 min    |
| 3     | Update script includes       | 30 min    |
| 4     | Gradual code migration       | Ongoing   |
| 5     | Update E2E tests             | 1-2 hours |

**Total estimated effort**: 4-6 hours for initial migration, with ongoing cleanup.

## Decision

- [ ] Proceed with migration
- [ ] Keep toastr (works fine, low priority)
- [ ] Evaluate alternative libraries
- [ ] Create custom Bootstrap toast wrapper without library

## References

- [use-bootstrap-toaster Documentation](https://use-bootstrap-toaster.js.org)
- [use-bootstrap-toaster GitHub](https://github.com/use-bootstrap/use-bootstrap-toaster)
- [Bootstrap 5 Toasts](https://getbootstrap.com/docs/5.3/components/toasts/)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
