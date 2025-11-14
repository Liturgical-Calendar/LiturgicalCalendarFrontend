class LiturgicalEvent {
    event_key = '';
    grade = -1;
    common = [];
    calendar = '';
    color = [];
    readings = {};
    missal = '';
    name = '';
    grade_lcl = '';
    color_lcl = [];

    /**
     * Construct a new LiturgicalEvent object from an object.
     *
     * This constructor takes an optional object argument, which it will use to set the properties of the LiturgicalEvent object.
     * The properties that can be set are: event_key, grade, common, calendar, color, readings, missal, name, grade_lcl, color_lcl.
     *
     * @param {object} [liturgical_event] An object containing the properties to set on the LiturgicalEvent object.
     */
    constructor(liturgical_event = null) {
        if (liturgical_event !== null) {
            Object.entries(liturgical_event).forEach(([key, value]) => {
                if (LiturgicalEvent.#allowedProps.has(key)) {
                    this[key] = value;
                }
            });
        }
    }

    static #allowedProps = new Set(['event_key', 'grade', 'common', 'calendar', 'color', 'readings', 'missal', 'name', 'grade_lcl', 'color_lcl']);
    static fromObject(liturgical_event) {
        if ('strtotime' in liturgical_event || ('type' in liturgical_event && liturgical_event.type === 'mobile')) {
            return new MobileLiturgicalEvent(liturgical_event);
        } else if ('day' in liturgical_event && 'month' in liturgical_event) {
            return new FixedLiturgicalEvent(liturgical_event);
        } else {
            return new LiturgicalEvent(liturgical_event);
        }
    }
}

class MobileLiturgicalEvent extends LiturgicalEvent {
    type = 'mobile';
    strtotime = '';
    constructor(liturgical_event = null) {
        super(liturgical_event);
        if ('strtotime' in liturgical_event) {
            this.strtotime = liturgical_event.strtotime;
        }
    }
}

class FixedLiturgicalEvent extends LiturgicalEvent {
    day = 0;
    month = 0;
    constructor(liturgical_event = null) {
        super(liturgical_event);
        this.day = liturgical_event.day;
        this.month = liturgical_event.month;
    }
}

export { LiturgicalEvent, MobileLiturgicalEvent, FixedLiturgicalEvent };
