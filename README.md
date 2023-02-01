# Liturgical Calendar Frontend

**Code quality**
| MAIN | DEVELOPMENT |
|:----:|:-----------:|
| [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/main)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/main) | [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/development)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/development) |

Presentation of the Liturgical Calendar Project, using bootstrap theming. See https://litcal.johnromanodorazio.com/. Development is done initially on the development branch with a frontend at https://litcal-staging.johnromanodorazio.com/.

The Liturgical Calendar project offers an API that generates data for the liturgical events in the General Roman Calendar, as well as an API that generates the dates of easter in both the gregorian and the julian calendar from the year 1583 to the year 9999. Data from the Liturgical Calendar API can be requested in either JSON or XML format, so as to be consumed by any kind of application that can read JSON or XML data. It can also be requested in ICS format, so as to be consumed by any kind of iCal or Calendar application.

This frontend is an interface with documentation and examples for the API.

The API can be extended with National Calendars, based on the Roman Missals issued in the region; these calendars can then be requested with the `nationalCalendar` parameter.

The API is also extendable for Diocesan Calendars, which however can only be defined after the National Calendar for the region has been defined;
once the Diocesan Calendar is defined, it can be requested using the `diocesanCalendar` parameter.

The National and Diocesan Calendar data can be defined directly through the interfaces offered by this frontend.

# Localization of the Frontend
<a href="https://translate.johnromanodorazio.com/engage/liturgical-calendar/">
<img src="https://translate.johnromanodorazio.com/widgets/liturgical-calendar/-/frontend/open-graph.png" alt="Translation status" />
</a>
