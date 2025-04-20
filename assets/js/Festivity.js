class Festivity {
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
     * Construct a new Festivity object from an object.
     *
     * This constructor takes an optional object argument, which it will use to set the properties of the Festivity object.
     * The properties that can be set are: event_key, grade, common, calendar, color, readings, missal, name, grade_lcl, color_lcl.
     *
     * @param {object} [festivity] An object containing the properties to set on the Festivity object.
     */
    constructor(festivity = null) {
        if (festivity !== null) {
            Object.entries(festivity).forEach(([key, value]) => {
                if (Festivity.#allowedProps.has(key)) {
                    this[key] = value;
                }
            });
        }
    }

    static #allowedProps = new Set(['event_key', 'grade', 'common', 'calendar', 'color', 'readings', 'missal', 'name', 'grade_lcl', 'color_lcl']);
    static fromObject(festivity) {
        if ('strtotime' in festivity || ('type' in festivity && festivity.type === 'mobile')) {
            return new MobileFestivity(festivity);
        } else if ('day' in festivity && 'month' in festivity) {
            return new FixedFestivity(festivity);
        } else {
            return new Festivity(festivity);
        }
    }
}

class MobileFestivity extends Festivity {
    type = 'mobile';
    strtotime = '';
    constructor(festivity = null) {
        super(festivity);
        if ('strtotime' in festivity) {
            this.strtotime = festivity.strtotime;
        }
    }
}

class FixedFestivity extends Festivity {
    day = 0;
    month = 0;
    constructor(festivity = null) {
        super(festivity);
        this.day = festivity.day;
        this.month = festivity.month;
    }
}

export { Festivity, MobileFestivity, FixedFestivity };
