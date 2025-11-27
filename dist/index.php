<?php
// phpcs:disable PSR1.Files.SideEffects
const SWAGGER_UI_DIST_VERSION = '5.30.2';

include_once(dirname(__DIR__) . '/vendor/autoload.php');

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(dirname(__DIR__), ['.env', '.env.local', '.env.development', '.env.staging', '.env.production'], false);
$dotenv->ifPresent(['API_PROTOCOL', 'API_HOST', 'API_BASE_PATH'])->notEmpty();
$dotenv->ifPresent(['API_PORT'])->isInteger();
$dotenv->safeLoad();

// Set default environment variables if not already set
$_ENV['API_PROTOCOL']  = $_ENV['API_PROTOCOL'] ?? 'https';
$_ENV['API_HOST']      = $_ENV['API_HOST'] ?? 'litcal.johnromanodorazio.com';
$_ENV['API_PORT']      = $_ENV['API_PORT'] ?? '';
$_ENV['API_BASE_PATH'] = $_ENV['API_BASE_PATH'] ?? '/api/dev';

// Build Base API URL
$apiPort    = !empty($_ENV['API_PORT']) ? ":{$_ENV['API_PORT']}" : '';
$apiBaseUrl = rtrim("{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}{$apiPort}{$_ENV['API_BASE_PATH']}", '/');

// OpenAPI schema is served by the API at /schemas/openapi.json
$openAPISchemaUrl = $apiBaseUrl . '/schemas/openapi.json';

// Determine if we're running on localhost
$isLocalhost = $_ENV['API_HOST'] === 'localhost' || $_ENV['API_HOST'] === '127.0.0.1';
?>
<!DOCTYPE html><!-- HTML for static distribution bundle build -->
<html lang="en">

<head>
  <meta charset="UTF-8">
  <title>Swagger UI</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/swagger-ui.css">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@<?php echo SWAGGER_UI_DIST_VERSION; ?>/index.css">
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
        url: "<?php echo $openAPISchemaUrl; ?>",
        "dom_id": "#swagger-ui",
        deepLinking: true,
        // Rewrite requests to use current environment's API URL
        requestInterceptor: (req) => {
          const currentApiBase = "<?php echo $apiBaseUrl; ?>";
          const currentBasePath = "<?php echo rtrim($_ENV['API_BASE_PATH'], '/'); ?>";
          const url = new URL(req.url);
          const currentBase = new URL(currentApiBase);
          // Replace protocol and host
          url.protocol = currentBase.protocol;
          url.host = currentBase.host;
          // Replace schema's base path with current environment's base path
          // The schema likely has /api/dev, but localhost uses /
          const schemaBasePaths = ['/api/dev', '/api/stable'];
          let path = url.pathname;
          for (const schemaBase of schemaBasePaths) {
            if (path.startsWith(schemaBase)) {
              path = currentBasePath + path.substring(schemaBase.length);
              break;
            }
          }
          url.pathname = path;
          req.url = url.toString();
          return req;
        },
        requestSnippetsEnabled: true,
        requestSnippets: {
          generators: {
            curl_bash: {
              title: "cURL (bash)",
              syntax: "bash",
              default: true
            },
            curl_powershell: {
              title: "cURL (PowerShell)",
              syntax: "powershell"
            },
            curl_cmd: {
              title: "cURL (CMD)",
              syntax: "bash"
            },
            go: {
              title: "Go",
              syntax: "go"
            },
            java: {
              title: "Java",
              syntax: "java"
            },
            js_fetch: {
              title: "Javascript",
              syntax: "javascript"
            },
            node_native: {
              title: "NodeJs Native",
              syntax: "javascript"
            },
            php: {
              title: "PHP",
              syntax: "php"
            },
            python: {
              title: "Python",
              syntax: "python"
            },
            ruby: {
              title: "Ruby",
              syntax: "ruby"
            },
            csharp: {
              title: "C#",
              syntax: "csharp"
            },
            vb_net: {
              title: "VB.NET",
              syntax: "vbnet"
            }
          },
          defaultExpanded: true,
          languages: ['curl_bash', 'curl_powershell', 'curl_cmd', 'go', 'java', 'js_fetch', 'node_native', 'php', 'python', 'ruby', 'csharp', 'vb_net']
        },
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
          SnippetGeneratorGoPlugin,
          SnippetGeneratorJavaPlugin,
          SnippetGeneratorJsFetchPlugin,
          SnippetGeneratorNodeJsPlugin,
          SnippetGeneratorPHPPlugin,
          SnippetGeneratorPythonPlugin,
          SnippetGeneratorRubyPlugin,
          SnippetGeneratorCsPlugin,
          SnippetGeneratorVbNetPlugin<?php
            if (!$isLocalhost) :
          ?>,
          DisableAuthTryItOutPlugin<?php
            endif;
          ?>
        ],
        layout: "StandaloneLayout",
      })
      // End Swagger UI call region

      window.ui = ui
    }

