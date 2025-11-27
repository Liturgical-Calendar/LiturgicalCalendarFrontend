<?php

/**
 * Secure JSON file reader endpoint
 *
 * Reads JSON files from the assets directory only.
 * Implements path traversal protection by validating that resolved paths
 * stay within the allowed base directory.
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    die(json_encode(['error' => 'UNSUPPORTED_METHOD: ' . $_SERVER['REQUEST_METHOD'] . ', please use GET method']));
}

if (!isset($_GET['filename']) || $_GET['filename'] === '') {
    http_response_code(400);
    die(json_encode(['error' => 'MISSING_PARAMS: "filename" param is required']));
}

$requestedFile = $_GET['filename'];

// Reject URLs (prevent SSRF attacks)
if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $requestedFile)) {
    http_response_code(400);
    die(json_encode(['error' => 'INVALID_REQUEST: URLs are not allowed']));
}

// Define the allowed base directory (assets folder)
$baseDir = realpath(__DIR__ . '/../assets');
if ($baseDir === false) {
    http_response_code(500);
    die(json_encode(['error' => 'SERVER_ERROR: Base directory not found']));
}

// Build the target path and resolve it
$targetPath   = $baseDir . DIRECTORY_SEPARATOR . ltrim($requestedFile, '/\\');
$resolvedPath = realpath($targetPath);

// Validate the resolved path
if ($resolvedPath === false) {
    http_response_code(404);
    die(json_encode(['error' => 'FILE_NOT_FOUND: Requested file does not exist']));
}

// Ensure the resolved path is within the base directory (prevent path traversal)
if (strpos($resolvedPath, $baseDir . DIRECTORY_SEPARATOR) !== 0) {
    http_response_code(403);
    die(json_encode(['error' => 'ACCESS_DENIED: Path traversal not allowed']));
}

// Ensure it's a regular file (not a directory or symlink to outside)
if (!is_file($resolvedPath)) {
    http_response_code(400);
    die(json_encode(['error' => 'INVALID_REQUEST: Target is not a file']));
}

// Ensure it's a JSON file
if (strtolower(pathinfo($resolvedPath, PATHINFO_EXTENSION)) !== 'json') {
    http_response_code(400);
    die(json_encode(['error' => 'INVALID_REQUEST: Only JSON files are allowed']));
}

// Read the file
$data = file_get_contents($resolvedPath);
if ($data === false) {
    http_response_code(500);
    die(json_encode(['error' => 'FILE_READ_ERROR: Could not read file']));
}

// Validate JSON
$jsonData = json_decode($data);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    die(json_encode(['error' => 'JSON_ERROR: ' . json_last_error_msg()]));
}

echo $data;
exit(0);
