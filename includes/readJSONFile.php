<?php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['filename'])) {
        die(json_encode(['error' => 'MISSING_PARAMS: "filename" param is required']));
    }
    $data = file_get_contents($_GET['filename']);
    if ($data === false) {
        die(json_encode(['error' => 'FILE_READ_ERROR: Could not read file']));
    }
    $jsonData = json_decode($data);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo $data;
        exit(0);
    } else {
        die(json_encode(['error' => 'JSON_ERROR: ' . json_last_error_msg() ]));
    }
} else {
    die(json_encode(['error' => 'UNSUPPORTED_METHOD: ' . $_SERVER['REQUEST_METHOD'] . ', please use GET method']));
}