<?php if (!$isLocalhost) :
?>
    // Plugin to disable "Try it out" for auth endpoints in staging/production
    const DisableAuthTryItOutPlugin = {
      statePlugins: {
        spec: {
          wrapSelectors: {
            allowTryItOutFor: () => (state, path) => {
              const disabledPaths = ['/auth/login', '/auth/refresh'];
              return !disabledPaths.some(disabled => path.includes(disabled));
            }
          }
        }
      }
    };
<?php endif; ?>

    const SnippetGeneratorNodeJsPlugin = {
      fn: {
        // use `requestSnippetGenerator_` + key from config (node_native) for generator fn
        requestSnippetGenerator_node_native: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          const packageStr = url.protocol === "https:" ? "https" : "http";
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (reqBody instanceof Map) {
                const {
                  body,
                  credentials,
                  curlOptions,
                  headers,
                  method,
                  requestInterceptor,
                  responseInterceptor,
                  url
                } = Object.fromEntries(reqBody._list._tail.array.map(([v, k]) => [v, k]));
              } else {
                if (typeof reqBody !== "string") {
                  reqBody = JSON.stringify(reqBody);
                }
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }
          reqBody = (reqBody || "")
              .replace(/\\n/g, "\n")
              .replace(/`/g, "\\`");
          const stringBody = `${isJsonBody ? 'JSON.stringify(' : `"`}` + reqBody + `${isJsonBody ? ')' : `"`}`;
          return `const HTTP = require("${packageStr}");
${isYamlResponse ? `// npm install yaml
const YAML = require('yaml');` : isXMLResponse ? `//npm install xml2js
const XML2JS = require('xml2js');` : ''}
const options = {
  "method": "${request.get("method")}",
  "hostname": "${url.host}",
  "port": ${url.port || "null"},
  "path": "${url.pathname}"${headers && headers.size ? `,
  "headers": {
    ${headers.map((val, key) => `"${key}": "${val}"`).valueSeq().join(",\n    ")}
  }` : ""}
};
const req = HTTP.request(options, function (res) {
  const chunks = [];
  res.on("data", function (chunk) {
    chunks.push(chunk);
  });
  res.on("end", function () {
    const body = Buffer.concat(chunks);
    ${isJsonResponse ? `const jsonResponse = JSON.parse(body.toString());
    console.log(jsonBody);`
      : isYamlResponse ? 'const yamlResponse = YAML.parse(body.toString());'
      : isXMLResponse ? `XML2JS.Parser.parseStringPromise(body.toString()).then(result => {
      console.dir(result);
    })
    .catch(error => {
      console.error(error);
    });`
      : 'console.log(body.toString());'}
  });
});
${reqBody ? `\nreq.write(${stringBody});` : ""}
req.end();`;
        }
      }
    },
    SnippetGeneratorJsFetchPlugin = {
      fn: {
        // use `requestSnippetGenerator_` + key from config (node_native) for generator fn
        requestSnippetGenerator_js_fetch: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (reqBody instanceof Map) {
                const {
                  body,
                  credentials,
                  curlOptions,
                  headers,
                  method,
                  requestInterceptor,
                  responseInterceptor,
                  url
                } = Object.fromEntries(reqBody._list._tail.array.map(([v, k]) => [v, k]));
              } else {
                if (typeof reqBody !== "string") {
                  reqBody = JSON.stringify(reqBody);
                }
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }
          reqBody = (reqBody || "")
              .replace(/\\n/g, "\n")
              .replace(/`/g, "\\`");
          if(isJsonBody) {
            reqBody = reqBody.split("\n").join(`\n  `);
          }
          const stringBody = `${isJsonBody ? 'JSON.stringify(' : `"`}` + reqBody +
            `${isJsonBody ? ')' : `"`}`;
          return `// N.B. browser fetch to the litcal domain will not work
//      unless the domain from which the fetch call is made
//      has been registered with the litcal project${isYamlResponse ? `
// To enable yaml parsing you will have to load a script capable of doing this,
//   such as https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js` : ''}
const options = {
  "method": "${request.get("method")}"${headers && headers.size ? `,
  "headers": {
    ${headers.map((val, key) => `"${key}": "${val}"`).valueSeq().join(",\n    ")}
  }` : ""}${reqBody ? `,
  "body": ${stringBody}` : ""}
};
fetch("${url}", options)
  .then(response => ${isJsonResponse ? `response.json())
  .then(data => console.log(data))` : isYamlResponse ? `response.text())
  .then(text => {
    const yaml = jsyaml.load(text);
    console.log(yaml);
  })` : isXMLResponse ? `response.text())
  .then(text => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text,"text/xml");
    console.log(xmlDoc);
  })` : `response.text())
  .then(data => console.log(data))` }
  .catch(error => console.error('Error:', error));`;
        }
      }
    },
    SnippetGeneratorPythonPlugin = {
      fn: {
        // use `requestSnippetGenerator_` + key from config (node_native) for generator fn
        requestSnippetGenerator_python: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let headersStr = '';
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (reqBody instanceof Map) {
                const {
                  body,
                  credentials,
                  curlOptions,
                  headers,
                  method,
                  requestInterceptor,
                  responseInterceptor,
                  url
                } = Object.fromEntries(reqBody._list._tail.array.map(([v, k]) => [v, k]));
              } else {
                if (typeof reqBody !== "string") {
                  reqBody = JSON.stringify(reqBody);
                }
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }
          reqBody = isJsonBody ? reqBody.replaceAll(': true', ': True').replaceAll(': false', ': False') : reqBody;
          return `import requests

url = "${url}"
headers = {${headers && headers.size ? `
  ${headers.map((val, key) => `"${key}": "${val}"`).valueSeq().join(",\n  ")}` : ""}
}
${reqBody ? `payload = ${isJsonBody ? '' : '"'}${reqBody}${isJsonBody ? '' : '"'}\n` : ''}

response = requests.request("${request.get("method")}", url, headers=headers${reqBody ? `, ${isJsonBody ? 'json' : 'data'}=payload` : ''})

data = response.json()`;
        }
      }
    },
    SnippetGeneratorPHPPlugin = {
      fn: {
        requestSnippetGenerator_php: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let headersStr = '';
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }

          if (headers && headers.size) {
            headersStr = "$headers = [\n";
            headers.forEach((val, key) => {
              headersStr += `    "${key}" => "${val}",\n`;
            });
            headersStr = headersStr.trim().slice(0, -1); // Remove the last comma and newline
            headersStr += "\n];";
          }

          return '<' + `?php
${isYamlResponse ? `// php-yaml extension required` : isICSResponse ? `// composer require sabre/vobject
require 'vendor/autoload.php';
use Sabre\\VObject;
` : ''}
$curl = curl_init();
${headersStr ? `${headersStr}\n` : ''}${isJsonBody ? `$payload = <<<JSON\n${reqBody}\nJSON;\n` : ''}
curl_setopt_array($curl, array(
  CURLOPT_URL => "${url}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "${request.get("method").toUpperCase()}"${reqBody ? `,
  CURLOPT_POSTFIELDS => ${isJsonBody ? '$payload' : `"${reqBody}"`}` : ''}${headersStr ? `,
  CURLOPT_HTTPHEADER => $headers` : ''}
));

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
  ${isJsonResponse ? `$jsonData = json_decode($response);` : isYamlResponse ? `$yamlData = yaml_parse($response);` : isXMLResponse ? `$xml = new DOMDocument();
  $xml->loadXML($response);
` : isICSResponse ? `try {
    $vcalendar = VObject\\Reader::read($data);
  } catch (VObject\\ParseException $ex) {
    echo $ex->message;
  }` : '' }
}`;
        }
      }
    },
    SnippetGeneratorRubyPlugin = {
      fn: {
        requestSnippetGenerator_ruby: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let headersStr = '';
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }

          if (headers && headers.size) {
            headersStr = "headers = {\n";
            headers.forEach((val, key) => {
              headersStr += `  '${key}' => '${val}',\n`;
            });
            headersStr = headersStr.trim().slice(0, -1); // Remove the last comma and newline
            headersStr += "\n}";
          }
          const reqMethod = request.get("method")[0].toUpperCase() + request.get("method").slice(1).toLowerCase();
          return `# frozen_string_literal: true

require 'net/http'
require 'uri'${(isJsonBody || isJsonResponse) ? "\nrequire 'json'" : ''}${isYamlResponse
  ? "\nrequire 'yaml'"
  : isXMLResponse ? "\nrequire 'nokogiri'" : ''}

uri = URI.parse('${url}')
request = Net::HTTP::${reqMethod}.new(uri)${headersStr ? `
${headersStr}
request.initialize_http_header(headers)` : ''}${reqBody ? `
request.body = ${isJsonBody ? 'JSON.generate(' : "'"}${reqBody}${isJsonBody ? ')' : "'"}` : ''}

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
  http.request(request)
end

${isJsonResponse
  ? `response_json = JSON.parse(response.body)
puts response_json`
  : isYamlResponse ? `response_yaml = YAML.load(response.body)
puts response_yaml.to_ruby.to_yaml`
  : isXMLResponse ? `response_xml = Nokogiri::XML(response.body)
puts response_xml`
  : `
puts response.body` }`;
        }
      }
    },
    SnippetGeneratorJavaPlugin = {
      fn: {
        requestSnippetGenerator_java: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let headersStr = '';
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }
          let reqBodyJson = isJsonBody ? JSON.parse(reqBody) : null;
          reqBodyStr = isJsonBody
            ? `"{" +
${Object.entries(reqBodyJson).map(([key,value]) => `          "\\\"${key}\\\": \\\"${value}\\\"," +\n` ).join('') }          "}"`
            : `"${reqBody}"`;
          if (headers && headers.size) {
            headersStr = `${headers.map((val, key) => `conn.setRequestProperty("${key}", "${val}");`).valueSeq().join("\n      ")}`;
          }

          return `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;${isJsonResponse || isYamlResponse ? `
import java.io.StringReader;` : ''}
import java.net.HttpURLConnection;
import java.net.URL;${isJsonResponse ? `
// Add a package with JSON reading capabilities to classpath,
//   for example w/Maven pkg:maven/jakarta.json/jakarta.json-api@2.1.3
//   together with pkg:maven/org.eclipse.parsson/parsson@1.1.6 (for parsing)
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;` : isYamlResponse ? `
// Add a package with YAML reading capabilities to classpath,
//   for example w/Maven pkg:maven/org.yaml/snakeyaml@2.2
import java.util.Map;
import org.yaml.snakeyaml.Yaml;` : ''}

public class Main {
  public static void main(String[] args) {
    try {
      URL url = new URL("${url}");
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("${request.get("method")}");
${headersStr ? `
      ${headersStr}
` : ''}${reqBody ? `
      conn.setDoOutput(true);
      try(OutputStream os = conn.getOutputStream()) {
        String inputStr = ${reqBodyStr};
        byte[] input = inputStr.getBytes("utf-8");
        os.write(input, 0, input.length);
      }` : ''}
      BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
      StringBuilder response = new StringBuilder();
      String responseLine = null;
      while ((responseLine = br.readLine()) != null) {
        response.append(responseLine.trim());
      }
      ${isJsonResponse ? `
      final JsonReader jsonReader = Json.createReader(new StringReader(response.toString()));
      final JsonObject json = jsonReader.readObject();
      final JsonObject litCal = json.getJsonObject("LitCal");
      final int litCalEventsCount = litCal.size();
      System.out.println(String.format("Received %d liturgical events from the API call", litCalEventsCount));
      ` : isYamlResponse ? `
      final Yaml yaml = new Yaml();
      Map<String, Map<String, Object>> doc = yaml.load(new StringReader(response.toString()));
      System.out.println(doc);` : `
      System.out.println(response.toString());`}
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}`;
        }
      }
    },
    SnippetGeneratorGoPlugin = {
      fn: {
        requestSnippetGenerator_go: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }
          let headersStr = '';
          let reqBody = request.get("body");
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
            }
          } else if (!reqBody && request.get("method") === "POST") {
            reqBody = "";
          }

          if (headers && headers.size) {
            headersStr = `${headers.map((val, key) => `req.Header.Set("${key}", "${val}");`).valueSeq().join("\n  ")}`;
          }

          return `package main

import (${reqBody ? (isJsonBody ? `
  "bytes"` : `
  "strings"`) : ''}
  "fmt"
  "io"
  "net/http"${isJsonResponse ? `
  "encoding/json"` : isYamlResponse ? `
  "gopkg.in/yaml.v3"` : isXMLResponse ? `
  "encoding/xml"` : ''}
)

func main() {
  url := "${url}"
  method := "${request.get("method")}"${reqBody ? `

  payload := ${isJsonBody ? `[]byte(\`${reqBody}\`)` : `strings.NewReader("${reqBody}")`}` : ''}

  client := &http.Client {}
  req, err := http.NewRequest(method, url, ${reqBody ? `${isJsonBody ? 'bytes.NewBuffer(payload)' : 'payload'}` : 'nil'})

  if err != nil {
    fmt.Println(err)
    return
  }${headersStr ? `

  ${headersStr}` : ''}

  res, err := client.Do(req)
  if err != nil {
    fmt.Println(err)
    return
  }
  defer res.Body.Close()

  body, err := io.ReadAll(res.Body)
  if err != nil {
    fmt.Println(err)
    return
  }${isJsonResponse ? `
  obj := make(map[string]interface{})
  json.Unmarshal(body, &obj)
  fmt.Println(obj)` : isYamlResponse ? `
  obj := make(map[string]interface{})
  yaml.Unmarshal(body, &obj)
  fmt.Println(obj)` : isXMLResponse ? `
  obj := make(map[string]interface{})
  xml.Unmarshal(body, &obj)
  fmt.Println(obj)` : `
  fmt.Println(string(body))`}
}`;
        }
      }
    },
    SnippetGeneratorCsPlugin = {
      fn: {
        requestSnippetGenerator_csharp: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");

          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }

          let reqBody = request.get("body");
          let bodyStr = '';
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
              bodyStr = isJsonBody ? `@"${reqBody.replaceAll('"', '""') }"` : `"${reqBody}"`;
            }
          }

          return `using System.Net.Http.Headers;${isJsonResponse ? `
