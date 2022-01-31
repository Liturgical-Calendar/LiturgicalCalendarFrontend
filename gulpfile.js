/** Automate scanning for new or changed i18next.js translation keys */
var gulp = require('gulp');
var scanner = require('i18next-scanner');

gulp.task('i18next', function() {
    return gulp.src(['assets/js/*.{js,html}'])
        .pipe(scanner({
            lngs: ['en', 'es', 'de', 'fr', 'it', 'pt', 'la'], // supported languages
            resource: {
                // the source path is relative to current working directory
                loadPath: process.env.GITHUB_WORKSPACE+'/assets/locales/{{lng}}/{{ns}}.json',
                // the destination path is relative to your `gulp.dest()` path
                savePath: 'locales/{{lng}}/{{ns}}.json',
                jsonIndent: 4
            }
        }))
        .pipe(gulp.dest(process.env.GITHUB_WORKSPACE+'/assets'));
});
