const http = require("http");
const httpProxy = require("http-proxy");
const axios = require("axios");
const FormData = require("form-data");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const TARGET_URL = process.env.TARGET_URL;

const EMAIL = process.env.CARIN_USER;
const PASSWORD = process.env.CARIN_PASSWORD;

const myPort = process.env.PORT;

/**
 * Request the token from ZEISS ID via the ROPC-Flow
 * @return {Promise<string>} token
 */
async function acquireZeissIdAccessToken() {
  const res = await axios.get(
    "https://id-ip-stage.zeiss.com/.well-known/openid-configuration?p=B2C_1A_ZeissIdRopcSignIn"
  );

  const data = new FormData();
  data.append("username", EMAIL);
  data.append("password", PASSWORD);
  data.append("grant_type", "password");
  data.append("scope", "openid 27c7b441-bfe6-48e5-9b03-327b130e4f7a");
  data.append("client_id", "27c7b441-bfe6-48e5-9b03-327b130e4f7a");
  data.append("response_type", "id_token");

  const tokenRes = await axios.post(res.data.token_endpoint, data, {
    headers: data.getHeaders(),
  });
  // console.log("Token: ", tokenRes.data.access_token);
  return tokenRes.data.access_token;
}

acquireZeissIdAccessToken().then((zeissIdToken) => {
  console.log("Trying to start proxy....");
  // console.log("Token: ", zeissIdToken);

  var proxy = httpProxy.createProxyServer({
    secure: false,
    proxyTimeout: 40000,
  });

  http
    .createServer(function (req, res) {
      // console.log(`Bearer ${zeissIdToken}`);
      req.headers["Authorization"] = `Bearer ${zeissIdToken}`;
      delete req.headers.host;
      console.log(req.url);
      // Add headers to the response
      // res.setHeader('Cache-Control', 'public, max-age=86400');
      // res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString()); // Expiration time 1 day from now
      // res.setHeader('ETag', '12345'); // Optional: ETag for cache validation

      proxy.web(req, res, { target: TARGET_URL });
    })
    .listen(myPort);

  console.log("Proxy started on port " + myPort);
});
