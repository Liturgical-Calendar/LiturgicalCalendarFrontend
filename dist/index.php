<?php
const SWAGGER_UI_DIST_VERSION = '5.17.14';
$isStaging = (strpos($_SERVER['HTTP_HOST'], "-staging") !== false || strpos($_SERVER['HTTP_HOST'], "localhost") !== false);
$OpenAPISchema = $isStaging ? "development" : "master";
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
        url: "https://raw.githubusercontent.com/JohnRDOrazio/LiturgicalCalendar/<?php echo $OpenAPISchema; ?>/schemas/openapi.json",
        "dom_id": "#swagger-ui",
        deepLinking: true,
        requestSnippetsEnabled: true,
        requestSnippets: {
          generators: {
            curl_bash: {
              title: "cURL (bash)",
              syntax: "bash"
            },
            curl_powershell: {
              title: "cURL (PowerShell)",
              syntax: "powershell"
            },
            curl_cmd: {
              title: "cURL (CMD)",
              syntax: "bash"
            },
            node_native: {
              title: "NodeJs Native",
              syntax: "javascript"
            },
            js_fetch: {
              title: "Javascript",
              syntax: "javascript"
            },
            python: {
              title: "Python",
              syntax: "python"
            },
            php: {
              title: "PHP",
              syntax: "php"
            },
            ruby: {
              title: "Ruby",
              syntax: "ruby"
            },
            java: {
              title: "Java",
              syntax: "java"
            },
            go: {
              title: "Go",
              syntax: "go"
            }
          },
          defaultExpanded: true,
          languages: ['curl_bash', 'curl_powershell', 'curl_cmd', 'node_native', 'js_fetch', 'python', 'php', 'ruby', 'java', 'go']
        },
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
          SnippetGeneratorNodeJsPlugin,
          SnippetGeneratorJsFetchPlugin,
          SnippetGeneratorPythonPlugin,
          SnippetGeneratorPHPPlugin,
          SnippetGeneratorRubyPlugin,
          SnippetGeneratorJavaPlugin,
          SnippetGeneratorGoPlugin
        ],
        layout: "StandaloneLayout",
      })
      // End Swagger UI call region

      window.ui = ui
    }

    const SnippetGeneratorNodeJsPlugin = {
      fn: {
        // use `requestSnippetGenerator_` + key from config (node_native) for generator fn
        requestSnippetGenerator_node_native: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
          return `const http = require("${packageStr}");
const options = {
  "method": "${request.get("method")}",
  "hostname": "${url.host}",
  "port": ${url.port || "null"},
  "path": "${url.pathname}"${headers && headers.size ? `,
  "headers": {
    ${headers.map((val, key) => `"${key}": "${val}"`).valueSeq().join(",\n    ")}
  }` : ""}
};
const req = http.request(options, function (res) {
  const chunks = [];
  res.on("data", function (chunk) {
    chunks.push(chunk);
  });
  res.on("end", function () {
    const body = Buffer.concat(chunks);
    const jsonBody = JSON.parse(body.toString());
    console.log(jsonBody);
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
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
          return `const options = {
  "method": "${request.get("method")}"${headers && headers.size ? `,
  "headers": {
    ${headers.map((val, key) => `"${key}": "${val}"`).valueSeq().join(",\n    ")}
  }` : ""}${reqBody ? `,
  "body": ${stringBody}` : ""}
};
fetch("${url}", options)
  .then(response => response.json())
  .then(data => console.log(data))
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
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
  $jsonData = json_decode($response);
  echo $response;
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
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
              headersStr += `  "${key}" => "${val}",\n`;
            });
            headersStr = headersStr.trim().slice(0, -1); // Remove the last comma and newline
            headersStr += "\n}";
          }

          return `require 'net/http'
require 'uri'
require 'json'

uri = URI.parse("${url}")
request = Net::HTTP::${request.get("method")}.new(uri)${headersStr ? `
${headersStr}
request.initialize_http_header(headers)` : ''}${reqBody ? `
request.body = ${isJsonBody ? 'JSON.generate(' : '"'}${reqBody}${isJsonBody ? ')' : '"'}` : ''}

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
  http.request(request)
end

response_json = JSON.parse(response.body)
puts response.body`;
        }
      }
    },
    SnippetGeneratorJavaPlugin = {
      fn: {
        requestSnippetGenerator_java: (request) => {
          const url = new URL(request.get("url"));
          let isMultipartFormDataRequest = false;
          let isJsonBody = false;
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
            /*headersStr = 'conn.setRequestProperty("';
            headers.forEach((val, key) => {
              headersStr += `${key}", "${val}");\n      conn.setRequestProperty("`;
            });
            headersStr = headersStr.slice(0, -24); // Remove the last `conn.setRequestProperty("`*/
          }

          return `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class Main {
  public static void main(String[] args) {
    try {
      URL url = new URL("${url}");
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("${request.get("method").toUpperCase()}");
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
      System.out.println(response.toString());
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
          const headers = request.get("headers");
          if (headers && headers.size) {
            headers.map((val, key) => {
              isMultipartFormDataRequest = isMultipartFormDataRequest || /^content-type$/i.test(key) && /^multipart\/form-data$/i.test(val);
              isJsonBody = isJsonBody || /^content-type$/i.test(key) && /^application\/json$/i.test(val);
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
            headersStr = 'req.Header.Set("';
            headers.forEach((val, key) => {
              headersStr += `${key}", "${val}");\nreq.Header.Set("`;
            });
            headersStr = headersStr.slice(0, -16); // Remove the last `req.Header.Set("`
          }

          return `package main

import (
  "fmt"
  "io/ioutil"
  "net/http"
  "strings"
)

func main() {
  url := "${url}"
  method := "${request.get("method").toUpperCase()}"

  payload := strings.NewReader(${isJsonBody ? reqBody : `"${reqBody}"`})

  client := &http.Client {}
  req, err := http.NewRequest(method, url, payload)

  if err != nil {
    fmt.Println(err)
    return
  }
${headersStr ? `
  ${headersStr}
` : ''}

  res, err := client.Do(req)
  if err != nil {
    fmt.Println(err)
    return
  }
  defer res.Body.Close()

  body, err := ioutil.ReadAll(res.Body)
  if err != nil {
    fmt.Println(err)
    return
  }
  fmt.Println(string(body))
}`;
        }
      }
    }
  </script>
</body>

</html>
