<?php

include_once("includes/i18n.php");
$i18n = new i18n();
include_once("./layout/formcontrols.php");
$FormControls = new FormControls( $i18n );

$USDiocesesByState = '{"Alabama":["Archdiocese of Mobile","Diocese of Birmingham"],"Alaska":["Archdiocese of Anchorage-Juneau","Diocese of Fairbanks"],"Arizona":["Holy Protection of Mary Byzantine Catholic Eparchy of Phoenix","Diocese of Phoenix","Diocese of Tucson"],"Arkansas":["Diocese of Little Rock"],"California":["Armenian Catholic Eparchy of Our Lady of Nareg in the USA & Canada","Chaldean Catholic Eparchy of St. Peter the Apostle","Archdiocese of Los Angeles","Archdiocese of San Francisco","Diocese of Fresno","Diocese of Monterey","Diocese of Oakland","Diocese of Orange","Diocese of Sacramento","Diocese of San Bernardino","Diocese of San Diego","Diocese of San Jose","Diocese of Santa Rosa","Diocese of Stockton"],"Colorado":["Archdiocese of Denver","Diocese of Colorado Springs","Diocese of Pueblo"],"Connecticut":["Ukrainian Catholic Eparchy of Stamford","Archdiocese of Hartford","Diocese of Bridgeport","Diocese of Norwich"],"Delaware":["Diocese of Wilmington"],"Florida":["Archdiocese of Miami","Diocese of Orlando","Diocese of Palm Beach","Diocese of Pensacola-Tallahassee","Diocese of St. Augustine","Diocese of St. Petersburg","Diocese of Venice"],"Georgia":["Archdiocese of Atlanta","Diocese of Savannah"],"Hawaii":["Diocese of Honolulu"],"Idaho":["Diocese of Boise"],"Illinois":["St. Nicholas of Chicago for Ukrainians","St. Thomas Syro Malabar Diocese of Chicago","Archdiocese of Chicago","Diocese of Belleville","Diocese of Joliet","Diocese of Peoria","Diocese of Rockford","Diocese of Springfield in Illinois"],"Indiana":["Archdiocese of Indianapolis","Diocese of Evansville","Diocese of Fort Wayne-South Bend","Diocese of Gary","Diocese of Lafayette in Indiana"],"Iowa":["Archdiocese of Dubuque","Diocese of Davenport","Diocese of Des Moines","Diocese of Sioux City"],"Kansas":["Archdiocese of Kansas City in Kansas","Diocese of Dodge City","Diocese of Salina","Diocese of Wichita"],"Kentucky":["Archdiocese of Louisville","Diocese of Covington","Diocese of Lexington","Diocese of Owensboro"],"Louisiana":["Archdiocese of New Orleans","Diocese of Alexandria","Diocese of Baton Rouge","Diocese of Houma-Thibodaux","Diocese of Lafayette in Louisiana","Diocese of Lake Charles","Diocese of Shreveport"],"Maine":["Diocese of Portland in Maine"],"Maryland":["Archdiocese of Baltimore"],"Massachusetts":["Eparchy of Newton","Archdiocese of Boston","Diocese of Fall River","Diocese of Springfield in Massachusetts","Diocese of Worcester"],"Michigan":["Chaldean Eparchy of Saint Thomas the Apostle","Archdiocese of Detroit","Diocese of Gaylord","Diocese of Grand Rapids","Diocese of Kalamazoo","Diocese of Lansing","Diocese of Marquette","Diocese of Saginaw"],"Minnesota":["Archdiocese of St. Paul and Minneapolis","Diocese of Crookston","Diocese of Duluth","Diocese of New Ulm","Diocese of St. Cloud","Diocese of Winona-Rochester"],"Mississippi":["Diocese of Biloxi","Diocese of Jackson"],"Missouri":["Maronite Eparchy of Our Lady of Lebanon","Archdiocese of St. Louis","Diocese of Jefferson City","Diocese of Kansas City-St. Joseph","Diocese of Springfield-Cape Girardeau"],"Montana":["Diocese of Great Falls-Billings","Diocese of Helena"],"Nebraska":["Archdiocese of Omaha","Diocese of Grand Island","Diocese of Lincoln"],"Nevada":["Diocese of Las Vegas","Diocese of Reno"],"New Hampshire":["Diocese of Manchester"],"New Jersey":["Byzantine Catholic Eparchy of Passaic","Eparchy of Our Lady of Deliverance Syriac Catholic Diocese in the USA","Archdiocese of Newark","Diocese of Camden","Diocese of Metuchen","Diocese of Paterson","Diocese of Trenton"],"New Mexico":["Archdiocese of Santa Fe","Diocese of Gallup","Diocese of Las Cruces"],"New York":["Eparchy of St. Maron of Brooklyn","Syro-Malankara Catholic Eparchy in the USA","Archdiocese of New York","Diocese of Albany","Diocese of Brooklyn","Diocese of Buffalo","Diocese of Ogdensburg","Diocese of Rochester","Diocese of Rockville Centre","Diocese of Syracuse"],"North Carolina":["Diocese of Charlotte","Diocese of Raleigh"],"North Dakota":["Diocese of Bismarck","Diocese of Fargo"],"Ohio":["Eparchy of Parma","Eparchy of St. George in Canton for the Romanians","Ukrainian Catholic Eparchy of St. Josaphat-Parma, OH","Archdiocese of Cincinnati","Diocese of Cleveland","Diocese of Columbus","Diocese of Steubenville","Diocese of Toledo","Diocese of Youngstown"],"Oklahoma":["Archdiocese of Oklahoma City","Diocese of Tulsa"],"Oregon":["Archdiocese of Portland in Oregon","Diocese of Baker"],"Pennsylvania":["Byzantine Catholic Archeparchy of Pittsburgh","Ukrainian Catholic Archeparchy of Philadelphia","Archdiocese of Philadelphia","Diocese of Allentown","Diocese of Altoona-Johnstown","Diocese of Erie","Diocese of Greensburg","Diocese of Harrisburg","Diocese of Pittsburgh","Diocese of Scranton"],"Rhode Island":["Diocese of Providence"],"South Carolina":["Diocese of Charleston"],"South Dakota":["Diocese of Rapid City","Diocese of Sioux Falls"],"Tennessee":["Diocese of Knoxville","Diocese of Memphis","Diocese of Nashville"],"Texas":["Archdiocese of Galveston-Houston","Archdiocese of San Antonio","Diocese of Amarillo","Diocese of Austin","Diocese of Beaumont","Diocese of Brownsville","Diocese of Corpus Christi","Diocese of Dallas","Diocese of El Paso","Diocese of Fort Worth","Diocese of Laredo","Diocese of Lubbock","Diocese of San Angelo","Diocese of The Personal Ordinariate of the Chair of St. Peter","Diocese of Tyler","Diocese of Victoria"],"Utah":["Diocese of Salt Lake City"],"Vermont":["Diocese of Burlington"],"Virgin Islands":["Diocese of St. Thomas, VI"],"Virginia":["Diocese of Arlington","Diocese of Richmond"],"Washington":["Archdiocese of Seattle","Diocese of Spokane","Diocese of Yakima"],"Washington DC":["Archdiocese of the Military Services","Archdiocese of Washington"],"West Virginia":["Diocese of Wheeling-Charleston"],"Wisconsin":["Archdiocese of Milwaukee","Diocese of Green Bay","Diocese of La Crosse","Diocese of Madison","Diocese of Superior"],"Wyoming":["Diocese of Cheyenne"]}';
$USStates = json_decode($USDiocesesByState);
$USDioceses = [];
foreach($USStates as $state => $arr){
    foreach($arr as $idx => $diocese){
        $USDioceses[] = $diocese . " (" . $state . ")";
    }
}
sort($USDioceses);

