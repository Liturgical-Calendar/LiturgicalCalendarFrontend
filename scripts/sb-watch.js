'use strict';

const _ = require('lodash');
const chokidar = require('chokidar');
const upath = require('upath');
const renderSCSS = require('./render-scss');

const watcher = chokidar.watch('scss', {
    persistent: true,
});

let READY = false;

process.title = 'sb-watch';
process.stdout.write('Loading');

watcher.on('add', filePath => _processFile(upath.normalize(filePath), 'add'));
watcher.on('change', filePath => _processFile(upath.normalize(filePath), 'change'));
watcher.on('ready', () => {
    READY = true;
    console.log(' READY TO ROLL!');
});

_handleSCSS();

function _processFile(filePath, watchEvent) {
    
    if (!READY) { 
        process.stdout.write('.');
        return;
    }

    console.log(`### INFO: File event: ${watchEvent}: ${filePath}`);

    if (filePath.match(/\.scss$/)) {
        if (watchEvent === 'change') {
            return _handleSCSS(filePath, watchEvent);
        }
        return;
    }

}

function _handleSCSS() {
    renderSCSS();
}
