# Frontend Modernization Roadmap

This document explores options for modernizing the LiturgicalCalendar frontend, moving from the current PHP/Bootstrap
implementation to a modern TypeScript-based platform that better coordinates with the API backend.

## Current State

### Technology Stack

- **Server-side**: PHP 8.1+ with Twig-style includes
- **Styling**: Bootstrap 5 with SB Admin theme
- **JavaScript**: Vanilla ES6, no build process, no TypeScript
- **State Management**: Global variables, manual DOM manipulation
- **API Communication**: Fetch API with manual JSON handling
- **Authentication**: JWT tokens with custom `auth.js` module
- **i18n**: PHP gettext

### Pain Points

1. **No Type Safety**: Vanilla JavaScript lacks compile-time type checking, leading to runtime errors
   (e.g., the serialization mismatch discovered)
2. **Manual DOM Manipulation**: Complex state management via direct DOM updates is error-prone
3. **No Build Pipeline**: Cannot use modern tooling (tree-shaking, code splitting, minification)
4. **Difficult Testing**: No component isolation makes unit testing challenging
5. **Code Organization**: Large monolithic JS files (e.g., `extending.js` is very large)
6. **Schema Coordination**: No way to share types/schemas between frontend and backend

### Assets Worth Preserving

1. **`liturgy-components-js`**: ES6 module library with TypeScript definitions
2. **Bootstrap Styling**: Familiar UI patterns, responsive design
3. **Authentication Flow**: JWT implementation is functional
4. **API Integration Patterns**: Fetch-based communication works

---

## Requirements for New Platform

### Must Have

- [ ] **TypeScript Support**: First-class TypeScript integration
- [ ] **Component-Based Architecture**: Reusable, testable UI components
- [ ] **Build Pipeline**: Modern bundling with tree-shaking, code splitting
- [ ] **Form Handling**: Robust form state management and validation
- [ ] **API Integration**: Clean patterns for REST API communication
- [ ] **Authentication**: JWT token management with refresh flow
- [ ] **i18n**: Internationalization support (multiple languages including Latin)
- [ ] **SSR/SSG Option**: SEO-friendly rendering for public pages

### Should Have

- [ ] **Schema Validation**: Integration with JSON Schema or Zod/Yup
- [ ] **Type Generation**: Generate TypeScript types from JSON schemas or OpenAPI
- [ ] **Hot Module Replacement**: Fast development iteration
- [ ] **Testing Framework**: Unit and integration testing support
- [ ] **Accessibility**: WCAG compliance tooling

### Nice to Have

- [ ] **PWA Support**: Offline capability for calendar viewing
- [ ] **Dark Mode**: Theme switching support
- [ ] **Component Library Integration**: Easy Bootstrap or Tailwind integration

---

## Platform Options

### Build-Free ESM-Native Options

Modern browsers now fully support ES modules natively, making build-step-free development viable:

- `<script type="module">` for native ESM
- Import maps for bare module specifiers
- Dynamic imports for code splitting
- Top-level await

JSDoc provides full TypeScript-level type checking in VS Code without compilation. This approach aligns with web
standards and reduces tooling complexity.

---

### Option 1: Vanilla ESM + Web Components + HTMX

**Overview**: A standards-based approach using native browser features. Web Components provide encapsulation,
HTMX enables server-driven interactivity, and Alpine.js handles client-side reactivity when needed.

**Pros**:

- **Zero build step** - Run directly in browser
- **Web standards** - No framework lock-in, future-proof
- **JSDoc types** - Full IDE support without compilation
- **Progressive enhancement** - Works without JavaScript
- **Small footprint** - Only load what you need
- **PHP integration** - HTMX works excellently with PHP backends
- **Long-term stability** - Web standards don't break

**Cons**:

- More manual setup than frameworks
- Fewer pre-built components
- Less structured than frameworks (need discipline)
- Web Components have some quirks (shadow DOM styling)

**Best For**: Projects that prioritize web standards, longevity, and simplicity.

**Stack**:

```text
Native ESM
├── Web Components (Custom Elements + Shadow DOM)
├── HTMX (server-driven interactivity)
├── Alpine.js (client-side reactivity where needed)
├── Tailwind CSS (utility-first styling)
├── JSDoc (type annotations)
└── No build step required
```

**Example Component with JSDoc Types**:

```javascript
// @ts-check

/**
 * @typedef {Object} DiocesanMetadata
 * @property {string} diocese_id
 * @property {string} diocese_name
 * @property {string} nation
 * @property {string[]} locales
 * @property {string} timezone
 */

/**
 * @typedef {Object} LiturgicalEvent
 * @property {string} event_key
 * @property {string[]} color
 * @property {number} grade
 * @property {string[]} common
 * @property {number} day
 * @property {number} month
 */

/**
 * @typedef {Object} DiocesanLitCalItem
 * @property {LiturgicalEvent} liturgical_event
 * @property {{ since_year: number, until_year?: number }} metadata
 */

/**
 * @typedef {Object} DiocesanCalendar
 * @property {DiocesanLitCalItem[]} litcal
 * @property {DiocesanMetadata} metadata
 * @property {Object} [settings]
 */

export class CalendarEditor extends HTMLElement {
    /** @type {DiocesanCalendar | null} */
    #calendarData = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    /**
     * Load calendar data from API
     * @param {string} calendarId
     * @returns {Promise<void>}
     */
    async loadCalendar(calendarId) {
        const response = await fetch(`/api/data/diocese/${calendarId}`);
        /** @type {DiocesanCalendar} */
        this.#calendarData = await response.json();
        this.render();
    }

    render() {
        // Render logic
    }
}

customElements.define('calendar-editor', CalendarEditor);
```

---

### Option 2: Lit (Web Components Library)

**Overview**: Google's lightweight library for building Web Components. Works without a build step
while providing helpful abstractions over raw Web Components.

**Pros**:

- **No build required** - Works directly in browsers via CDN
- **Reactive properties** - Declarative rendering without virtual DOM
- **TypeScript optional** - JSDoc works perfectly
- **Tiny size** - ~5KB minified
- **Standards-based** - Just Web Components with conveniences
- **Great documentation** - Well-maintained by Google

**Cons**:

- Still need to learn Lit's patterns
- Shadow DOM styling can be tricky
- Smaller ecosystem than React/Vue

**Best For**: Those who want Web Components with less boilerplate.

**Stack**:

```text
Lit 3.x (via CDN or npm)
├── Lit HTML (templating)
├── Reactive properties
├── Tailwind CSS (styling)
├── JSDoc (type annotations)
└── Optional build step (for production optimization)
```

**Example**:

