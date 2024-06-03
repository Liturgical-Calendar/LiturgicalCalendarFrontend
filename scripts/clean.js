const sh = require('shelljs');
const upath = require('upath');

const destPath = upath.resolve(upath.dirname(__filename), '../assets/css/global_styles.css');

sh.rm('-f', `${destPath}`)

