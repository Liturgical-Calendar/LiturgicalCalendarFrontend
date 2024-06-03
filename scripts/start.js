const concurrently = require('concurrently');
const upath = require('upath');

const browserSyncPath = upath.resolve(upath.dirname(__filename), '../node_modules/.bin/browser-sync');

concurrently([
    { command: 'node scripts/sb-watch.js', name: 'SB_WATCH', prefixColor: 'bgBlue.bold' },
    { command: 'php -S localhost:8000', name: 'PHP', prefixColor: 'bgYellow.bold' },
    { 
        command: `"${browserSyncPath}" start --files "./assets, ./**/*.php" -w --no-online --proxy localhost:8000`,
        name: 'SB_BROWSER_SYNC', 
        prefixColor: 'bgGreen.bold',
    }
], {
    prefix: 'name',
    killOthers: ['failure', 'success'],
}).then(success, failure);

function success() {
    console.log('Success');    
}

function failure() {
    console.log('Failure');
}