```javascript
// @ts-check
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@3/+esm';

/**
 * @typedef {import('./types.js').DiocesanCalendar} DiocesanCalendar
 */

export class CalendarSelector extends LitElement {
    static properties = {
        calendars: { type: Array },
        selected: { type: String }
    };

    static styles = css`
        select { @apply form-control; }
    `;

    constructor() {
        super();
        /** @type {Array<{id: string, name: string}>} */
        this.calendars = [];
        /** @type {string} */
        this.selected = '';
    }

    render() {
        return html`
            <select @change=${this.#handleChange}>
                ${this.calendars.map(cal => html`
                    <option value=${cal.id} ?selected=${cal.id === this.selected}>
                        ${cal.name}
                    </option>
                `)}
            </select>
        `;
    }

    #handleChange(e) {
        this.dispatchEvent(new CustomEvent('calendar-selected', {
            detail: { calendarId: e.target.value }
        }));
    }
}

customElements.define('calendar-selector', CalendarSelector);
```

---

### Option 3: Enhance.dev

**Overview**: A standards-based framework for building web applications with Web Components
and server-side rendering. No build step required for development.

**Pros**:

- **SSR Web Components** - Server-renders custom elements
- **Progressive enhancement** - Works without client JS
- **File-based routing** - Simple mental model
- **API routes** - Built-in backend support
- **No build required** - For development
- **Standards-first** - Uses platform features

**Cons**:

- Newer framework, smaller community
- Less ecosystem than React/Vue
- May need Node.js for SSR (not PHP)

**Best For**: Those wanting SSR without framework overhead.

**Note**: Requires Node.js for SSR. Could work alongside PHP API or replace it.

---

### Option 4: Astro (Hybrid Approach)

**Overview**: Astro can be configured for minimal/zero client-side JavaScript with optional
"islands" of interactivity. Supports JSDoc typing.

**Pros**:

- Ships zero JS by default
- Can use React/Vue/Svelte/Lit components as islands
- Excellent performance
- Content-focused
- Good TypeScript AND JSDoc support

**Cons**:

- Requires build step (though minimal)
- Islands architecture adds complexity for highly interactive UIs

**Best For**: Content-heavy sites with selective interactivity.

---

### Option 5: Laravel + Livewire (PHP)

**Overview**: Laravel is the most popular PHP framework. Livewire enables reactive, SPA-like components
without writing JavaScript. This keeps the entire stack in PHP.

**Pros**:

- **Same language** as existing API - no context switching
- **No JavaScript build step** - Livewire compiles to vanilla JS automatically
- **Blade templating** - Clean, familiar PHP templating
- **Reactive components** - SPA-like UX without SPA complexity
- **Excellent ecosystem** - Laravel Forge, extensive packages
- **Great documentation** - Arguably best in PHP ecosystem
- **Form handling** - Laravel's validation is excellent
- **Authentication** - Laravel Sanctum for API tokens works seamlessly
- **Could share code** - Models, validation rules with API (if refactored)

**Cons**:

- Adds framework layer between frontend and existing API
- Laravel has strong opinions that may conflict with existing patterns
- Livewire has learning curve (though simpler than React)
- Two separate applications to maintain (API + Frontend)

**Best For**: Teams that want to stay in PHP and desire rapid development with reactive UIs.

**Stack**:

```text
Laravel 11
├── Livewire 3 (reactive components)
├── Alpine.js (included with Livewire for JS sprinkles)
├── Tailwind CSS (first-class Laravel integration)
├── Blade templates
└── No JavaScript build required (optional Vite for assets)
```

**Example Livewire Component**:

```php
// app/Livewire/DiocesanCalendarEditor.php
<?php

namespace App\Livewire;

use Livewire\Component;
use Illuminate\Support\Facades\Http;

class DiocesanCalendarEditor extends Component
{
    public string $dioceseId = '';
    public array $calendarData = [];
    public array $litcalItems = [];

    protected $rules = [
        'litcalItems.*.liturgical_event.event_key' => 'required|string',
        'litcalItems.*.liturgical_event.day' => 'required|integer|min:1|max:31',
        'litcalItems.*.liturgical_event.month' => 'required|integer|min:1|max:12',
    ];

    public function mount(string $dioceseId): void
    {
        $this->dioceseId = $dioceseId;
        $this->loadCalendar();
    }

    public function loadCalendar(): void
    {
        $response = Http::get(config('api.base_url') . "/data/diocese/{$this->dioceseId}");
        $this->calendarData = $response->json();
        $this->litcalItems = $this->calendarData['litcal'] ?? [];
    }

    public function save(): void
    {
        $this->validate();

        Http::withToken(session('api_token'))
            ->patch(config('api.base_url') . "/data/diocese/{$this->dioceseId}", [
                'litcal' => $this->litcalItems,
                'metadata' => $this->calendarData['metadata'],
            ]);

        $this->dispatch('calendar-saved');
    }

    public function addEvent(): void
    {
        $this->litcalItems[] = [
            'liturgical_event' => [
                'event_key' => '',
                'color' => ['white'],
                'grade' => 3,
                'common' => [],
                'day' => 1,
                'month' => 1,
            ],
            'metadata' => [
                'since_year' => (int) date('Y'),
            ],
        ];
    }

    public function render()
    {
        return view('livewire.diocesan-calendar-editor');
    }
}
```

```blade
{{-- resources/views/livewire/diocesan-calendar-editor.blade.php --}}
<div class="space-y-4">
    @foreach($litcalItems as $index => $item)
        <div class="card p-4" wire:key="event-{{ $index }}">
            <input
                type="text"
                wire:model="litcalItems.{{ $index }}.liturgical_event.event_key"
                class="form-input"
                placeholder="Event Key"
            />
            <div class="grid grid-cols-2 gap-2">
                <input
                    type="number"
                    wire:model="litcalItems.{{ $index }}.liturgical_event.day"
                    min="1" max="31"
                />
                <input
                    type="number"
                    wire:model="litcalItems.{{ $index }}.liturgical_event.month"
                    min="1" max="12"
                />
            </div>
        </div>
    @endforeach

    <button wire:click="addEvent" class="btn btn-secondary">Add Event</button>
    <button wire:click="save" class="btn btn-primary">Save Calendar</button>
</div>
```

---

### Option 6: Symfony + UX Turbo (PHP)

**Overview**: Symfony is a mature, enterprise-grade PHP framework. Symfony UX with Turbo (part of Hotwire)
provides SPA-like navigation and reactive updates without JavaScript build complexity.

**Pros**:

- **Same language** as existing API
- **PSR compliance** - Matches existing API's PSR-7/15/17 patterns
- **À la carte** - Use only components you need
- **Twig templating** - Clean, secure templating
- **Turbo/Stimulus** - Hotwire's proven reactivity model
- **Enterprise-grade** - Battle-tested in large applications
- **Doctrine ORM** - If you ever want to share models with API

**Cons**:

- Steeper learning curve than Laravel
- More configuration required
- Symfony UX ecosystem is smaller than Livewire's
- More verbose than Laravel

**Best For**: Teams that prefer explicit configuration and enterprise patterns.

**Stack**:

```text
Symfony 7
├── Symfony UX Turbo (Hotwire Turbo)
├── Symfony UX Stimulus (lightweight JS controllers)
├── Twig templates
├── Tailwind CSS (via Webpack Encore or standalone)
└── Optional: Asset Mapper (no Node.js required)
```

**Note**: Symfony's Asset Mapper allows using JavaScript packages without Node.js or npm, aligning with
the no-build preference.

---

### Option 7: Ruby on Rails + Hotwire

**Overview**: Rails pioneered convention-over-configuration and recently introduced Hotwire for
modern, reactive applications without heavy JavaScript.

**Pros**:

- **Hotwire is excellent** - Turbo + Stimulus is very mature
- **Convention over configuration** - Rapid development
- **Great for CRUD** - Calendar management is largely CRUD
- **Mature ecosystem** - 20 years of gems and patterns
- **Productive** - Rails developers ship fast

**Cons**:

- **Different language** - Ruby, not PHP
- **Two tech stacks** - PHP API + Ruby frontend = complexity
- **Deployment** - Need Ruby runtime alongside PHP
- **Learning curve** - New language and framework
- **Smaller talent pool** - Ruby developers less common than PHP

**Best For**: Teams willing to learn Ruby for Hotwire's excellent DX.

**Assessment**: Given your PHP expertise and existing PHP API, introducing Ruby adds significant
complexity without proportional benefit. **Not recommended** unless there's strong Ruby interest.

---

### Option 8: Next.js (React)

**Overview**: The most popular React framework with excellent TypeScript support, server-side rendering,
and a massive ecosystem.

**Pros**:

- Largest ecosystem and community
- Excellent TypeScript integration out of the box
- App Router with React Server Components for optimal performance
- Built-in API routes (could proxy to PHP API or use directly)
- Excellent documentation and learning resources
- Easy deployment (Vercel, self-hosted, Docker)
- Great developer tooling (Fast Refresh, error overlay)
- Can incrementally adopt - start with client components

**Cons**:

- React has a steeper learning curve than Vue/Svelte
- More boilerplate than alternatives
- React's hook patterns can be confusing initially
- Larger bundle size than Svelte

**Best For**: Teams that want maximum ecosystem support and long-term stability.

**Form Handling**: React Hook Form + Zod for validation

**Example Stack**:

```text
Next.js 14+ (App Router)
├── TypeScript
├── React Hook Form + Zod (forms/validation)
├── TanStack Query (API state management)
├── next-intl (i18n)
├── NextAuth.js or custom JWT (authentication)
├── Tailwind CSS or Bootstrap 5 (styling)
└── Vitest + React Testing Library (testing)
```

---

### Option 2: Nuxt.js (Vue)

**Overview**: The Vue equivalent of Next.js, known for developer-friendly APIs and excellent
TypeScript support in Vue 3.

**Pros**:

- Vue's template syntax is more approachable than JSX
- Excellent TypeScript support in Vue 3 + Nuxt 3
- Auto-imports reduce boilerplate
- Built-in state management (Pinia integration)
- Simpler mental model than React
- Great documentation
- Smaller learning curve for PHP developers (template-based)

**Cons**:

- Smaller ecosystem than React
- Fewer third-party component libraries
- Less job market demand (if considering contributors)

**Best For**: Teams that prefer simpler syntax and template-based components.

**Form Handling**: VeeValidate + Zod or FormKit

**Example Stack**:

```text
Nuxt 3
├── TypeScript
├── VeeValidate + Zod or FormKit (forms/validation)
├── Pinia (state management)
├── @nuxtjs/i18n (i18n)
├── Custom JWT composable (authentication)
├── Tailwind CSS or Bootstrap 5 (styling)
└── Vitest + Vue Test Utils (testing)
```

---

### Option 3: SvelteKit

**Overview**: A modern framework that compiles components to minimal JavaScript, resulting in
excellent performance and a simpler development model.

**Pros**:

- Smallest bundle sizes (compiles away the framework)
- Simplest syntax - less boilerplate than React/Vue
- Built-in state management (stores)
- Excellent TypeScript support
- True reactivity without virtual DOM
- Forms are simpler (native HTML + progressive enhancement)
- Growing rapidly in popularity

**Cons**:

- Smaller ecosystem than React/Vue
- Fewer learning resources
- Less mature tooling
- Fewer component libraries available

**Best For**: Teams that prioritize performance and simplicity.

**Form Handling**: Superforms + Zod

**Example Stack**:

```text
SvelteKit
├── TypeScript
├── Superforms + Zod (forms/validation)
├── Svelte stores (state management)
├── paraglide-js or svelte-i18n (i18n)
├── Custom JWT stores (authentication)
├── Tailwind CSS or Bootstrap 5 (styling)
└── Vitest + Svelte Testing Library (testing)
```

---

### Option 4: Astro + React/Vue/Svelte Islands

**Overview**: A content-focused framework that renders static HTML by default and hydrates
interactive "islands" only where needed.

**Pros**:

- Excellent performance (minimal JavaScript shipped)
- Use any UI framework (React, Vue, Svelte) for interactive parts
- Perfect for content-heavy sites
- Great for SEO
- Can mix frameworks in the same project
- TypeScript support

**Cons**:

- Less suited for highly interactive applications
- More complex mental model (islands architecture)
- Form-heavy admin interfaces would need many islands

**Best For**: Content-focused sites with selective interactivity.

**Assessment**: The LiturgicalCalendar frontend is form-heavy and interactive. Astro's islands
architecture may add complexity without significant benefit. **Not recommended as primary choice.**

---

### Option 5: Angular

**Overview**: Google's enterprise-grade framework with built-in TypeScript and opinionated structure.

**Pros**:

- TypeScript is mandatory (ensures type safety)
- Very structured and opinionated
- Comprehensive built-in features (forms, HTTP, routing, i18n)
- Excellent for large enterprise applications
- Strong typing throughout

**Cons**:

- Steepest learning curve
- Most verbose/boilerplate heavy
- Slower development iteration
- Larger bundle sizes
- Declining relative popularity

**Best For**: Large teams needing strict architectural patterns.

**Assessment**: The overhead of Angular may be excessive for this project size. **Not recommended.**

---

## Recommendation

Given your preferences for:

- No compilation/build step preferred
- Tailwind CSS
- Self-hosted deployment
- No strict timeline
- PHP expertise (existing API is PHP)

### Two Strong Paths

The decision fundamentally comes down to: **Stay in PHP or embrace JavaScript/Web Standards?**

---

### Path A: **Laravel + Livewire + Tailwind** (PHP-First)

**Best if**: You want to leverage PHP expertise, prefer integrated form handling, and value
having a unified technology stack.

**Rationale**:

1. **Same language** - No context switching between PHP (API) and another language (frontend)
2. **Excellent form handling** - Laravel's validation is world-class
3. **Livewire = reactive without JS** - SPA-like UX with PHP components
4. **First-class Tailwind** - Laravel ships with Tailwind integration
5. **Potential code sharing** - Could eventually share validation rules, DTOs with API
6. **Great documentation** - Laravel + Livewire docs are excellent
7. **Deployment simplicity** - Same PHP runtime as API

**Stack**:

```text
Laravel 11
├── Livewire 3 (reactive components)
├── Alpine.js (included, for JS sprinkles)
├── Tailwind CSS (built-in)
├── Blade templates
└── Optional: Vite (only if you want asset optimization)
```

**Considerations**:

- Laravel has opinions - need to work with them, not against them
- Two separate PHP applications (API + Frontend)
- Could consider merging API into Laravel long-term (big refactor)

---

### Path B: **Lit + Shoelace + Tailwind** (Web Standards-First)

**Best if**: You prefer true separation of concerns, want to avoid PHP framework overhead,
and value web standards and ESM.

**Rationale**:

1. **No build required** - Works directly from CDN
2. **True separation** - Frontend is purely a consumer of the API
3. **Web standards** - Custom Elements are native browser features
4. **Shoelace** - Shadcn-quality components for Web Components
5. **Aligns with `liturgy-components-js`** - Already have JS component library
6. **Future-proof** - Platform standards don't break

**Stack**:

```text
Lit 3.x (ESM via CDN)
├── Shoelace (Web Components UI library)
├── Tailwind CSS (Play CDN for dev, CLI for prod)
├── JSDoc (type annotations)
├── Native ES Modules
└── No required build step
```

**Considerations**:

- Form handling requires more manual work
- Validation logic duplicated between frontend and API
- Less integrated than Laravel

---

### Recommendation

**For your situation, I lean toward Laravel + Livewire** because:

1. Your API is already PHP - staying in PHP reduces cognitive load
2. Form-heavy application - Laravel's form handling is superior
3. Validation - Can mirror API validation rules easily
4. Your existing PHP expertise transfers directly
5. Livewire provides the "no heavy JavaScript" experience you want

However, **Lit + Shoelace is excellent** if:

- You want maximum separation between frontend and API
- You prefer web standards over framework abstractions
- You want to continue building on `liturgy-components-js`

### Evaluation Strategy: Build Proof-of-Concepts

Rather than committing to one framework, we will build small proof-of-concept implementations
in the top candidate frameworks to evaluate them against real requirements.

**Frameworks to Evaluate**:

1. **Laravel + Livewire** (PHP-first)
2. **Next.js + React** (JavaScript, most popular)
3. **Nuxt.js + Vue** (JavaScript, developer-friendly)

**Evaluation Criteria**:

| Criterion            | Weight | Description                              |
|----------------------|--------|------------------------------------------|
| i18n Support         | 25%    | Weblate integration, ICU language support|
| Developer Familiarity| 20%    | Likelihood of attracting contributors    |
| Form Handling        | 20%    | Complex form support, validation         |
| Schema Integration   | 15%    | Coupling with API JSON schemas           |
| Maintainability      | 10%    | Code organization, testing               |
| Build Complexity     | 10%    | Development and deployment simplicity    |

**PoC Scope**: Each proof-of-concept should implement:

1. Diocesan calendar editor (form-heavy)
2. i18n with at least 3 languages (en, it, la)
3. JWT authentication flow
4. API integration with type safety

---

## Internationalization (i18n) Deep Dive

i18n is a critical requirement. The application must support:

- All ICU locales (including Latin: `la`, `la_VA`)
- Weblate integration for community translations
- Either gettext (`.po`/`.mo`) or i18next JSON format

### Weblate-Compatible Formats

| Format                | Weblate Support | Frameworks                   |
|-----------------------|-----------------|------------------------------|
| gettext (`.po`/`.mo`) | Excellent       | Laravel, PHP, Python         |
| i18next JSON          | Excellent       | Next.js, Nuxt.js, React, Vue |
| JSON (nested)         | Good            | Most JS frameworks           |
| YAML                  | Good            | Rails, some JS frameworks    |
| XLIFF                 | Excellent       | Symfony, enterprise          |

### i18n by Framework

#### Laravel + Livewire

**Native Support**: PHP arrays or JSON files

**Weblate Integration**:

- Use `laravel-gettext` package for `.po`/`.mo` files
- Or use Laravel's JSON translation files (Weblate supports these)

**ICU Support**: Via `php-intl` extension (already required by API)

**Setup**:

```php
// Using gettext (recommended for Weblate)
composer require xinax/laravel-gettext

// resources/lang/en_US/LC_MESSAGES/messages.po
msgid "Save Calendar"
msgstr "Save Calendar"

// In Blade templates
{{ _('Save Calendar') }}
```

**Pros**:

- Same gettext format as current API
- Excellent Weblate integration
- ICU MessageFormat via `php-intl`

**Cons**:

- gettext package needs configuration
- Slightly more setup than JSON

---

#### Next.js + React

**Recommended Library**: `next-intl` (better than `next-i18next` for App Router)

**Weblate Integration**: JSON files, excellent support

**ICU Support**: Full ICU MessageFormat support via `intl-messageformat`

**Setup**:

```typescript
// messages/en.json
{
    "calendar": {
        "save": "Save Calendar",
        "events": "{count, plural, =0 {No events} one {# event} other {# events}}"
    }
}

// messages/la.json (Latin)
{
    "calendar": {
        "save": "Calendarium Serva",
        "events": "{count, plural, =0 {Nulla eventa} one {# eventum} other {# eventa}}"
    }
}
```

```typescript
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
    children,
    params: { locale }
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const messages = await getMessages();
    return (
        <NextIntlClientProvider messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}
```

```typescript
// Component usage
import { useTranslations } from 'next-intl';

export function CalendarEditor() {
    const t = useTranslations('calendar');
    return <button>{t('save')}</button>;
}
```

**Pros**:

- Excellent ICU MessageFormat support
- JSON format works great with Weblate
- Type-safe translations possible
- SSR/SSG support for SEO

**Cons**:

- Requires TypeScript/build step
- More complex than gettext

---

#### Nuxt.js + Vue

**Recommended Library**: `@nuxtjs/i18n` (built on `vue-i18n`)

**Weblate Integration**: JSON files, excellent support

**ICU Support**: Full ICU MessageFormat via `@formatjs/intl`

**Setup**:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ['@nuxtjs/i18n'],
    i18n: {
        locales: [
            { code: 'en', iso: 'en-US', file: 'en.json' },
            { code: 'it', iso: 'it-IT', file: 'it.json' },
            { code: 'la', iso: 'la-VA', file: 'la.json' },
        ],
        defaultLocale: 'en',
        lazy: true,
        langDir: 'locales/',
    }
});
```

```json
// locales/en.json
{
    "calendar": {
        "save": "Save Calendar",
        "delete_confirm": "Are you sure you want to delete {name}?"
    }
}
```

```vue
<!-- Component usage -->
<template>
    <button>{{ $t('calendar.save') }}</button>
    <p>{{ $t('calendar.delete_confirm', { name: dioceseName }) }}</p>
