<?php

/**
 * Supported Locales
 *
 * Shows which locales the API declares officially supported, and whether each
 * candidate locale has the resources required to be promoted.
 *
 * Promotion is a governance decision about the API's published contract: it flips
 * missing data from a quiet degradation into a hard failure. So this page is
 * global-admin only, and read-only until change requests can carry the write
 * durably (API issues #904 and #902).
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

if (!$authHelper->hasRole('admin')) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $pageTitle     = _('Supported Locales');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($pageTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-3 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-language me-2"></i><?php echo htmlspecialchars(_('Supported Locales'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted">
        <?php
        $localesBlurb = _('An officially supported locale promises complete data. Missing data for one is treated as an error, '
            . 'while a locale outside the list degrades quietly. Promoting a locale therefore tightens enforcement, '
            . 'and may only be done once every check below passes.');
        echo htmlspecialchars($localesBlurb, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        ?>
    </p>

    <div id="curationNotice"></div>

    <div class="card shadow mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="fas fa-list me-2"></i><?php echo htmlspecialchars(_('Candidate locales'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
            <button type="button" id="refreshBtn" class="btn btn-sm btn-outline-secondary">
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th scope="col"><?php echo htmlspecialchars(_('Locale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Status'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Readiness'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Details'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="localesTableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal fade" id="detailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="detailModalTitle"></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body" id="detailModalBody"></div>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <script>
    document.addEventListener('DOMContentLoaded', function () {
        const ApiUrl = <?php echo json_encode($apiBaseUrl); ?>;
        const tableBody = document.getElementById('localesTableBody');
        const curationNotice = document.getElementById('curationNotice');
        const refreshBtn = document.getElementById('refreshBtn');
        const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
        const detailModalTitle = document.getElementById('detailModalTitle');
        const detailModalBody = document.getElementById('detailModalBody');

        const i18n = {
            official: <?php echo json_encode(_('Official')); ?>,
            candidate: <?php echo json_encode(_('Candidate')); ?>,
            ready: <?php echo json_encode(_('Ready')); ?>,
            notReady: <?php echo json_encode(_('Not ready')); ?>,
            view: <?php echo json_encode(_('View checks')); ?>,
            loading: <?php echo json_encode(_('Loading…')); ?>,
            loadFailed: <?php echo json_encode(_('Could not load locales: %s')); ?>,
            missing: <?php echo json_encode(_('Missing:')); ?>,
            readOnly: <?php echo json_encode(_('Curation is read-only here.')); ?>
        };

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);

        const badge = (klass, text) => `<span class="badge bg-${klass}">${escapeHtml(text)}</span>`;

        function renderRows(candidates) {
            if (!candidates.length) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-4">—</td></tr>';
                return;
            }
            tableBody.innerHTML = candidates.map((row) => `
                <tr>
                    <td><code>${escapeHtml(row.locale)}</code></td>
                    <td>${row.official ? badge('dark', i18n.official) : badge('secondary', i18n.candidate)}</td>
                    <td>${row.ready ? badge('success', i18n.ready) : badge('warning text-dark', i18n.notReady)}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-dark" data-locale="${escapeHtml(row.locale)}">
                            <i class="fas fa-clipboard-check me-1"></i>${escapeHtml(i18n.view)}
                        </button>
                    </td>
                </tr>
            `).join('');

            tableBody.querySelectorAll('button[data-locale]').forEach((btn) => {
                btn.addEventListener('click', () => showDetail(btn.dataset.locale));
            });
        }

        function renderCurationNotice(curation) {
            if (!curation || curation.writable) {
                curationNotice.innerHTML = '';
                return;
            }
            // The API explains WHY promotion is unavailable; surfacing its reason
            // verbatim avoids this page drifting from the server's own account.
            curationNotice.innerHTML = `
                <div class="alert alert-info d-flex align-items-start" role="alert">
                    <i class="fas fa-info-circle me-2 mt-1"></i>
                    <div><strong>${escapeHtml(i18n.readOnly)}</strong> ${escapeHtml(curation.reason || '')}</div>
                </div>`;
        }

        async function showDetail(locale) {
            detailModalTitle.textContent = locale;
            detailModalBody.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;
            detailModal.show();

            try {
                const response = await fetch(`${ApiUrl}/admin/locales/${encodeURIComponent(locale)}`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const report = await response.json();
                detailModalBody.innerHTML = (report.checks || []).map((check) => `
                    <div class="d-flex align-items-start mb-3">
                        <i class="fas ${check.passed ? 'fa-check-circle text-success' : 'fa-times-circle text-warning'} me-2 mt-1"></i>
                        <div>
                            <div><code>${escapeHtml(check.name)}</code></div>
                            <div class="small text-muted">${escapeHtml(check.summary)}</div>
                            ${check.missing && check.missing.length
                                ? `<div class="small mt-1">${escapeHtml(i18n.missing)} <code>${check.missing.map(escapeHtml).join('</code>, <code>')}</code></div>`
                                : ''}
                        </div>
                    </div>`).join('');
            } catch (error) {
                detailModalBody.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(error.message)}</div>`;
            }
        }

        async function load() {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-4">${escapeHtml(i18n.loading)}</td></tr>`;
            try {
                const response = await fetch(`${ApiUrl}/admin/locales`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const payload = await response.json();
                renderCurationNotice(payload.curation);
                renderRows(payload.candidates || []);
            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="4"><div class="alert alert-danger mb-0">${escapeHtml(i18n.loadFailed.replace('%s', error.message))}</div></td></tr>`;
            }
        }

        refreshBtn.addEventListener('click', load);
        load();
    });
    </script>
</body>
</html>
