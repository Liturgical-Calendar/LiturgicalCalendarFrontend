class Epiphany {
    static JAN6 = 'JAN6';
    static SUNDAY_JAN2_JAN8 = 'SUNDAY_JAN2_JAN8';
    static _map = Object.freeze([
        'JAN6',
        'SUNDAY_JAN2_JAN8'
    ]);
    constructor(value) {
        if (typeof value !== 'string' || !Epiphany._map.includes(value)) {
            throw new Error(`Invalid Epiphany value: ${value}`);
        }
        this.value = value;
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
}

class Ascension {
    static THURSDAY = 'THURSDAY';
    static SUNDAY   = 'SUNDAY';
    static _map = Object.freeze([
        'THURSDAY',
        'SUNDAY'
    ]);
    constructor(value) {
        if (typeof value !== 'string' || !Ascension._map.includes(value)) {
            throw new Error(`Invalid Ascension value: ${value}`);
        }
        this.value = value;
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
}

class CorpusChristi {
    static THURSDAY = 'THURSDAY';
    static SUNDAY   = 'SUNDAY';
    static _map = Object.freeze([
        'THURSDAY',
        'SUNDAY'
    ]);
    constructor(value) {
        if (typeof value !== 'string' || !CorpusChristi._map.includes(value)) {
            throw new Error(`Invalid CorpusChristi value: ${value}`);
        }
        this.value = value;
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
}

class EternalHighPriest {
    static TRUE  = true;
    static FALSE = false;
    constructor(value) {
        if (typeof value !== 'boolean') {
            throw new Error(`Invalid EternalHighPriest value, must be of type boolean`);
        }
        this.value = value;
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
}

class Locale {
    static #map = Object.freeze([
        "af_NA","af_ZA","agq_CM","ak_GH","am_ET",
        "ar_001","ar_AE","ar_BH","ar_DJ","ar_DZ","ar_EG","ar_EH",
        "ar_ER","ar_IL","ar_IQ","ar_JO","ar_KM","ar_KW","ar_LB",
        "ar_LY","ar_MA","ar_MR","ar_OM","ar_PS","ar_QA","ar_SA",
        "ar_SD","ar_SO","ar_SS","ar_SY","ar_TD","ar_TN","ar_YE",
        "as_IN","asa_TZ","ast_ES",
        "az_Cyrl","az_Cyrl_AZ","az_Latn","az_Latn_AZ",
        "bas_CM","be_BY","bem_ZM","bez_TZ",
        "bg_BG","bm_ML","bn_BD","bn_IN",
        "bo_CN","bo_IN",
        "br_FR","brx_IN","bs_Cyrl","bs_Cyrl_BA","bs_Latn","bs_Latn_BA",
        "ca_AD","ca_ES","ca_FR","ca_IT","ccp_BD","ccp_IN",
        "ce_RU","ceb_PH","cgg_UG","chr_US",
        "ckb_IQ","ckb_IR","cs_CZ","cy_GB",
        "da_DK","da_GL","dav_KE",
        "de_AT","de_BE","de_CH","de_DE","de_IT","de_LI","de_LU",
        "dje_NE","dsb_DE","dua_CM","dyo_SN","dz_BT",
        "ebu_KE","ee_GH","ee_TG","el_CY","el_GR",
        "en_001","en_150","en_AE","en_AG","en_AI","en_AS","en_AT","en_AU",
        "en_BB","en_BE","en_BI","en_BM","en_BS","en_BW","en_BZ",
        "en_CA","en_CC","en_CH","en_CK","en_CM","en_CX","en_CY",
        "en_DE","en_DG","en_DK","en_DM","en_ER","en_FI","en_FJ","en_FK","en_FM",
        "en_GB","en_GD","en_GG","en_GH","en_GI","en_GM","en_GU","en_GY",
        "en_HK","en_IE","en_IL","en_IM","en_IN","en_IO","en_JE","en_JM",
        "en_KE","en_KI","en_KN","en_KY","en_LC","en_LR","en_LS",
        "en_MG","en_MH","en_MO","en_MP","en_MS","en_MT","en_MU","en_MW","en_MY",
        "en_NA","en_NF","en_NG","en_NL","en_NR","en_NU","en_NZ",
        "en_PG","en_PH","en_PK","en_PN","en_PR","en_PW","en_RW",
        "en_SB","en_SC","en_SD","en_SE","en_SG","en_SH","en_SI","en_SL","en_SS","en_SX","en_SZ",
        "en_TC","en_TK","en_TO","en_TT","en_TV","en_TZ","en_UG","en_UM","en_US",
        "en_VC","en_VG","en_VI","en_VU","en_WS","en_ZA","en_ZM","en_ZW",
        "eo_001",
        "es_419","es_AR","es_BO","es_BR","es_BZ","es_CL","es_CO","es_CR","es_CU",
        "es_DO","es_EA","es_EC","es_ES","es_GQ","es_GT","es_HN","es_IC","es_MX",
        "es_NI","es_PA","es_PE","es_PH","es_PR","es_PY","es_SV","es_US","es_UY","es_VE",
        "et_EE","eu_ES","ewo_CM",
        "fa_AF","fa_IR",
        "ff_Latn","ff_Latn_BF","ff_Latn_CM","ff_Latn_GH","ff_Latn_GM",
        "ff_Latn_GN","ff_Latn_GW","ff_Latn_LR","ff_Latn_MR","ff_Latn_NE",
        "ff_Latn_NG","ff_Latn_SL","ff_Latn_SN","fi_FI","fil_PH",
        "fo_DK","fo_FO",
        "fr_BE","fr_BF","fr_BI","fr_BJ","fr_BL",
        "fr_CA","fr_CD","fr_CF","fr_CG","fr_CH","fr_CI","fr_CM","fr_DJ","fr_DZ",
        "fr_FR","fr_GA","fr_GF","fr_GN","fr_GP","fr_GQ","fr_HT","fr_KM","fr_LU",
        "fr_MA","fr_MC","fr_MF","fr_MG","fr_ML","fr_MQ","fr_MR","fr_MU",
        "fr_NC","fr_NE","fr_PF","fr_PM","fr_RE","fr_RW","fr_SC","fr_SN","fr_SY",
        "fr_TD","fr_TG","fr_TN","fr_VU","fr_WF","fr_YT",
        "fur_IT","fy_NL",
        "ga_GB","ga_IE","gd_GB","gl_ES","gsw_CH","gsw_FR","gsw_LI",
        "gu_IN","guz_KE","gv_IM",
        "ha_GH","ha_NE","ha_NG","haw_US","he_IL","hi_IN",
        "hr_BA","hr_HR","hsb_DE","hu_HU","hy_AM",
        "ia_001","id_ID","ig_NG","ii_CN","is_IS",
        "it_CH","it_IT","it_SM","it_VA",
        "ja_JP","jgo_CM","jmc_TZ","jv_ID",
        "ka_GE","kab_DZ","kam_KE","kde_TZ","kea_CV",
        "khq_ML","ki_KE","kk_KZ","kkj_CM","kl_GL","kln_KE",
        "km_KH","kn_IN","ko_KP","ko_KR","kok_IN","ks_IN",
        "ksb_TZ","ksf_CM","ksh_DE","ku_TR","kw_GB",
        "ky_KG",
        "lag_TZ","lb_LU","lg_UG","lkt_US",
        "ln_AO","ln_CD","ln_CF","ln_CG","lo_LA","lrc_IQ","lrc_IR",
        "lt_LT","lu_CD","luo_KE","luy_KE","lv_LV",
        "mas_KE","mas_TZ","mer_KE","mfe_MU",
        "mg_MG","mgh_MZ","mgo_CM","mi_NZ","mk_MK",
        "ml_IN","mn_MN","mr_IN","ms_BN","ms_MY","ms_SG",
        "mt_MT","mua_CM","my_MM","mzn_IR",
        "naq_NA","nb_NO","nb_SJ","nd_ZW","nds_DE","nds_NL",
        "ne_IN","ne_NP","nl_AW","nl_BE","nl_BQ","nl_CW","nl_NL","nl_SR","nl_SX",
        "nmg_CM","nn_NO","nnh_CM","nus_SS","nyn_UG",
        "om_ET","om_KE","or_IN","os_GE","os_RU",
        "pa_Arab","pa_Arab_PK","pa_Guru","pa_Guru_IN",
        "pl_PL","ps_AF","ps_PK",
        "pt_AO","pt_BR","pt_CH","pt_CV","pt_GQ","pt_GW","pt_LU","pt_MO","pt_MZ","pt_PT","pt_ST","pt_TL",
        "qu_BO","qu_EC","qu_PE",
        "rm_CH","rn_BI","ro_MD","ro_RO","rof_TZ",
        "ru_BY","ru_KG","ru_KZ","ru_MD","ru_RU","ru_UA","rw_RW","rwk_TZ",
        "sah_RU","saq_KE","sbp_TZ","sd_PK",
        "se_FI","se_NO","se_SE","seh_MZ","ses_ML",
        "sg_CF","shi_Latn","shi_Latn_MA","shi_Tfng","shi_Tfng_MA",
        "si_LK","sk_SK","sl_SI","smn_FI","sn_ZW",
        "so_DJ","so_ET","so_KE","so_SO","sq_AL","sq_MK","sq_XK",
        "sr_Cyrl","sr_Cyrl_BA","sr_Cyrl_ME","sr_Cyrl_RS","sr_Cyrl_XK",
        "sr_Latn","sr_Latn_BA","sr_Latn_ME","sr_Latn_RS","sr_Latn_XK",
        "sv_AX","sv_FI","sv_SE","sw_CD","sw_KE","sw_TZ","sw_UG",
        "ta_IN","ta_LK","ta_MY","ta_SG","te_IN","teo_KE","teo_UG",
        "tg_TJ","th_TH","ti_ER","ti_ET","tk_TM","to_TO",
        "tr_CY","tr_TR","tt_RU","twq_NE","tzm_MA",
        "ug_CN","uk_UA",
        "ur_IN","ur_PK","uz_Arab","uz_Arab_AF","uz_Cyrl","uz_Cyrl_UZ","uz_Latn","uz_Latn_UZ",
        "vai_Latn","vai_Latn_LR","vai_Vaii","vai_Vaii_LR","vi_VN","vun_TZ",
        "wae_CH","wo_SN","xh_ZA","xog_UG",
        "yav_CM","yi_001","yo_BJ","yo_NG",
        "yue_Hans","yue_Hans_CN","yue_Hant","yue_Hant_HK",
        "zgh_MA","zh_Hans","zh_Hans_CN","zh_Hans_HK","zh_Hans_MO","zh_Hans_SG","zh_Hant","zh_Hant_HK","zh_Hant_MO","zh_Hant_TW",
        "zu_ZA", "af",   "agq", "ak",    "am",   "ar",   "as",   "asa",   "ast", "az",   "bas",
        "be",   "bem", "bez",   "bg",   "bm",   "bn",   "bo",    "br",  "brx",  "bs",
        "ca",   "ccp", "ce",    "ceb",  "cgg",  "chr",  "ckb",   "cs",  "cy",   "da",
        "dav",  "de",  "dje",   "dsb",  "dua",  "dyo",  "dz",    "ebu", "ee",   "el",
        "en",   "eo",  "es",    "et",   "eu",   "ewo",  "fa",    "ff",  "fi",   "fil",
        "fo",   "fr",  "fur",   "fy",   "ga",   "gd",   "gl",    "gsw", "gu",   "guz",
        "gv",   "ha",  "haw",   "he",   "hi",   "hr",   "hsb",   "hu",  "hy",   "ia",
        "id",   "ig",  "ii",    "is",   "it",   "ja",   "jgo",   "jmc", "jv",   "ka",
        "kab",  "kam", "kde",   "kea",  "khq",  "ki",   "kk",    "kkj", "kl",   "kln",
        "km",   "kn",  "ko",    "kok",  "ks",   "ksb",  "ksf",   "ksh", "ku",   "kw",
        "ky",   "lag", "lb",    "lg",   "lkt",  "ln",   "lo",    "lrc", "lt",   "lu",
        "luo",  "luy", "lv",    "mas",  "mer",  "mfe",  "mg",    "mgh", "mgo",  "mi",
        "mk",   "ml",  "mn",    "mr",   "ms",   "mt",   "mua",   "my",  "mzn",  "naq",
        "nb",   "nd",  "nds",   "ne",   "nl",   "nmg",  "nn",    "nnh", "nus",  "nyn",
        "om",   "or",  "os",    "pa",   "pl",   "ps",   "pt",    "qu",  "rm",   "rn",
        "ro",   "rof", "ru",    "rw",   "rwk",  "sah",  "saq",   "sbp", "sd",   "se",
        "seh",  "ses", "sg",    "shi",  "si",   "sk",   "sl",    "smn", "sn",   "so",
        "sq",   "sr",  "sv",    "sw",   "ta",   "te",   "teo",   "tg",  "th",   "ti",
        "tk",   "to",  "tr",    "tt",   "twq",  "tzm",  "ug",    "uk",  "ur",   "uz",
        "vai",  "vi",  "vun",   "wae",  "wo",   "xh",   "xog",   "yav", "yi",   "yo",
        "yue",  "zgh", "zh",    "zu",   "la",   "la_VA"
    ]);
    static #normalize(value) {
        return value.replace(/-/g, '_');
    }
    static isValid(value) {
        return Locale.#map.includes(Locale.#normalize(value));
    }
    constructor(value) {
        if (typeof value !== 'string') {
            throw new Error(`Invalid Locale value: ${value}`);
        }
        value = Locale.#normalize(value);
        if (!Locale.#map.includes(value)) {
            throw new Error(`Invalid Locale value: ${value}`);
        }
        this.value = value;
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
}

class Settings {
    constructor(settingsObj) {
        if (typeof settingsObj !== 'object') {
            throw new Error(`Invalid settings object: ${settingsObj}`);
        }
        if (settingsObj.hasOwnProperty('locale')) {
            this.locale = new Locale(settingsObj.locale);
        }
        if (settingsObj.hasOwnProperty('epiphany')) {
            this.epiphany = new Epiphany(settingsObj.epiphany);
        }
        if (settingsObj.hasOwnProperty('ascension')) {
            this.ascension = new Ascension(settingsObj.ascension);
        }
        if (settingsObj.hasOwnProperty('corpus_christi')) {
            this.corpus_christi = new CorpusChristi(settingsObj.corpus_christi);
        }
        if (settingsObj.hasOwnProperty('eternal_high_priest')) {
            this.eternal_high_priest = new EternalHighPriest(settingsObj.eternal_high_priest);
        }
        return Object.freeze(this);
    }
}

export { Settings, Locale };