</template>

<script setup>
const { t } = useI18n();
</script>
```

**Pros**:

- Very developer-friendly API
- JSON format works great with Weblate
- Excellent Vue integration
- Auto-imports, less boilerplate

**Cons**:

- Requires build step
- Vue ecosystem smaller than React

---

### Latin Language Support

Latin (`la`, `la_VA`) is not a standard ICU locale but is critical for this application.

**Handling Latin**:

1. **Custom locale definition**: All frameworks allow defining custom locales
2. **Fallback chain**: `la_VA` → `la` → `en` (or another fallback)
3. **No CLDR data**: Latin has no CLDR pluralization rules, so use simple fallbacks

```typescript
// next-intl: Custom locale config
// next.config.js
const withNextIntl = createNextIntlPlugin();

module.exports = withNextIntl({
    i18n: {
        locales: ['en', 'it', 'la'],
        defaultLocale: 'en',
    }
});
```

```php
// Laravel: Custom locale
// config/app.php
'locale' => 'en',
'fallback_locale' => 'en',
'supported_locales' => ['en', 'it', 'la', 'la_VA'],
```

---

### i18n Comparison Matrix

| Feature           | Laravel + gettext | Next.js + next-intl | Nuxt.js + @nuxtjs/i18n |
|-------------------|-------------------|---------------------|------------------------|
| Weblate Format    | `.po`/`.mo`       | JSON                | JSON                   |
| ICU MessageFormat | Via php-intl      | Full support        | Full support           |
| Pluralization     | gettext native    | ICU plural rules    | ICU plural rules       |
| Latin Support     | Custom locale     | Custom locale       | Custom locale          |
| SSR Support       | Native (PHP)      | Full SSR            | Full SSR               |
| Type Safety       | No                | Yes (with setup)    | Yes (with setup)       |
| Lazy Loading      | Manual            | Built-in            | Built-in               |

**Recommendation**: All three frameworks handle i18n well. Laravel uses gettext (same as current API),
while Next.js and Nuxt.js use JSON (equally well supported by Weblate).

---

## Schema Integration & Type Safety

Tight coupling between frontend and API schemas prevents mismatches like the serialization bug discovered.

### Type Generation from OpenAPI

The API has an OpenAPI schema at `jsondata/schemas/openapi.json`. We can generate types from it:

**For TypeScript Frameworks (Next.js, Nuxt.js)**:

```bash
# Generate TypeScript types from OpenAPI
npx openapi-typescript ../LiturgicalCalendarAPI/jsondata/schemas/openapi.json -o src/types/api.d.ts
```

This generates types like:

```typescript
export interface components {
    schemas: {
        DiocesanCalendar: {
            litcal: components['schemas']['DiocesanLitCalItem'][];
            metadata: components['schemas']['DiocesanMetadata'];
            settings?: components['schemas']['DiocesanSettings'];
        };
        // ... all other schemas
    };
}
```

**For Laravel**:

```bash
# Generate PHP DTOs from OpenAPI
composer require crescat-io/saloon-sdk-generator
# Or manually create DTOs that mirror the API schemas
```

### Runtime Validation

Beyond static types, runtime validation ensures data integrity:

**Next.js/Nuxt.js with Zod**:

```typescript
import { z } from 'zod';