$ITALYDioceses = ["Acerenza","Acerra","Acireale","Acqui","Adria - Rovigo","Agrigento","Alba","Albano","Albenga - Imperia","Ales - Terralba","Alessandria","Alghero - Bosa","Alife - Caiazzo","Altamura - Gravina - Acquaviva delle Fonti","Amalfi - Cava de' Tirreni","Anagni - Alatri","Ancona - Osimo","Andria","Aosta","Arezzo - Cortona - Sansepolcro","Ariano Irpino - Lacedonia","Ascoli Piceno","Assisi - Nocera Umbra - Gualdo Tadino","Asti","Avellino","Aversa","Avezzano","Bari - Bitonto","Belluno - Feltre","Benevento","Bergamo","Biella","Bologna","Bolzano - Bressanone, Bozen - Brixen","Brescia","Brindisi - Ostuni","Cagliari","Caltagirone","Caltanissetta","Camerino - San Severino Marche","Campobasso - Boiano","Capua","Carpi","Casale Monferrato","Caserta","Cassano all'Jonio","Castellaneta","Catania","Catanzaro - Squillace","Cefalù","Cerignola - Ascoli Satriano","Cerreto Sannita - Telese - Sant'Agata de' Goti","Cesena - Sarsina","Chiavari","Chieti - Vasto","Chioggia","Città di Castello","Civita Castellana","Civitavecchia - Tarquinia","Como","Concordia - Pordenone","Conversano - Monopoli","Cosenza - Bisignano","Crema","Cremona","Crotone - Santa Severina","Cuneo","Esarcato Apostolico per i fedeli cattolici ucraini di rito bizantino residenti in ITALY","Fabriano - Matelica","Faenza - Modigliana","Fano - Fossombrone - Cagli - Pergola","Fermo","Ferrara - Comacchio","Fidenza","Fiesole","Firenze","Foggia - Bovino","Foligno","Forlì - Bertinoro","Fossano","Frascati","Frosinone - Veroli - Ferentino","Gaeta","Genova","Gorizia","Grosseto","Gubbio","Iglesias","Imola","Ischia","Isernia - Venafro","Ivrea","Jesi","La Spezia - Sarzana - Brugnato","Lamezia Terme","Lanciano - Ortona","Lanusei","L'Aquila","Latina - Terracina - Sezze - Priverno","Lecce","Livorno","Locri - Gerace","Lodi","Loreto","Lucca","Lucera - Troia","Lungro","Macerata - Tolentino - Recanati - Cingoli - Treia","Manfredonia - Vieste - San Giovanni Rotondo","Mantova","Massa Carrara - Pontremoli","Massa Marittima - Piombino","Matera - Irsina","Mazara del Vallo","Melfi - Rapolla - Venosa","Messina - Lipari - Santa Lucia del Mela","Milano","Mileto - Nicotera - Tropea","Modena - Nonantola","Molfetta - Ruvo - Giovinazzo - Terlizzi","Mondovì","Monreale","Monte Oliveto Maggiore","Montecassino","Montepulciano - Chiusi - Pienza","Montevergine","Napoli","Nardò - Gallipoli","Nicosia","Nocera Inferiore - Sarno","Nola","Noto","Novara","Nuoro","Oppido Mamertina - Palmi","Ordinariato Militare","Oria","Oristano","Orvieto - Todi","Ostia","Otranto","Ozieri","Padova","Palermo","Palestrina","Parma","Patti","Pavia","Perugia - Città della Pieve","Pesaro","Pescara - Penne","Pescia","Piacenza - Bobbio","Piana degli Albanesi","Piazza Armerina","Pinerolo","Pisa","Pistoia","Pitigliano - Sovana - Orbetello","Pompei","Porto - Santa Rufina","Potenza - Muro Lucano - Marsico Nuovo","Pozzuoli","Prato","Ragusa","Ravenna - Cervia","Reggio Calabria - Bova","Reggio Emilia - Guastalla","Rieti","Rimini","Roma","Rossano - Cariati","Sabina - Poggio Mirteto","Salerno - Campagna - Acerno","Saluzzo","San Benedetto del Tronto - Ripatransone - Montalto","San Marco Argentano - Scalea","San Marino - Montefeltro","San Miniato","San Severo","Santa Maria di Grottaferrata","Sant'Angelo dei Lombardi - Conza - Nusco - Bisaccia","Santissima Trinità di Cava de' Tirreni","Sassari","Savona - Noli","Senigallia","Sessa Aurunca","Siena - Colle di Val d'Elsa - Montalcino","Siracusa","Sora - Cassino - Aquino - Pontecorvo","Sorrento - Castellammare di Stabia","Spoleto - Norcia","Subiaco","Sulmona - Valva","Susa","Taranto","Teano - Calvi","Teggiano - Policastro","Tempio - Ampurias","Teramo - Atri","Termoli - Larino","Terni - Narni - Amelia","Tivoli","Torino","Tortona","Trani - Barletta - Bisceglie","Trapani","Trento","Treviso","Tricarico","Trieste","Trivento","Tursi - Lagonegro","Udine","Ugento - Santa Maria di Leuca","Urbino - Urbania - Sant'Angelo in Vado","Vallo della Lucania","Velletri - Segni","Venezia","Ventimiglia - San Remo","Vercelli","Verona","Vicenza","Vigevano","Viterbo","Vittorio Veneto","Volterra"];

