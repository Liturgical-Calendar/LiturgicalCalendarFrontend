<?php 
const SWAGGER_UI_DIST_VERSION = '4.15.5';
?>
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui.css" >
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/favicon-16x16.png" sizes="16x16" />
    <style>
      html
      {
        box-sizing: border-box;
        overflow: -moz-scrollbars-vertical;
        overflow-y: scroll;
      }

      *,
      *:before,
      *:after
      {
        box-sizing: inherit;
      }

      body
      {
        margin:0;
        background: #fafafa;
      }
    </style>
  </head>

  <body>
    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui-bundle.js" crossorigin> </script>
    <script src="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui-standalone-preset.js" crossorigin> </script>
    <script>
    window.onload = function() {
      
      // Begin Swagger UI call region
      const ui = SwaggerUIBundle({
        url: "https://raw.githubusercontent.com/JohnRDOrazio/LiturgicalCalendar/master/schemas/openapi.json",
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