// Mirror the JSON schema
export const diocesanLitCalItemSchema = z.object({
    liturgical_event: z.object({
        event_key: z.string().min(1),
        color: z.array(z.string()),
        grade: z.number().int().min(0).max(7),
        common: z.array(z.string()),
        day: z.number().int().min(1).max(31),
        month: z.number().int().min(1).max(12),
    }),
    metadata: z.object({
        since_year: z.number().int(),
        until_year: z.number().int().optional(),
    }),
});

export const diocesanCalendarSchema = z.object({
    litcal: z.array(diocesanLitCalItemSchema),
    metadata: diocesanMetadataSchema,
    settings: diocesanSettingsSchema.optional(),
});

// Validate before sending to API
const result = diocesanCalendarSchema.safeParse(formData);
if (!result.success) {
    // Handle validation errors
    console.error(result.error.issues);
}
```

**Laravel with Form Requests**:

```php
// app/Http/Requests/StoreDiocesanCalendarRequest.php
class StoreDiocesanCalendarRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'litcal' => ['required', 'array', 'min:1'],
            'litcal.*.liturgical_event.event_key' => ['required', 'string'],
            'litcal.*.liturgical_event.day' => ['required', 'integer', 'min:1', 'max:31'],
            'litcal.*.liturgical_event.month' => ['required', 'integer', 'min:1', 'max:12'],
            'litcal.*.liturgical_event.grade' => ['required', 'integer', 'min:0', 'max:7'],
            'litcal.*.liturgical_event.color' => ['required', 'array'],
            'litcal.*.liturgical_event.color.*' => ['string', Rule::in(['white', 'red', 'green', 'violet', 'rose', 'black'])],
            'litcal.*.metadata.since_year' => ['required', 'integer'],
            'litcal.*.metadata.until_year' => ['nullable', 'integer', 'gt:litcal.*.metadata.since_year'],
            'metadata.diocese_id' => ['required', 'string'],
            'metadata.diocese_name' => ['required', 'string'],
            'metadata.nation' => ['required', 'string', 'size:2'],
            'metadata.locales' => ['required', 'array', 'min:1'],
            'metadata.timezone' => ['required', 'string', 'timezone'],
        ];
    }
}
```

---

## Developer Familiarity & Community

To attract contributors, framework popularity matters:

| Framework        | GitHub Stars    | NPM Downloads/week | Stack Overflow Questions |
|------------------|-----------------|--------------------| -------------------------|
| React/Next.js    | 120k+ / 120k+   | 25M+               | 450k+                    |
| Vue/Nuxt.js      | 46k+ / 52k+     | 5M+                | 100k+                    |
| Laravel          | 77k+            | N/A (PHP)          | 180k+                    |
| Svelte/SvelteKit | 77k+ / 17k+     | 800k+              | 15k+                     |

**Analysis**:

- **Next.js (React)**: Largest pool of developers, easiest to find contributors
- **Laravel**: Very popular in PHP community, good overlap with API developers
- **Nuxt.js (Vue)**: Smaller but dedicated community, excellent DX

---

## Styling Options

### Tailwind CSS

**Development (No Build)**:

Use the Tailwind Play CDN for development - no build step required:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    liturgical: {
                        white: '#ffffff',
                        red: '#ff0000',
                        green: '#00ff00',
                        violet: '#800080',
                        rose: '#ff007f',
                        black: '#000000',
                    }
                }
            }
        }
    }
</script>
```

