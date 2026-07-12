/**
 * Pure payload construction + client-side mirror of the API's per-action
 * sidecar matrix for decree writes. The server (DecreeWritePayloadGuard)
 * remains authoritative; this exists for fast form feedback.
 * @module DecreePayload
 */

export const DecreeAction = Object.freeze({
    CreateNew: 'createNew',
    SetPropertyGrade: 'setProperty:grade',
    SetPropertyName: 'setProperty:name',
    MakeDoctor: 'makeDoctor',
});

const splitAction = (action) => {
    const [name, property] = action.split(':');
    return property ? { action: name, property } : { action: name };
};

/**
 * Deterministic decree_id suffix per action. The decree_id is never
 * hand-entered: it is derived as `{event_key}_{suffix}`, matching the
 * schema regex `^[A-Z][A-Za-z]+_(Upgrade|Create|NameChange|Doctor)$`.
 * A grade change is always `_Upgrade` (no downgrades exist yet).
 *
 * @type {Readonly<Record<string, string>>}
 */
const ACTION_SUFFIX = Object.freeze({
    [DecreeAction.CreateNew]:        'Create',
    [DecreeAction.MakeDoctor]:       'Doctor',
    [DecreeAction.SetPropertyName]:  'NameChange',
    [DecreeAction.SetPropertyGrade]: 'Upgrade',
});

/**
 * Derive the deterministic decree_id from an event_key and the compound
 * action value. Returns '' when either input is missing/unknown so callers
 * can render a placeholder without special-casing.
 *
 * @param {string} eventKey  PascalCase event key (e.g. 'StMotherTeresa')
 * @param {string} action    Compound action (e.g. 'createNew', 'setProperty:grade')
 * @returns {string}         e.g. 'StMotherTeresa_Create', or '' if underivable
 */
export const deriveDecreeId = (eventKey, action) => {
    const suffix = ACTION_SUFFIX[action];
    if (!eventKey || !suffix) return '';
    return `${eventKey}_${suffix}`;
};

/**
 * Parse a strtotime value: if it is a JSON string representing an object,
 * return the parsed object; otherwise return the original value unchanged.
 *
 * @param {unknown} value  Raw strtotime value from the form field
 * @returns {unknown}
 */
function parseStrtotime(value) {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed !== null && typeof parsed === 'object') {
                return parsed;
            }
        } catch {
            // not JSON — keep as string
        }
    }
    return value;
}

/**
 * Build the liturgical_event shape for the createNew action.
 * Includes date positioning (fixed day/month or mobile strtotime),
 * grade, color, and common.
 *
 * @param {object} form  Form values bag from collectFormValues()
 * @returns {object}
 */
function buildCreateNewEvent(form) {
    const strtotimeValue = parseStrtotime(form.strtotime);
    return {
        event_key: form.event_key,
        calendar: 'GENERAL ROMAN',
        ...(form.event_type === 'mobile'
            ? { strtotime: strtotimeValue, type: 'mobile' }
            : { day: Number(form.day), month: Number(form.month), type: 'fixed' }),
        ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
        ...(form.color && form.color.length > 0 ? { color: form.color } : {}),
        ...(form.common && form.common.length > 0 ? { common: form.common } : {}),
    };
}

/**
 * Build the per-action liturgical_event shape.
 *
 * @param {object} form        Form values bag from collectFormValues()
 * @param {string} fullAction  Full action string (e.g. 'createNew', 'setProperty:grade')
 * @returns {object}
 */
function buildLiturgicalEvent(form, fullAction) {
    if (fullAction === DecreeAction.CreateNew) {
        return buildCreateNewEvent(form);
    }

    if (fullAction === DecreeAction.SetPropertyGrade) {
        // setProperty:grade: ONLY event_key, calendar, grade
        return {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
            ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
        };
    }

    if (fullAction === DecreeAction.SetPropertyName) {
        // setProperty:name: ONLY event_key, calendar
        return {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
        };
    }

    if (fullAction === DecreeAction.MakeDoctor) {
        // makeDoctor: ONLY event_key, calendar, common
        return {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
            ...(form.common && form.common.length > 0 ? { common: form.common } : {}),
        };
    }

    // Fallback for unknown actions
    return {
        event_key: form.event_key,
        calendar: 'GENERAL ROMAN',
    };
}

/**
 * Build the metadata block for the payload.
 *
 * @param {object} form      Form values bag from collectFormValues()
 * @param {string} action    Short action name (e.g. 'createNew', 'setProperty')
 * @param {string} [property] Optional property (e.g. 'grade', 'name')
 * @returns {object}
 */
function buildMetadata(form, action, property) {
    const hasLangMap = form.url_lang_map && Object.keys(form.url_lang_map).length > 0;
    return {
        action,
        ...(property ? { property } : {}),
        since_year: Number(form.since_year),
        url: form.url,
        ...(hasLangMap ? { url_lang_map: form.url_lang_map } : {}),
    };
}

