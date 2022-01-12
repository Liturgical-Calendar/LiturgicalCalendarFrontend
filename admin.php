<?php

include_once("credentials.php");

function authenticated() {
    if ( !isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW']) ) return false;
    if ($_SERVER['PHP_AUTH_USER'] === AUTH_USERNAME && password_verify($_SERVER['PHP_AUTH_PW'], AUTH_PASSWORD)) return true;
    return false;
}
 ?>

<?php
if(!authenticated()) {
    header("WWW-Authenticate: Basic realm=\"Please insert your credentials\"");
    header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
    echo "You need a username and password to access this service.";
    die();
}

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );

if($isStaging) {
    die('Administration tools will not work correctly in the staging environment.');
}
$JSON = json_decode( file_get_contents( 'api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json' ), true );
$thh = array_keys( $JSON[0] );

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
    <table class="table">
        <thead>
            <tr>
                <?php
                    foreach( $thh as $th ) {
                        echo "<th>$th</th>";
                    }
                ?>
            </tr>
        </thead>
        <tbody>
            <?php
                foreach( $JSON as $row ) {
                    echo "<tr>";
                    foreach( $row as $value ) {
                        echo "<td>$value</td>";
                    }
                    echo "</tr>";
                }
            ?>
        </tbody>
    </table>
    <?php include_once('./layout/footer.php'); ?>
</body>
