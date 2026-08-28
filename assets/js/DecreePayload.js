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

/**
 * Lowest grade that takes the festive lectionary shape (LitGrade::FEAST_LORD).
 *
 * The API's CommonDef schema admits two shapes for an ordinary celebration:
 * `ReadingsFerial` (first reading, psalm, acclamation, gospel — and
 * `additionalProperties: false`, so no second reading) and `ReadingsFestive`,
 * which *requires* a second reading. Which one applies follows the grade:
 * Feast and below are ferial, Feast of the Lord and above are festive.
 *
 * @type {number}
 */
export const FESTIVE_GRADE_MIN = 5;

/**
 * Whether a grade takes the festive lectionary shape (i.e. has a second reading).
 *
 * @param {number|string|undefined|null} grade  A liturgical grade (0-7)
 * @returns {boolean}  True for Feast of the Lord and above
 */
export const isFestiveGrade = (grade) => {
    const value = Number(grade);
    return Number.isFinite(value) && value >= FESTIVE_GRADE_MIN;
};

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
 * Build the liturgical_event shape for the createNew action.
 * Includes date positioning (fixed day/month or mobile strtotime),
 * grade, color, and common.
 *
 * `form.strtotime` is the structured relative-date object
 * `{ day_of_the_week, relative_time, event_key }` collected from the three
 * mobile-date fields (used only when event_type is 'mobile').
 *
 * @param {object} form  Form values bag from collectFormValues()
 * @returns {object}
 */
function buildCreateNewEvent(form) {
    return {
        event_key: form.event_key,
        calendar: 'GENERAL ROMAN',
        ...(form.event_type === 'mobile'
            ? { strtotime: form.strtotime, type: 'mobile' }
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
    const hasLangMap   = form.url_lang_map && Object.keys(form.url_lang_map).length > 0;
    const hasOverrides = form.urls_langs && Object.keys(form.urls_langs).length > 0;
    return {
        action,
        ...(property ? { property } : {}),
        since_year: Number(form.since_year),
        url: form.url,
        ...(hasLangMap ? { url_lang_map: form.url_lang_map } : {}),
        ...(hasOverrides ? { urls_langs: form.urls_langs } : {}),
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
 * Validate the lectionary shape against the grade.
 *
 * A ferial celebration (Feast and below) has no second reading; a festive one
 * (Feast of the Lord and above) must have one. Both directions are errors:
 * ReadingsFerial forbids the field outright, ReadingsFestive requires it.
 *
 * @param {object}   payload  Built payload
 * @param {string[]} errors   Errors array to push into
 */
function validateReadingsShape(payload, errors) {
    if (payload.metadata.action !== 'createNew' || !payload.readings) return;

    const grade   = payload.liturgical_event ? payload.liturgical_event.grade : undefined;
    const festive = isFestiveGrade(grade);

    Object.entries(payload.readings).forEach(([locale, readings]) => {
        const hasSecond = typeof readings?.second_reading === 'string' && readings.second_reading !== '';
        if (festive && !hasSecond) {
            errors.push(`Festive readings (grade ${grade}) require a second reading — none given for "${locale}"`);
        } else if (!festive && hasSecond) {
            errors.push(`Ferial readings (grade ${grade}) have no second reading — remove the one given for "${locale}"`);
        }
    });
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

/**
 * Whether a value is a complete absolute http(s) URL.
 *
 * A `^https?://` prefix test is not enough: it accepts `https://`, `http://` and
 * `https:// ` — a scheme with no host. The API refuses those (`FILTER_VALIDATE_URL`
 * returns false), so accepting them here would trade inline feedback for an opaque
 * server-side error on save. Parsing settles it, and pinning the protocol also rules
 * out schemes like `javascript:` that parse perfectly well.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isAbsoluteHttpUrl(url) {
    try {
        const { protocol } = new URL(url);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validate the per-language URL overrides.
 *
 * An override replaces the `url` + `url_lang_map` template outright for the language
 * it names, so it must be a finished absolute URL — not a template, and not a Vatican
 * language token. A language listed here needs no entry in `url_lang_map`; that is the
 * point of it, so no cross-check against the map is made.
 *
 * @param {object}   payload  Built payload
 * @param {string[]} errors   Errors array to push into
 */
function validateUrlOverrideRules(payload, errors) {
    const overrides = payload.metadata.urls_langs;
    if (!overrides || Object.keys(overrides).length === 0) return;

    Object.entries(overrides).forEach(([iso, url]) => {
        if (!/^[a-z]{2}$/.test(iso)) {
            errors.push(`"${iso}" is not a two-letter language code: URL overrides are keyed by ISO 639-1`);
        }
        if (typeof url !== 'string' || !isAbsoluteHttpUrl(url)) {
            errors.push(`The URL override for "${iso}" must be a full http(s) URL`);
        } else if (url.includes('%s')) {
            // Checked against the raw string, not the parsed URL: the parser happily
            // accepts `%s` in a path, so a template would otherwise slip through here.
            errors.push(`The URL override for "${iso}" must be a finished URL, not a template containing "%s"`);
        }
    });
}

export const validateDecreePayload = (payload, baseLocale, isCreate) => {
    const errors = [];
    const { action, property } = payload.metadata;
    const nameBearing = action === 'createNew' || action === 'makeDoctor'
        || (action === 'setProperty' && property === 'name');

    validateI18nRules(payload, nameBearing, baseLocale, errors);
    validateUrlRules(payload, errors);
    validateUrlOverrideRules(payload, errors);
    validateReadingsShape(payload, errors);

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
        // A mobile event's relative date needs all three strtotime fields
        // (day_of_the_week, relative_time, event_key).
        const ev = payload.liturgical_event;
        if (ev && ev.type === 'mobile') {
            const st = ev.strtotime;
            const complete = st && typeof st === 'object'
                && st.day_of_the_week && st.relative_time && st.event_key;
            if (!complete) {
                errors.push('A mobile event needs a day of the week, a relative time (before/after), and an anchor event');
            }
        }
    }

    validateReadingsRules(payload, isCreate, errors);

    return errors;
};
