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

export const buildDecreePayload = (form) => {
    const { action, property } = splitAction(form.action);
    const fullAction = form.action; // e.g. 'createNew', 'setProperty:grade', 'makeDoctor'

    // Build per-action liturgical_event shapes
    let liturgical_event;
    if (fullAction === DecreeAction.CreateNew) {
        // createNew: include day/month (fixed) or strtotime (mobile) + type + grade + color + common
        let strtotimeValue = form.strtotime;
        if (typeof strtotimeValue === 'string') {
            try {
                const parsed = JSON.parse(strtotimeValue);
                if (parsed !== null && typeof parsed === 'object') {
                    strtotimeValue = parsed;
                }
            } catch {
                // not JSON — keep as string
            }
        }
        liturgical_event = {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
            ...(form.event_type === 'mobile'
                ? { strtotime: strtotimeValue, type: 'mobile' }
                : { day: Number(form.day), month: Number(form.month), type: 'fixed' }),
            ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
            ...(form.color && form.color.length > 0 ? { color: form.color } : {}),
            ...(form.common && form.common.length > 0 ? { common: form.common } : {}),
        };
    } else if (fullAction === DecreeAction.SetPropertyGrade) {
        // setProperty:grade: ONLY event_key, calendar, grade
        liturgical_event = {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
            ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
        };
    } else if (fullAction === DecreeAction.SetPropertyName) {
        // setProperty:name: ONLY event_key, calendar
        liturgical_event = {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
        };
    } else if (fullAction === DecreeAction.MakeDoctor) {
        // makeDoctor: ONLY event_key, calendar, common
        liturgical_event = {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
            ...(form.common && form.common.length > 0 ? { common: form.common } : {}),
        };
    } else {
        // Fallback for unknown actions
        liturgical_event = {
            event_key: form.event_key,
            calendar: 'GENERAL ROMAN',
        };
    }

    const payload = {
        decree_id: form.decree_id,
        decree_date: form.decree_date,
        decree_protocol: form.decree_protocol,
        description: form.description,
        liturgical_event,
        metadata: {
            action,
            ...(property ? { property } : {}),
            since_year: Number(form.since_year),
            url: form.url,
        },
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

export const validateDecreePayload = (payload, baseLocale, isCreate) => {
    const errors = [];
    const { action, property } = payload.metadata;
    const nameBearing = action === 'createNew' || action === 'makeDoctor'
        || (action === 'setProperty' && property === 'name');

    if (nameBearing) {
        if (!payload.i18n || Object.keys(payload.i18n).length === 0) {
            errors.push(`Action "${action}" requires at least one translated event name (i18n)`);
        } else if (!(baseLocale in payload.i18n)) {
            errors.push(`The i18n object must include an entry for your locale "${baseLocale}"`);
        }
    } else if (payload.i18n) {
        errors.push('A grade change does not affect the event name: remove the i18n translations');
    }

    if (isCreate) {
        if (action === 'createNew' && !payload.readings) {
            errors.push('A new liturgical event must define its lectionary readings');
        }
        if (action !== 'createNew' && payload.readings) {
            errors.push(`Action "${action}" does not accept readings on creation; correct readings via an edit instead`);
        }
    }
    return errors;
};
