<?php

header('Content-Type: text/plain');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_POST['filename']) || !isset($_POST['jsondata'])) {
        die('MISSING_PARAMS: "filename" and "jsondata" params are required');
    }
    if (file_exists('../' . $_POST['filename'])) {
        $jsonData = json_decode($_POST['jsondata']);
        if (json_last_error() === JSON_ERROR_NONE) {
            file_put_contents('../' . $_POST['filename'], $_POST['jsondata']);
            die('SUCCESS');
        } else {
            die('JSON_ERROR: ' . json_last_error_msg());
        }
    } else {
        die('NON_EXISTENT_FILE: ' . $_POST['filename']);
    }
} else {
    die('UNSUPPORTED_METHOD: ' . $_SERVER['REQUEST_METHOD']);
}