**Production (Optional Build)**:

For production, you can optionally run Tailwind CLI to generate optimized CSS:

```bash
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
```

This is a one-time build, not a continuous compilation requirement.

### Component Libraries for Web Components

| Library                     | Description                          | Build Required     |
|-----------------------------|--------------------------------------|--------------------|
| **Shoelace**                | Full UI library, Shadcn-like quality | No (CDN available) |
| **Spectrum Web Components** | Adobe's design system                | No (CDN available) |
| **Lion Web Components**     | ING Bank's accessible components     | No                 |
| **Vaadin Components**       | Enterprise-grade components          | No (CDN available) |

### Shadcn UI Note

Shadcn UI is React-specific and requires a build step. However, **Shoelace** provides a similar
developer experience for Web Components:

- Copy/paste component patterns
- Fully customizable
- Accessible by default
- Beautiful defaults

```html
<!-- Shoelace via CDN - no build required -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2/cdn/themes/light.css" />
<script type="module" src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2/cdn/shoelace-autoloader.js"></script>

<!-- Use components -->
<sl-button variant="primary">Save Calendar</sl-button>
<sl-select label="Select Diocese">
    <sl-option value="boston">Boston</sl-option>
    <sl-option value="rome">Rome</sl-option>
</sl-select>
```

---

## Migration Strategy

### Phase 1: Foundation (Weeks 1-2)

1. **Set up new project** alongside existing frontend
2. **Configure TypeScript** with strict mode
3. **Generate types** from API OpenAPI schema
4. **Set up authentication** module (JWT handling)
5. **Configure i18n** with existing translations
6. **Set up CI/CD** pipeline

### Phase 2: Core Components (Weeks 3-4)

1. **Create shared UI components** (buttons, inputs, cards, modals)
2. **Implement API client** with typed responses
3. **Create form components** with validation
4. **Port authentication UI** (login modal, session management)

### Phase 3: Feature Migration (Weeks 5-8)

Migrate features in order of complexity:

1. **Public calendar view** (read-only, good starting point)
2. **Calendar selection** (CalendarSelect component exists in `liturgy-components-js`)
3. **Diocesan calendar editor** (`extending.php?choice=diocesan`)
4. **National calendar editor** (`extending.php?choice=national`)
5. **Wider region editor** (`extending.php?choice=widerRegion`)
6. **Admin/Missals editor** (`admin.php`)

### Phase 4: Polish & Cutover (Weeks 9-10)