using System.Text.Json;` : isYamlResponse ? `
using YamlDotNet.Serialization;` : isXMLResponse ? `
using System.Xml;` : ""}

class Program
{
    static readonly HttpClient client = new HttpClient();
    static async Task Main()
    {
        try
        {${request.get("method") === 'GET' ? `
            Stream responseBody = await client.GetStreamAsync("${url}");` : request.get("method") === 'POST' ? `
            var httpContent = new StringContent(${bodyStr});${isJsonBody ? `
            httpContent.Headers.ContentType = new MediaTypeWithQualityHeaderValue("application/json");` : `
            httpContent.Headers.ContentType = new MediaTypeWithQualityHeaderValue("application/x-www-form-urlencoded");`}
            using HttpResponseMessage response = await client.PostAsync("${url}",httpContent);
            response.EnsureSuccessStatusCode();
            Stream responseBody = await response.Content.ReadAsStreamAsync();` : ''}
            using var streamReader = new StreamReader(responseBody);
            var responseText = streamReader.ReadToEnd();${isJsonResponse ? `
            var jsonDocument = JsonDocument.Parse(responseText);
            Console.WriteLine(jsonDocument.RootElement);` : isYamlResponse ? `
            var deserializer = new Deserializer();
            var yamlObject = deserializer.Deserialize(new StringReader(responseText));
            Console.WriteLine(yamlObject);` : isXMLResponse ? `
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(responseText);
            Console.WriteLine(xmlDoc.InnerXml);` : `
            Console.WriteLine(responseText);`}
        }
        catch (HttpRequestException e)
        {
            Console.WriteLine("Exception Caught!");
            Console.WriteLine("Message :{0} ", e.Message);
        }
    }
}`;
        }
      }
    },
    SnippetGeneratorVbNetPlugin = {
      fn: {
        requestSnippetGenerator_vb_net: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          let isJsonResponse = false;
          let isXMLResponse = false;
          let isYamlResponse = false;
          let isICSResponse = false;
          const headers = request.get("headers");

          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
              isJsonResponse = isJsonResponse || /^accept$/i.test(key) && /^application\/json$/i.test(val);
              isXMLResponse = isXMLResponse || /^accept$/i.test(key) && /^application\/xml$/i.test(val);
              isYamlResponse = isYamlResponse || /^accept$/i.test(key) && /^application\/yaml$/i.test(val);
              isICSResponse = isICSResponse || /^accept$/i.test(key) && /^text\/calendar$/i.test(val);
            });
          }

          let reqBody = request.get("body");
          let bodyStr = '';
          if (reqBody) {
            if (isMultipartFormDataRequest && ["POST", "PUT", "PATCH"].includes(request.get("method"))) {
              return "throw new Error(\"Currently unsupported content-type: /^multipart\\/form-data$/i\");";
            } else {
              if (typeof reqBody !== "string") {
                reqBody = JSON.stringify(reqBody);
              }
              bodyStr = isJsonBody ? `@"${reqBody.replaceAll('"', '""') }"` : `"${reqBody}"`;
              //bodyStr = `Dim content = New StringContent("${reqBody}", Encoding.UTF8, "application/json")`;
            }
          }

          return `Imports System.Net.Http.Headers${isJsonResponse ? `
