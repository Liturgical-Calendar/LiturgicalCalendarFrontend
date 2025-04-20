# Liturgical Calendar Frontend

**Code quality**
| MAIN | DEVELOPMENT |
|:----:|:-----------:|
| [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/main)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/main) | [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/development)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/development) |

Presentation of the Liturgical Calendar Project, using bootstrap theming. See https://litcal.johnromanodorazio.com/. Development is done initially on the development branch with a frontend at https://litcal-staging.johnromanodorazio.com/.

The Liturgical Calendar project offers an API that generates data for the liturgical events in the General Roman Calendar, as well as an API that generates the dates of easter in both the gregorian and the julian calendar from the year 1583 to the year 9999. Data from the Liturgical Calendar API can be requested in either JSON or XML format, so as to be consumed by any kind of application that can read JSON or XML data. It can also be requested in ICS format, so as to be consumed by any kind of iCal or Calendar application.

This frontend is an interface with documentation and examples for the API.

The API can be extended with National Calendars, based on the Roman Missals issued in the region; these calendars can then be requested on the Liturgical Calendar API `/calendar/nation/{NATION}` path, where `{NATION}` is the two letter ISO country code, as defined in [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).

The API is also extendable for Diocesan Calendars, which however can only be defined after the National Calendar for the region has been defined;
once the Diocesan Calendar is defined, it can be requested on the Liturgical Calendar API `/calendar/diocese/{DIOCESE}` path, where `{DIOCESE}` is the code for the diocese as defined in [/assets/data/WorldDiocesesByNation.json](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/blob/development/assets/data/WorldDiocesesByNation.json) in this frontend repository.

The National and Diocesan Calendar data can be defined directly through the interfaces offered by this frontend.

# Development

To test the frontend locally, first install all package dependencies with `composer install`.

Then make sure you have an instance of the API running locally (see [Liturgical-Calendar/LiturgicalCalendarAPI/README.md#testing-locally](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/tree/development?tab=readme-ov-file#testing-locally)).

Then copy `.env.example` to `.env.development`. You shouldn't have to change any values, unless you are running the local API instance on a port other than 8000.

Finally, launch PHP's builtin server from a separate terminal instance than the one on which you are running the local API instance:

```console
php -S localhost:3000
```

Then navigate to `localhost:3000` in your browser, and you should see a running instance of the frontend website that is fully communicational with the backend API.

> [!TIP]
> For convenience when using VSCode, a `tasks.json` has been defined so that you can simply type <kbd>CTRL</kbd>+<kbd>SHIFT</kbd>+<kbd>B</kbd> (<kbd>CMD</kbd>+<kbd>SHIFT</kbd>+<kbd>B</kbd> on MacOS) to start the PHP builtin server and open the browser at `localhost:3000`.

# Localization of the Frontend
<a href="https://translate.johnromanodorazio.com/engage/liturgical-calendar/">
<img src="https://translate.johnromanodorazio.com/widgets/liturgical-calendar/-/frontend/open-graph.png" alt="Translation status" />
</a>
