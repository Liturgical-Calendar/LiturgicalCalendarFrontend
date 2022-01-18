<?php

include_once("credentials.php");

function authenticated() {
    if ( !isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW']) ) return false;
    if ($_SERVER['PHP_AUTH_USER'] === AUTH_USERNAME && password_verify($_SERVER['PHP_AUTH_PW'], AUTH_PASSWORD)) return true;
    return false;
}

if(!authenticated()) {
    header("WWW-Authenticate: Basic realm=\"Please insert your credentials\"");
    header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
    echo "You need a username and password to access this service.";
    die();
}

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );

if($isStaging) {
    $JSON = json_decode( file_get_contents( 'https://litcal.johnromanodorazio.com/api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json' ), true );
    $thh = array_keys( $JSON[0] );
} else {
    $JSON = json_decode( file_get_contents( 'api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json' ), true );
    $thh = array_keys( $JSON[0] );
    //$months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
}
?>
<!DOCTYPE html>
<head>
    <title>Administration tools</title>
    <?php include_once('./layout/head.php'); ?>
</head>

<body>
    <?php include_once('./layout/header.php'); ?>
    <h1>Liturgical Calendar project Administration tools</h1>
    <div class="form-group col-md">
        <label>Select JSON file to manage:</label>
        <select class="form-control" id="jsonFileSelect">
            <option value="api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json">propriumdesanctis_1970.json</option>
            <option value="api/dev/data/propriumdesanctis_2002/propriumdesanctis_2002.json">propriumdesanctis_2002.json</option>
            <option value="api/dev/data/propriumdesanctis_ITALY_1983/propriumdesanctis_ITALY_1983.json">propriumdesanctis_ITALY_1983.json</option>
            <option value="api/dev/data/propriumdesanctis_USA_2011/propriumdesanctis_USA_2011.json">propriumdesanctis_USA_2011.json</option>
            <option value="api/dev/data/propriumdetempore.json">propriumdetempore.json</option>
        </select>
    </div>
    <div class="row m-2 justify-content-end">
        <button class="btn btn-primary mr-2" id="addColumnBtn"><i class="fas fa-plus-square mr-2"></i>Add Column<i class="fas fa-columns ml-2"></i></button>
        <button class="btn btn-primary mr-2" id="saveDataBtn"><i class="fas fa-save mr-2"></i>Save data</button>
    </div>
    <div id="tableContainer">
        <table class="table" id="jsonDataTbl">
            <thead class="bg-secondary text-white sticky-top">
                <tr>
                    <?php
                        $i = 0;
                        $n = [0, 10, 10, 14, 5, 25, 0, 6, 30 ];
                        foreach( $thh as $th ) {
                            echo "<th class=\"sticky-top\" style=\"width: {$n[$i++]}%;\" scope=\"col\">$th</th>";
                        }
                    ?>
                </tr>
            </thead>
            <tbody>
                <?php
                    foreach( $JSON as $row ) {
                        echo "<tr>";
                        foreach( $row as $value ) {
                            if( is_array( $value ) ) {
                                echo "<td contenteditable='false'>";
                                echo "<table><tbody>";
                                foreach( $value as $title => $val ) {
                                    echo "<tr><td>$title</td><td contenteditable='false'>$val</td></tr>";
                                }
                                echo "</tbody></table>";
                                echo "</td>";
                            } else {
                                echo "<td contenteditable='false'>$value</td>";
                            }
                        }
                        echo "</tr>";
                    }
                ?>
            </tbody>
        </table>
    </div>
    <?php include_once('./layout/footer.php'); ?>
</body>