1. **Testing** - Unit, integration, E2E tests
2. **Performance optimization** - Bundle analysis, lazy loading
3. **Accessibility audit** - WCAG compliance
4. **Documentation** - Developer and user documentation
5. **Cutover** - DNS switch, redirect old URLs

---

## Type Generation Strategy

### From OpenAPI Schema

Use the existing `openapi.json` to generate TypeScript types:

```bash
# Using openapi-typescript
npx openapi-typescript ./openapi.json -o ./src/types/api.ts
```

This generates types like:

```typescript
export interface DiocesanCalendar {
    litcal: DiocesanLitCalItem[];
    metadata: DiocesanMetadata;
    settings?: DiocesanSettings;
    i18n?: Record<string, Record<string, string>>;
}
```

### Runtime Validation with Zod

Create Zod schemas that mirror JSON schemas for runtime validation:

```typescript
import { z } from 'zod';

export const diocesanLitCalItemSchema = z.object({
    liturgical_event: z.object({
        event_key: z.string(),
        color: z.array(z.string()),
        grade: z.number(),
        common: z.array(z.string()),
        day: z.number().min(1).max(31),
        month: z.number().min(1).max(12),
    }),
    metadata: z.object({
        since_year: z.number(),
        until_year: z.number().optional(),
    }),
});

export const diocesanCalendarSchema = z.object({
    litcal: z.array(diocesanLitCalItemSchema),
    metadata: diocesanMetadataSchema,
    settings: diocesanSettingsSchema.optional(),
});

// Type inference from schema
export type DiocesanCalendar = z.infer<typeof diocesanCalendarSchema>;
```

---

## Integration with `liturgy-components-js`

The existing `liturgy-components-js` package can be integrated into any of the recommended frameworks:

### React/Next.js Integration

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { CalendarSelect } from 'liturgy-components-js';

export function CalendarSelectWrapper({
    locale,
    onSelect
}: {
    locale: string;
    onSelect: (calendarId: string) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<CalendarSelect | null>(null);

    useEffect(() => {
        if (containerRef.current && !selectRef.current) {
            selectRef.current = new CalendarSelect(locale)
                .id('calendar-select')
                .class('form-control')
                .appendTo(containerRef.current);

            // Listen for changes
            containerRef.current.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                onSelect(target.value);
            });
        }

        return () => {
            // Cleanup if needed
        };
    }, [locale, onSelect]);

    return <div ref={containerRef} />;
}
```

### Alternative: Rewrite Components in React/Vue/Svelte

Long-term, consider rewriting `liturgy-components-js` components as native React/Vue/Svelte components
for better integration and type safety.

---

## Decision Matrix

### Final Comparison (Top 3 Candidates for PoC)

| Criterion              | Weight | Laravel + Livewire | Next.js (React)     | Nuxt.js (Vue)   |
|------------------------|--------|--------------------| --------------------|-----------------|
| i18n / Weblate Support | 25%    | 9 (gettext)        | 10 (JSON)           | 10 (JSON)       |
| Developer Familiarity  | 20%    | 8 (PHP devs)       | 10 (largest)        | 7               |
| Form Handling          | 20%    | 10                 | 9 (React Hook Form) | 9 (VeeValidate) |
| Schema Integration     | 15%    | 8 (manual DTOs)    | 10 (openapi-ts)     | 10 (openapi-ts) |
| Maintainability        | 10%    | 9                  | 9                   | 9               |
| Build Complexity       | 10%    | 8 (optional Vite)  | 6 (required)        | 6 (required)    |
| **Weighted Score**     | 100%   | **8.9**            | **9.3**             | **8.8**         |

### Analysis

**Laravel + Livewire**:

- ✅ Same language as API (PHP) - no context switching
- ✅ Excellent form handling with built-in validation
- ✅ Uses gettext (same format as current API i18n)
- ✅ Popular in PHP community
- ⚠️ Requires learning Livewire patterns
- ⚠️ Two PHP applications to maintain

**Next.js (React)**:

- ✅ Largest developer community - best for attracting contributors
- ✅ Excellent i18n with next-intl (JSON format, Weblate compatible)
- ✅ Best schema integration via openapi-typescript
- ✅ React Hook Form + Zod for type-safe forms
- ⚠️ Requires TypeScript/build step
- ⚠️ Different language from API

**Nuxt.js (Vue)**:

- ✅ Excellent DX - auto-imports, less boilerplate
- ✅ Great i18n with @nuxtjs/i18n
- ✅ Vue's template syntax is approachable
- ✅ Good middle ground between Laravel and React
- ⚠️ Smaller community than React
- ⚠️ Requires build step

### Recommendation: Build All Three PoCs

Given no time pressure and the importance of this decision, **build proof-of-concepts in all three frameworks**:

1. **Laravel + Livewire** - Evaluate PHP-first approach
2. **Next.js + React** - Evaluate largest ecosystem
3. **Nuxt.js + Vue** - Evaluate best DX

Each PoC should implement the same feature set (see Evaluation Strategy above) to enable
fair comparison.

**Likely Winner**: Next.js edges ahead on paper due to:

- Largest contributor pool
- Best TypeScript/schema integration
- Excellent i18n support

But the PoC process will reveal practical considerations that scores can't capture.

---

## Resolved Questions

Based on your input:

| Question              | Answer                                             |
|-----------------------|----------------------------------------------------|
| Team Experience       | Some React experience                              |
| External Contributors | None currently                                     |
| Timeline              | No pressure, take time needed                      |
| Styling Preference    | Tailwind CSS (more customizable)                   |
| Component Library     | Shadcn-like → Shoelace (Web Components equivalent) |
| Deployment Target     | Self-hosted (staging + production servers)         |
| Build Preference      | **ESM-native, no compilation preferred**           |
| Type System           | **JSDoc over TypeScript**                          |

---

## Unified Administration Interface

This section outlines the roadmap for consolidating administrative features into a unified, login-protected interface.

### Current State Analysis

The frontend currently has **multiple separate administrative interfaces** spread across two repositories:

**LiturgicalCalendarFrontend:**

| Page            | Purpose                                      | Auth Method        | Status      |
|-----------------|----------------------------------------------|--------------------|-------------|
| `extending.php` | Create/edit national, diocesan, wider region | JWT (modern)       | Active      |
| `admin.php`     | Edit missals, decrees JSON files             | HTTP Basic (legacy)| Limited use |
| `decrees.php`   | View decrees from API                        | None (read-only)   | Read-only   |

**UnitTestInterface (separate repository):**

| Page            | Purpose                                      | Auth Method        | Status      |
|-----------------|----------------------------------------------|--------------------|-------------|
| `index.php`     | Run unit tests via WebSocket, view results   | HTTP Basic (legacy)| Active      |
| `admin.php`     | Create/edit unit test definitions            | HTTP Basic (legacy)| Active      |
| `resources.php` | Validate source data against JSON schemas    | HTTP Basic (legacy)| Active      |

**Current Problems:**

1. **Fragmented Navigation** - Users must know specific URLs to access admin features
2. **Inconsistent Authentication** - `admin.php` uses HTTP Basic while `extending.php` uses JWT
3. **Limited Decrees Management** - `decrees.php` is read-only, no CRUD operations
4. **No Unified Dashboard** - No single entry point for administrative tasks
5. **Duplicate UI Code** - Similar modals and forms across pages
6. **Separate Repository** - UnitTestInterface is a separate codebase requiring separate deployment
7. **Duplicate Dependencies** - Both repos use `liturgical-calendar/components` PHP library

### Goals

1. **Unified Entry Point** - Single `/admin` or `/dashboard` route for all administrative functions
2. **Consistent JWT Authentication** - All admin features behind login
3. **Role-Based Access** - Future support for different permission levels
4. **Modern UI/UX** - Sidebar navigation, breadcrumbs, consistent styling
5. **Full CRUD for All Data Types** - Including decrees (when API supports it)

### Proposed Architecture

#### Option A: SPA-Style Admin (Recommended for Modern Stack)

If adopting a modern framework (see platform options above), build a dedicated admin SPA:

```text
/admin                    → Admin Dashboard (login required)
├── /admin/calendars      → Calendar Management Hub
│   ├── /national         → National Calendar CRUD
│   ├── /diocesan         → Diocesan Calendar CRUD
│   └── /wider-region     → Wider Region Calendar CRUD
├── /admin/missals        → Roman Missal Data Editor
├── /admin/decrees        → Decree Management (view now, edit when API ready)
└── /admin/settings       → User settings, API configuration
```

#### Option B: Enhanced PHP with Admin Layout (Incremental Improvement)

Keep the current PHP stack but consolidate with a shared admin layout:

```text
/admin.php                → Admin Dashboard (redirect if not logged in)
/admin.php?section=calendars&type=national
/admin.php?section=calendars&type=diocesan
/admin.php?section=calendars&type=widerRegion
/admin.php?section=missals
/admin.php?section=decrees
```

**Shared Admin Layout:**

```php
<!-- layout/admin-layout.php -->
<div class="admin-container">
    <aside class="admin-sidebar">
        <nav class="admin-nav">
            <a href="?section=dashboard" class="nav-link">Dashboard</a>
            <a href="?section=calendars" class="nav-link">Calendars</a>
            <a href="?section=missals" class="nav-link">Missals</a>
            <a href="?section=decrees" class="nav-link">Decrees</a>
        </nav>
    </aside>
    <main class="admin-content">
        <?php include $contentTemplate; ?>
    </main>
