<?php
const SWAGGER_UI_DIST_VERSION = '5.17.14';
$isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false );
$OpenAPISchema = $isStaging ? "development" : "master";
?><!DOCTYPE html><!-- HTML for static distribution bundle build -->
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui.css" >
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/index.css" >
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/favicon-16x16.png" sizes="16x16" />
  </head>

  <body>
    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui-bundle.js" crossorigin> </script>
    <script src="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui-standalone-preset.js" crossorigin> </script>
    <script>
    window.onload = function() {
      // Begin Swagger UI call region
      const ui = SwaggerUIBundle({
        url: "https://raw.githubusercontent.com/JohnRDOrazio/LiturgicalCalendar/<?php echo $OpenAPISchema; ?>/schemas/openapi.json",
        "dom_id": "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
      })
      // End Swagger UI call region

      window.ui = ui
    }
  </script>
  </body>
</html>
