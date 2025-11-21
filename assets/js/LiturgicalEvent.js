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

    /**
     * Construct a new LiturgicalEvent object from an object.
     *
     * This static method takes an object argument, which it will use to set the properties of the LiturgicalEvent object.
     * If the object has a 'strtotime' property or a 'type' property set to 'mobile', it will create a MobileLiturgicalEvent object.
     * If the object has 'day' and 'month' properties, it will create a FixedLiturgicalEvent object.
     * Otherwise, it will create a LiturgicalEvent object.
     *
     * @param {object} liturgical_event An object containing the properties to set on the LiturgicalEvent object.
     * @throws {TypeError} If liturgical_event is not a non-null object.
     * @returns {LiturgicalEvent|MobileLiturgicalEvent|FixedLiturgicalEvent} A new LiturgicalEvent object.
     */
    static fromObject(liturgical_event) {
        if (!liturgical_event || typeof liturgical_event !== 'object') {
            throw new TypeError('liturgical_event must be a non-null object');
        }
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

    /**
     * Construct a new MobileLiturgicalEvent object from an object.
     *
     * This constructor takes an object argument, which it will use to set the properties of the MobileLiturgicalEvent object.
     * If the object has a 'strtotime' property, it will use that value to set the strtotime property of the MobileLiturgicalEvent object.
     *
     * @param {object} liturgical_event An object containing the properties to set on the MobileLiturgicalEvent object.
     */
    constructor(liturgical_event) {
        if (!liturgical_event || typeof liturgical_event !== 'object') {
            throw new TypeError('liturgical_event must be a non-null object');
        }
        super(liturgical_event);
        if ('strtotime' in liturgical_event) {
            this.strtotime = liturgical_event.strtotime;
        }
    }
}

class FixedLiturgicalEvent extends LiturgicalEvent {
    day = 0;
    month = 0;

    /**
     * Construct a new FixedLiturgicalEvent object from an object.
     *
     * This constructor takes an object argument, which it will use to set the properties of the FixedLiturgicalEvent object.
     * The object argument must have 'day' and 'month' properties, which it will use to set the day and month properties of the FixedLiturgicalEvent object.
     *
     * @param {object} liturgical_event An object containing the 'day' and 'month' properties to set on the FixedLiturgicalEvent object.
     */
    constructor(liturgical_event) {
        if (!liturgical_event || typeof liturgical_event !== 'object') {
            throw new TypeError('liturgical_event must be a non-null object');
        }
        super(liturgical_event);
        this.day = liturgical_event.day;
        this.month = liturgical_event.month;
    }
}

export { LiturgicalEvent, MobileLiturgicalEvent, FixedLiturgicalEvent };