$API_EXTEND_HOWTO_A = _( "The General Roman Calendar can be extended so as to create a National or Diocesan calendar. Diocesan calendars depend on National calendars, so the National calendar must first be created." );
$API_EXTEND_HOWTO_B = _( "National calendars must be defined using data from the translation of the Roman Missal used in the Region or in any case from decrees of the Episcopal Conference of the Region." );
$DioceseGroupHelp = _( "If a group of dioceses decides to pool their Liturgical Calendar data, for example to print out one single yearly calendar with the data for all the dioceses in the group, the group can be defined or set here." );
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar - Extending") ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-gray-800"><?php echo _( "Extend the General Roman Calendar with National or Diocesan data"); ?></h1>
        <p class="mb-4">
            <p><?php echo $API_EXTEND_HOWTO_A; ?></p>
            <p><?php echo $API_EXTEND_HOWTO_B; ?></p>
        </p>
<?php
    if(isset($_GET["choice"])){
        switch($_GET["choice"]){
            case "national":
                ?>
                <div class="col-md-6">
                    <div class="card border-left-primary shadow m-2">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "Generate National Calendar"); ?></h6>
                        </div>
                        <div class="card-body">
                            <div class="row no-gutters align-items-center"></div>
                            <div class="col-auto">
                                <i class="fas fa-flag fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <?php
            break;
            case "diocesan":
                ?>
                <div class="container">
                    <form class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarNationalDependency" class="font-weight-bold"><?php echo _( "Depends on national calendar"); ?>:</label>
                            <select class="form-control" id="diocesanCalendarNationalDependency" required>
                                <option value=""></option>
                                <option value="ITALY">Italy</option>
                                <option value="USA">USA</option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarDioceseName" class="font-weight-bold"><?php echo _( "Diocese"); ?>:</label>
                            <input list="DiocesesList" class="form-control" id="diocesanCalendarDioceseName" required>
                            <div class="invalid-feedback"><?php echo _( "This diocese does not seem to exist? Please choose from a value in the list."); ?></div>
                            <datalist id="DiocesesList">
                                <option value=""></option>
                            </datalist>
                            <div class="col text-center"><button class="btn btn-primary m-2" id="retrieveExistingDiocesanData" disabled><?php echo _( "Retrieve existing data"); ?></button></div>
                            <div class="col text-center"><button class="btn btn-danger m-2" id="removeExistingDiocesanData" disabled data-toggle="modal" data-target="#removeDiocesanCalendarPrompt"><?php echo _( "Remove existing data"); ?></button></div>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarGroup" class="font-weight-bold"><?php echo _( "Diocesan group"); ?>:</label>
                            <input type="text" class="form-control" id="diocesanCalendarGroup" aria-describedby="diocesanCalendarGroupHelp">
                            <small id="diocesanCalendarGroupHelp" class="form-text text-muted"><?php echo $DioceseGroupHelp; ?></small>
                        </div>
                        <!-- <div class="form-group col col-md-4">
                            <label for="diocesanCalendarBehaviour" class="font-weight-bold"><?php echo _( "Overwrites universal / national calendar"); ?></label>
                            <input type="checkbox" class="form-control" data-toggle="toggle" id="diocesanCalendarBehaviour" aria-describedby="diocesanCalendarBehaviourHelp">
                            <small id="diocesanCalendarBehaviourHelp" class="form-text text-muted">The default behaviour for a diocesan calendar is to juxtapose the local celebrations alongside those of the universal and the national calendar. If instead the diocesan calendar should override the universal calendar, turn this option on.</small>
                        </div> -->
                    </form>
                </div>
                <nav aria-label="Diocesan calendar definition" id="diocesanCalendarDefinitionCardLinks">
                    <ul class="pagination pagination-lg justify-content-center m-1">
                        <li class="page-item disabled">
                            <a class="page-link diocesan-carousel-prev" href="#" tabindex="-1" aria-disabled="true" aria-labeled="Previous"><span aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li class="page-item active"><a class="page-link" href="#" data-slide-to="0"><?php echo _( "Solemnities" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="1"><?php echo _( "Feasts" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="2"><?php echo _( "Memorials" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="3"><?php echo _( "Optional memorials" ); ?></a></li>
                        <li class="page-item">
                            <a class="page-link diocesan-carousel-next" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>
                        </li>
                    </ul>
                </nav>

                <div id="carouselExampleIndicators" class="carousel slide" data-interval="false">
                    <ol class="carousel-indicators">
                        <li data-target="#carouselExampleIndicators" data-slide-to="0" class="active"></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="1" class=""></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="2" class=""></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="3" class=""></li>
                    </ol>
                    <div class="carousel-inner">
                        <div class="carousel-item active" id="carouselItemSolemnities">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Generate Diocesan Calendar"); ?>: <?php echo _( "Define the Solemnities"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Principal Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Dedication of the Cathedral")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Solemnity")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addSolemnity">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemFeasts">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Generate Diocesan Calendar"); ?>: <?php echo _( "Define the Feasts"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Dedication of the Cathedral")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Feast")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addFeast">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemMemorials">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Generate Diocesan Calendar"); ?>: <?php echo _( "Define the Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Secondary Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Memorial")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Memorial")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addMemorial">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemOptionalMemorials">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Generate Diocesan Calendar"); ?>: <?php echo _( "Define the Optional Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Saints whos veneration is local to the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Optional Memorial")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Optional Memorial")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addOptionalMemorial">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="sr-only">Previous</span>
                    </a>
                    <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="sr-only">Next</span>
                    </a>
                </div>
                <div class="container">
                    <div class="row">
                        <div class="col text-center">
                            <button class="btn btn-lg btn-primary m-1" id="saveDiocesanCalendar_btn"><?php echo _( "SAVE DIOCESAN CALENDAR") ?></button>
                        </div>
                    </div>
                </div>
                <!--<form>
                    <div class="form-group">
                        <label for="exampleInputEmail1">Email address</label>
                        <input type="email" class="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" placeholder="Enter email">
                        <small id="emailHelp" class="form-text text-muted">We'll never share your email with anyone else.</small>
                    </div>
                    <div class="form-group">
                        <label for="exampleInputPassword1">Password</label>
                        <input type="password" class="form-control" id="exampleInputPassword1" placeholder="Password">
                    </div>
                    <div class="form-group form-check">
                        <input type="checkbox" class="form-check-input" id="exampleCheck1">
                        <label class="form-check-label" for="exampleCheck1">Check me out</label>
                    </div>
                    <button type="submit" class="btn btn-primary">Submit</button>
                </form>-->
                <?php
            break;
        }
    }
?>
<script>
const messages = <?php echo json_encode($messages); ?>;
</script>
<?php include_once('./layout/footer.php'); ?>
</body>
</html>
