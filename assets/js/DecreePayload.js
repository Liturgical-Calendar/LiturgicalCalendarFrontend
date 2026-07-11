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
    const liturgical_event = {
        event_key: form.event_key,
        calendar: 'GENERAL ROMAN',
        ...(form.event_type === 'mobile'
            ? { strtotime: form.strtotime, type: 'mobile' }
            : { day: Number(form.day), month: Number(form.month), type: 'fixed' }),
        ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
        ...(form.color ? { color: form.color } : {}),
        ...(form.common ? { common: form.common } : {}),
    };
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
    if (form.i18n && Object.keys(form.i18n).length > 0) {
        payload.i18n = form.i18n;
    }
    if (form.readings && Object.keys(form.readings).length > 0) {
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