</div>
```

### Implementation Phases

#### Phase 1: Authentication Consolidation

**Goal:** Migrate all admin pages to JWT authentication

**Tasks:**

1. Remove HTTP Basic authentication from `admin.php`
2. Add JWT authentication check to all admin pages
3. Redirect unauthenticated users to login modal or login page
4. Add `data-requires-auth` attributes to all admin UI elements

**Code Changes:**

```php
// Unified auth check for all admin pages (replace HTTP Basic in admin.php)
<?php
include_once 'includes/common.php';

// Check for JWT cookie presence (quick gate)
// Note: This only checks cookie existence. Full JWT validation (signature
// verification, expiry, claims) is handled by the API middleware when the
// frontend makes authenticated requests. The frontend should not attempt
// to validate JWTs directly - it delegates all token validation to the API.
if (!isset($_COOKIE['litcal_access_token'])) {
    // For API requests, return 401
    if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    // For page requests, show login UI (handled client-side)
}
?>
```

**Estimated Effort:** 1-2 days

---

#### Phase 2: Admin Dashboard

**Goal:** Create unified entry point with navigation

**Tasks:**

1. Create `/admin` route (either `admin/index.php` or enhanced `admin.php`)
2. Implement sidebar navigation component
3. Add quick stats dashboard (calendar counts, recent changes)
4. Implement breadcrumb navigation

**Dashboard Components:**

```php
<!-- admin/dashboard.php -->
<div class="row">
    <div class="col-md-4">
        <div class="card">
            <div class="card-body">
                <h5>National Calendars</h5>
                <p class="display-4"><?= count($nationalCalendars) ?></p>
                <a href="?section=calendars&type=national">Manage →</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card">
            <div class="card-body">
                <h5>Diocesan Calendars</h5>
                <p class="display-4"><?= count($diocesanCalendars) ?></p>
                <a href="?section=calendars&type=diocesan">Manage →</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card">
            <div class="card-body">
                <h5>Decrees</h5>
                <p class="display-4"><?= count($decrees) ?></p>
                <a href="?section=decrees">View →</a>
            </div>
        </div>
    </div>
</div>
```

**Estimated Effort:** 3-5 days

---

#### Phase 3: Calendar Management Consolidation

**Goal:** Merge `extending.php` functionality into admin interface

**Tasks:**

1. Refactor `extending.php` forms into modular PHP includes
2. Create calendar type selector (national/diocesan/wider region)
3. Implement tabbed interface or wizard for calendar creation
4. Consolidate JavaScript into admin-specific module

**Current extending.php Structure:**

```text
extending.php (monolithic)
├── Wider Region Form (carousel slide 1)
├── National Calendar Form (carousel slide 2)
└── Diocesan Calendar Form (carousel slide 3)
```

**Proposed Modular Structure:**

```text
admin/
├── calendars/
│   ├── index.php          (calendar type selector)
│   ├── national.php       (extracted from extending.php)
│   ├── diocesan.php       (extracted from extending.php)
│   └── wider-region.php   (extracted from extending.php)
├── includes/
│   ├── calendar-form-controls.php
│   └── calendar-modals.php
└── assets/js/
    └── admin-calendars.js  (refactored from extending.js)
```

**Estimated Effort:** 1-2 weeks

---

#### Phase 4: Missals Management Modernization

**Goal:** Modernize `admin.php` missal editor

**Tasks:**

1. Move missal editing into admin interface
2. Replace HTTP Basic auth with JWT
3. Improve table editing UX (inline editing, validation)
4. Add missal-specific actions (add row, delete row, reorder)

**Estimated Effort:** 3-5 days

---

#### Phase 5: Decrees Management

**Goal:** Enable full CRUD for decrees (pending API support)

**Current State:**

- `decrees.php` is read-only
- API `/decrees` endpoint returns decree data
- No PUT/PATCH/DELETE support in API yet

**Tasks:**

1. Design decree editor UI (similar to calendar editor)
2. Add "Add Decree" form modal
3. Add "Edit Decree" inline or modal editing
4. Implement when API supports write operations

**Decree Editor UI:**

```html
<!-- Proposed decree card with edit capability -->
<div class="card mb-3" id="decree-123">
    <div class="card-header d-flex justify-content-between">
        <h5>Prot. N. 123/20/L</h5>
        <div class="btn-group" data-requires-auth>
            <button class="btn btn-sm btn-outline-primary edit-decree">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-decree">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </div>
    <!-- ... existing card body ... -->
