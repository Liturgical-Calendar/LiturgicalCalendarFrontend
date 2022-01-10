# Liturgical Calendar Frontend

| Code quality: |
|:-------------:|
| [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend) |

Presentation of the Liturgical Calendar Project, using bootstrap theming. See https://litcal.johnromanodorazio.com/. Development is done initially on the development branch with a frontend at https://litcal-staging.johnromanodorazio.com/.

The Liturgical Calendar project offers an API that generates data for the liturgical events in the General Roman Calendar, as well as an API that generates the dates of easter in both the gregorian and the julian calendar from the year 1583 to the year 9999. Data from the Liturgical Calendar API can be requested in either JSON or XML format, so as to be consumed by any kind of application that can read JSON or XML data. It can also be requested in ICS format, so as to be consumed by any kind of iCal or Calendar application.

This frontend is an interface with documentation and examples for the API.

There are two national calendars built into the API, that of Italy and that of the USA, which can be requested through the `nationalCalendar` parameter.

The API is also extendable for Diocesan Calendars (currently only for those national calendars that are built into the API, i.e. Dioceses of Italy and of the USA).

The Diocesan Calendar data can be defined directly through the interfaces offered by this frontend.

# Localization of the Frontend
<a href="https://translate.johnromanodorazio.com/engage/liturgical-calendar/">
<img src="https://translate.johnromanodorazio.com/widgets/liturgical-calendar/-/frontend/open-graph.png" alt="Translation status" />
</a>