Imports System.Text.Json` : isYamlResponse ? `
Imports YamlDotNet.Serialization` : isXMLResponse ? `
Imports System.Xml` : ""}

Module Program
    Private ReadOnly client As New HttpClient()

    Async Function Main(args As String()) As Task
        Try${request.get("method") === 'GET' ? `
          Dim responseBody As Stream = Await client.GetStreamAsync("${url}");` : request.get("method") === 'POST' ? `
          Dim httpContent = New StringContent(${bodyStr});${isJsonBody ? `
          httpContent.Headers.ContentType = New MediaTypeWithQualityHeaderValue("application/json");` : `
          httpContent.Headers.ContentType = New MediaTypeWithQualityHeaderValue("application/x-www-form-urlencoded");`}
          Dim response As HttpResponseMessage = Await client.PostAsync("${url}",httpContent);
          response.EnsureSuccessStatusCode()
          Dim responseBody As Stream = Await response.Content.ReadAsStreamAsync()` : ''}
          Dim streamReader = New StreamReader(responseBody)
          Dim responseText = streamReader.ReadToEnd()${isJsonResponse ? `
          Dim jsonDocument = JsonDocument.Parse(responseText)
          Console.WriteLine(jsonDocument.RootElement)` : isYamlResponse ? `
          Dim deserializer = New Deserializer()
          Dim yamlObject = deserializer.Deserialize(New StringReader(responseText))
          Console.WriteLone(yamlObject)` : isXMLResponse ? `
          Dim xmlDoc = New XmlDocument()
          xmlDoc.LoadXml(responseText)
          Console.WriteLine(xmlDoc.InnerXml)` : `
          Console.WriteLine(responseText)`}
        Catch ex As HttpRequestException
            Console.WriteLine("Exception Caught!")
            Console.WriteLine("Message :{0} ", e.Message)
        End Try
    End Function
End Module`;
        }
      }
    };

  </script>
</body>

</html>
