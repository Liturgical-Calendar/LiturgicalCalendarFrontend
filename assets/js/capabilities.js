/**
 * Per-Missal capability detection.
 *
 * A sanctorale write is authorized against the MISSAL, not against the page:
 * `OpenFgaAuthorizationMiddleware::forMissals()` maps an editio typica onto
 * `general_roman_calendar:{MISSAL_ID}` and a national edition onto
 * `national_calendar:{rite}/{region}`. The composed view mixes editions by
 * construction, so a single page-level `canEdit` would either offer edits that
 * 403 or hide edits the user may in fact make.
 *
 * @module capabilities
 */

/** `PUT` and `PATCH` require this relation (OpenFga DEFAULT_RELATION_MAP). */
export const RELATION_EDITOR = 'editor';

/** `DELETE` requires this one. */
export const RELATION_ADMIN = 'admin';

/**
 * The FGA object a write against this Missal is authorized on.
 *
 * A Missal in the rite's base region is one of that rite's typical editions and
 * carries a fixed id on `general_roman_calendar` — bare, like `temporale` and
 * `decrees`, because Missal ids are unique across rites. Anything else is a
 * national edition, governed by the national calendar it was approved for, whose
 * id DOES need a rite qualifier because nation codes are not unique across rites.
 *
 * @param {{missal_id: string, region: string}} missal
 * @param {string} rite
 * @param {?string} baseRegion From baseRegionFor(); a single-region rite is all base.
 * @returns {{objectType: string, objectId: string}}
 */
export function missalFgaObject(missal, rite, baseRegion) {
    if (missal.region === baseRegion) {
        return { objectType: 'general_roman_calendar', objectId: missal.missal_id };
    }
    // RiteScopedObjectId::SEPARATOR is a literal '/'.
    return { objectType: 'national_calendar', objectId: `${rite}/${missal.region}` };
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
 * @returns {Promise<Map<string, {canEdit: boolean, canDelete: boolean}>>}
 */
export async function detectMissalCapabilities({
    missals, rite, baseRegion, userSub, isGlobalAdmin, checkAllowed
}) {
    const capabilities = new Map();

    if (isGlobalAdmin) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: true, canDelete: true });
        }
        return capabilities;
    }

    if (!userSub) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: false, canDelete: false });
        }
        return capabilities;
    }

    const ask = async (object, relation) => {
        try {
            return await checkAllowed(capabilityCheckPath({ userSub, ...object, relation })) === true;
        } catch {
            return false;
        }
    };

    const settled = await Promise.all(missals.map(async (missal) => {
        const object = missalFgaObject(missal, rite, baseRegion);
        const [editor, admin] = await Promise.all([
            ask(object, RELATION_EDITOR),
            ask(object, RELATION_ADMIN)
        ]);
        // Admin implies editor, mirroring the FGA model's own relation hierarchy.
        return [missal.missal_id, { canEdit: editor || admin, canDelete: admin }];
    }));

    for (const [missalId, capability] of settled) {
        capabilities.set(missalId, capability);
    }
    return capabilities;
}