export const buildDecreePayload = (form) => {
    const { action, property } = splitAction(form.action);
    const fullAction = form.action; // e.g. 'createNew', 'setProperty:grade', 'makeDoctor'

    const liturgical_event = buildLiturgicalEvent(form, fullAction);

    const payload = {
        decree_id: form.decree_id,
        decree_date: form.decree_date,
        decree_protocol: form.decree_protocol,
        description: form.description,
        liturgical_event,
        metadata: buildMetadata(form, action, property),
    };

    // i18n only for name-bearing actions (createNew, makeDoctor, setProperty:name)
    const nameBearing = fullAction === DecreeAction.CreateNew
        || fullAction === DecreeAction.MakeDoctor
        || fullAction === DecreeAction.SetPropertyName;
    if (nameBearing && form.i18n && Object.keys(form.i18n).length > 0) {
        payload.i18n = form.i18n;
    }

    // readings only for createNew
    if (fullAction === DecreeAction.CreateNew && form.readings && Object.keys(form.readings).length > 0) {
        payload.readings = form.readings;
    }

    return payload;
};

/**
 * Validate i18n requirements for name-bearing actions.
 *
 * @param {object}   payload     Built payload
 * @param {boolean}  nameBearing True when the action touches the event name
 * @param {string}   baseLocale  The user's base locale (must be present in i18n)
 * @param {string[]} errors      Errors array to push into
 */
function validateI18nRules(payload, nameBearing, baseLocale, errors) {
    if (nameBearing) {
        if (!payload.i18n || Object.keys(payload.i18n).length === 0) {
            errors.push(`Action "${payload.metadata.action}" requires at least one translated event name (i18n)`);
        } else if (!(baseLocale in payload.i18n)) {
            errors.push(`The i18n object must include an entry for your locale "${baseLocale}"`);
        }
    } else if (payload.i18n) {
        errors.push('A grade change does not affect the event name: remove the i18n translations');
    }
}

/**
 * Validate readings requirements.
 *
 * @param {object}   payload   Built payload
 * @param {boolean}  isCreate  True when creating (PUT), false when updating (PATCH)
 * @param {string[]} errors    Errors array to push into
 */
function validateReadingsRules(payload, isCreate, errors) {
    if (isCreate) {
        if (payload.metadata.action === 'createNew' && !payload.readings) {
            errors.push('A new liturgical event must define its lectionary readings');
        }
        if (payload.metadata.action !== 'createNew' && payload.readings) {
            errors.push(`Action "${payload.metadata.action}" does not accept readings on creation; correct readings via an edit instead`);
        }
    }
}

/**
 * Validate consistency between the source URL's %s placeholder and the
 * url_lang_map. One without the other is almost always an authoring mistake.
 *
 * @param {object}   payload  Built payload
 * @param {string[]} errors   Errors array to push into
 */
function validateUrlRules(payload, errors) {
    const md = payload.metadata;
    const hasMap = md.url_lang_map && Object.keys(md.url_lang_map).length > 0;
    const hasPlaceholder = typeof md.url === 'string' && md.url.includes('%s');
    if (hasMap && !hasPlaceholder) {
        errors.push('The source URL must contain a "%s" placeholder when language URL codes are provided');
    }
    if (hasPlaceholder && !hasMap) {
        errors.push('The source URL contains a "%s" placeholder but no language URL codes are defined');
    }
}

export const validateDecreePayload = (payload, baseLocale, isCreate) => {
    const errors = [];
    const { action, property } = payload.metadata;
    const nameBearing = action === 'createNew' || action === 'makeDoctor'
        || (action === 'setProperty' && property === 'name');

    validateI18nRules(payload, nameBearing, baseLocale, errors);
    validateUrlRules(payload, errors);

    // makeDoctor requires a non-empty common array (DTO: DecreeItemMakeDoctor requires common)
    if (action === 'makeDoctor') {
        const hasCommon = payload.liturgical_event
            && Array.isArray(payload.liturgical_event.common)
            && payload.liturgical_event.common.length > 0;
        if (!hasCommon) {
            errors.push('Action "makeDoctor" requires at least one common value (e.g. "Doctors")');
        }
    }

    // createNew requires non-empty color and common arrays (DTO: DecreeItemCreateNew requires both)
    if (action === 'createNew') {
        const hasColor = payload.liturgical_event
            && Array.isArray(payload.liturgical_event.color)
            && payload.liturgical_event.color.length > 0;
        if (!hasColor) {
            errors.push('A new liturgical event must have at least one liturgical color selected');
        }
        const hasCommon = payload.liturgical_event
            && Array.isArray(payload.liturgical_event.common)
            && payload.liturgical_event.common.length > 0;
        if (!hasCommon) {
            errors.push('A new liturgical event must specify at least one common (e.g. "Pastors")');
        }
    }

    validateReadingsRules(payload, isCreate, errors);

    return errors;
};