</div>
```

**Estimated Effort:** 1 week (UI), dependent on API

---

#### Phase 6: Settings & User Management

**Goal:** Add admin settings and user management

**Tasks:**

1. Create settings page for API configuration
2. Add user profile/password change (if supported by API)
3. Implement audit log viewer (if API provides)
4. Add locale/language preferences

**Estimated Effort:** 3-5 days

---

#### Phase 7: Tests Management (UnitTestInterface Integration)

**Goal:** Integrate the UnitTestInterface repository functionality into the unified admin dashboard

**Current State:**

The [UnitTestInterface](https://github.com/Liturgical-Calendar/UnitTestInterface) is a separate repository that provides:

- **Test Runner** (`index.php`) - WebSocket-based test execution with real-time results
- **Test Editor** (`admin.php`) - UI for creating/editing unit test definitions
- **Resource Validation** (`resources.php`) - Source data validation against JSON schemas
- HTTP Basic authentication (legacy)
- Connects to API's `/tests` endpoint for test definitions
- WebSocket communication with `LitCalTestServer.php` for test execution

**Architecture:**

```text
UnitTestInterface (current)        →    Admin Dashboard (future)
├── index.php (test runner)        →    /admin/tests/runner
├── admin.php (test editor)        →    /admin/tests/editor
└── resources.php (validation)     →    /admin/tests/validation
```

**Tasks:**

1. **Migrate Test Runner UI**
   - Port WebSocket connection logic to admin dashboard
   - Create test results display component with real-time updates
   - Implement test filtering (by calendar, category, status)
   - Add progress indicators and summary statistics

2. **Migrate Test Editor**
   - Port `AssertionsBuilder.js` for test assertion creation
   - Create test definition form (event selection, assertion types)
   - Implement CRUD operations via API `/tests` endpoint
   - Add test preview/dry-run capability

3. **Migrate Source Validation**
   - Port schema validation UI
   - Add validation for all source data types:
     - Calendar definitions (national, diocesan, wider region)
     - Roman Missal data (Proprium de Sanctis)
     - Decree data
   - Display validation results with error details

4. **Authentication Migration**
   - Replace HTTP Basic auth with JWT
   - Use shared auth module from admin dashboard

**Test Editor UI Components:**

```html
<!-- Test Definition Form -->
<div class="card">
    <div class="card-header">
        <h5>Define Unit Test</h5>
    </div>
    <div class="card-body">
        <div class="row">
            <div class="col-md-4">
                <label>Calendar</label>
                <select id="testCalendar" class="form-select">
                    <!-- CalendarSelect component -->
                </select>
            </div>
            <div class="col-md-4">
                <label>Liturgical Event</label>
                <select id="testEvent" class="form-select">
                    <!-- Event list from API -->
                </select>
            </div>
            <div class="col-md-4">
                <label>Test Type</label>
                <select id="testType" class="form-select">
                    <option value="exactCorrespondence">Exact Date Match</option>
                    <option value="eventExists">Event Exists</option>
                    <option value="eventNotExists">Event Not Exists</option>
                </select>
            </div>
        </div>
        <!-- Assertions builder -->
        <div id="assertionsContainer" class="mt-3">
            <!-- Dynamic assertion rows -->
        </div>
    </div>
</div>
```

**Test Runner UI:**

```html
<!-- Real-time Test Results -->
<div class="test-results">
    <div class="progress mb-3">
        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
    </div>
    <div class="row">
        <div class="col-md-3">
            <div class="stat-card bg-success text-white">
                <h3 id="passedCount">0</h3>
                <p>Passed</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card bg-danger text-white">
                <h3 id="failedCount">0</h3>
                <p>Failed</p>
            </div>
        </div>
        <!-- ... -->
    </div>
    <div id="testResultsContainer">
        <!-- WebSocket-populated test result cards -->
    </div>
</div>
```

**WebSocket Integration:**

```javascript
// Test runner WebSocket connection
class TestRunner {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.ws.onmessage = this.handleResult.bind(this);
    }

    runTest(testDefinition) {
        this.ws.send(JSON.stringify({
            action: 'executeUnitTest',
            ...testDefinition
        }));
    }

    handleResult(event) {
        const result = JSON.parse(event.data);
        this.updateUI(result);
    }
}
```

**Estimated Effort:** 2-3 weeks

**Benefits of Integration:**

- Single authentication system (JWT)
- Unified navigation and UI consistency
- Shared components (CalendarSelect, event lists)
- Centralized codebase maintenance
- Better developer experience

---

### UI/UX Design Considerations

#### Sidebar Navigation

```text
┌─────────────────────────────────────────────────────────────┐
│ ☰ LitCal Admin                              [User ▼] [Exit] │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ Dashboard    │  Welcome, Admin                              │
│              │                                              │
│ ▼ Calendars  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   National   │  │ National │ │ Diocesan │ │  Wider   │     │
│   Diocesan   │  │    12    │ │    45    │ │ Region 3 │     │
│   Wider Rgn  │  └──────────┘ └──────────┘ └──────────┘     │
│              │                                              │
│ Missals      │  Recent Activity                            │
│              │  • USA calendar updated (2 hours ago)       │
│ Decrees      │  • Boston diocese added (yesterday)         │
│              │  • Decree 123/20/L added (3 days ago)       │
│ ▼ Tests      │                                              │
│   Runner     │  Test Status                                │
│   Editor     │  ┌──────────┐ ┌──────────┐                  │
│   Validation │  │ ✓ 156    │ │ ✗ 3     │                  │
│              │  │ Passed   │ │ Failed   │                  │
│ ─────────────│  └──────────┘ └──────────┘                  │
│ Settings     │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

#### Responsive Design

- Sidebar collapses to hamburger menu on mobile
- Forms adapt to single-column on small screens
- Tables become card-based on mobile

#### Accessibility

- All interactive elements keyboard-accessible
- ARIA labels for screen readers
- Sufficient color contrast
- Focus indicators

### Security Requirements

1. **Authentication Required** - All admin routes require valid JWT
2. **HTTPS Only** - Admin interface must use HTTPS in production
3. **Session Timeout** - Auto-logout after inactivity (configurable)
4. **CSRF Protection** - SameSite cookies (already implemented)
5. **Audit Logging** - Log all write operations (future)

### Migration Strategy

#### Phased Rollout

1. **Deploy Phase 1-2** - Auth consolidation + dashboard alongside existing pages
2. **Redirect Legacy URLs** - Add deprecation notices to old pages
3. **Deploy Phase 3-4** - Calendar and missal management
4. **Deploy Phase 5-6** - Decrees and settings
5. **Deploy Phase 7** - Tests management (UnitTestInterface integration)
6. **Remove Legacy Pages** - After sufficient testing period
7. **Archive UnitTestInterface** - Mark repository as deprecated/archived

#### Backward Compatibility

- Keep existing URL routes working during transition
- Show deprecation warnings on old pages
- Provide documentation for new admin interface
- Redirect UnitTestInterface URLs to new admin routes

### Success Metrics

| Metric                           | Target                         |
|----------------------------------|--------------------------------|
| Single entry point for all admin | ✓ Unified `/admin` route       |
| Consistent authentication        | ✓ JWT only, no HTTP Basic      |
| Mobile-responsive admin UI       | ✓ All features work on mobile  |
| Time to complete common tasks    | < current time                 |
| User satisfaction                | Positive feedback              |

### Dependencies

- **API Decree CRUD** - Phase 5 blocked until API supports write operations
- **Role-Based Access** - Phase 6 user management depends on API RBAC
- **Audit Logging** - Depends on API logging infrastructure
- **WebSocket Server** - Phase 7 requires API's `LitCalTestServer.php` WebSocket server
- **API `/tests` Endpoint** - Phase 7 depends on test CRUD operations via API

---

## Related Issues

- API serialization coordination: See `LiturgicalCalendarAPI/docs/enhancements/SERIALIZATION_ROADMAP.md`
- Backend API issue: [LiturgicalCalendarAPI#265](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/issues/265)
- Frontend alignment issue: [LiturgicalCalendarFrontend#142](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/issues/142)
