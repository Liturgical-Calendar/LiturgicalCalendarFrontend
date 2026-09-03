/**
 * Per-Missal capability detection.
 *
 * A sanctorale write is authorized against the MISSAL, not against the page:
 * `OpenFgaAuthorizationMiddleware::forMissals()` maps an editio typica onto
 * `rite_calendar:{rite}/{MISSAL_ID}` and a national edition onto
 * `national_calendar:{rite}/{region}`. The composed view mixes editions by
 * construction, so a single page-level capability would either offer edits that
 * 403 or hide edits the user may in fact make.
 *
 * The relations are NOT uniform across the verbs, and the difference is the whole
 * reason this module reports three capabilities rather than one. Missals get
 * `OpenFgaAuthorizationMiddleware::DEFAULT_RELATION_MAP` verbatim, because
 * `forMissals()` passes no override:
 *
 * | Verb     | Relation | What it does here |
 * | -------- | -------- | ----------------- |
 * | `PUT`    | `admin`  | create an entry   |
 * | `PATCH`  | `editor` | edit an entry     |
 * | `DELETE` | `admin`  | remove an entry   |
 *
 * So `editor` is enough to EDIT and never enough to CREATE. The `/decrees` route
 * DOES pass an override (`['PUT' => 'editor', …]`) in `Router.php`; missals do
 * not, so decrees' behaviour must not be copied here — a create gated on `editor`
 * lets a curator fill the whole form and collect a 403 on Save.
 *
 * @module capabilities
 */

import { qualifyObjectId, RITE_CALENDAR_TYPE } from './riteScopedObjectId.js';

/** `PATCH` — editing an existing entry — requires this relation. */
export const RELATION_EDITOR = 'editor';

/** `PUT` (create) and `DELETE` both require this one. See the module docblock. */
export const RELATION_ADMIN = 'admin';

/**
 * The FGA object a write against this Missal is authorized on.
 *
 * A Missal in the rite's base region is one of that rite's typical editions and
 * belongs to the rite-level calendar tier, `rite_calendar:{rite}/{MISSAL_ID}`
 * (API #955). Anything else is a national edition, governed by the national
 * calendar it was approved for. Both ids are rite-qualified, and both
 * compositions are delegated to `qualifyObjectId()` from
 * `riteScopedObjectId.js`, which mirrors the API's validation rules and handles
 * the fact that `national_calendar` is a Roman-only object type (the Ambrosian
 * rite has no national tier) while `rite_calendar` is not.
 *
 * @param {{missal_id: string, region: string}} missal
 * @param {string} rite
 * @param {?string} baseRegion From baseRegionFor(); a single-region rite is all base.
 * @returns {{objectType: string, objectId: string}}
 */
export function missalFgaObject(missal, rite, baseRegion) {
    if (missal.region === baseRegion) {
        return {
            objectType: RITE_CALENDAR_TYPE,
            objectId: qualifyObjectId(RITE_CALENDAR_TYPE, missal.missal_id, rite)
        };
    }
    return { objectType: 'national_calendar', objectId: qualifyObjectId('national_calendar', missal.region, rite) };
}

/**
 * The self-check URL for one (object, relation) pair.
 *
 * URLSearchParams is what encodes the `/` in a rite-qualified object id; built by
 * hand it would read as a path segment and check the wrong object.
 *
 * @param {{userSub: string, objectType: string, objectId: string, relation: string}} params
 * @returns {string}
 */
export function capabilityCheckPath({ userSub, objectType, objectId, relation }) {
    const query = new URLSearchParams({
        user: userSub,
        object_type: objectType,
        object_id: objectId,
        relation
    });
    return `/admin/permissions/check?${query.toString()}`;
}

/**
 * What the user may do to each Missal in scope.
 *
 * Checks run in parallel across Missals and relations. A failed check is a
 * denial, not an exception: a network blip must not blank a page whose read half
 * succeeded, and hiding a control the user has is recoverable while offering one
 * they do not have is a 403 in their face.
 *
 * @param {object} args
 * @param {Array<{missal_id: string, region: string}>} args.missals
 * @param {string} args.rite
 * @param {?string} args.baseRegion
 * @param {string} args.userSub
 * @param {boolean} args.isGlobalAdmin
 * @param {(path: string) => Promise<boolean>} args.checkAllowed
 * @returns {Promise<Map<string, {canEdit: boolean, canCreate: boolean, canDelete: boolean}>>}
 *          `canEdit` is `PATCH`, `canCreate` is `PUT`, `canDelete` is `DELETE`.
 */
export async function detectMissalCapabilities({
    missals, rite, baseRegion, userSub, isGlobalAdmin, checkAllowed
}) {
    const capabilities = new Map();

    if (isGlobalAdmin) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: true, canCreate: true, canDelete: true });
        }
        return capabilities;
    }

    if (!userSub) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: false, canCreate: false, canDelete: false });
        }
        return capabilities;
    }

    const askOne = async (object, relation) => {
        try {
            return await checkAllowed(capabilityCheckPath({ userSub, ...object, relation })) === true;
        } catch {
            return false;
        }
    };

    // Asked on the rite-qualified object alone. This carried a
    // `general_roman_calendar` fallback through the #955 migration window, for a
    // user whose grant predated the API's tuple migration — that window is closed:
    // the legacy tuples were migrated and deleted, the API's middleware dropped
    // its own fallback (LiturgicalCalendarAPI#970), and the type itself was
    // removed from the FGA model (CatholicOS/cdcf-infra#44). A legacy ask can now
    // only ever be a second round-trip to a guaranteed negative.
    const ask = askOne;

    const settled = await Promise.all(missals.map(async (missal) => {
        const object = missalFgaObject(missal, rite, baseRegion);
        const [editor, admin] = await Promise.all([
            ask(object, RELATION_EDITOR),
            ask(object, RELATION_ADMIN)
        ]);
        // Admin implies editor, mirroring the FGA model's own relation hierarchy.
        // Create and delete are BOTH `admin` here — `editor` alone must not offer
        // either, or the API answers 403 to a fully filled form.
        return [missal.missal_id, { canEdit: editor || admin, canCreate: admin, canDelete: admin }];
    }));

    for (const [missalId, capability] of settled) {
        capabilities.set(missalId, capability);
    }
    return capabilities;
}
