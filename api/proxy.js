const { createProxyMiddleware } = require("http-proxy-middleware");
const axios = require("axios");
const FormData = require("form-data");

let zeissIdToken = null;

// Acquire token
async function acquireZeissIdAccessToken(email, password) {
  const res = await axios.get(
    "https://id-ip-stage.zeiss.com/.well-known/openid-configuration?p=B2C_1A_ZeissIdRopcSignIn"
  );

  const data = new FormData();
  data.append("username", email);
  data.append("password", password);
  data.append("grant_type", "password");
  data.append("scope", "openid 27c7b441-bfe6-48e5-9b03-327b130e4f7a");
  data.append("client_id", "27c7b441-bfe6-48e5-9b03-327b130e4f7a");
  data.append("response_type", "id_token");

  const tokenRes = await axios.post(res.data.token_endpoint, data, {
    headers: data.getHeaders(),
  });

  return tokenRes.data.access_token;
}

module.exports = async (req, res) => {
  if (!zeissIdToken) {
    zeissIdToken = await acquireZeissIdAccessToken(
      process.env.CARIN_USER,
      process.env.CARIN_PASSWORD
    );
  }

  const proxy = createProxyMiddleware({
    target: process.env.TARGET_URL,
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("Authorization", `Bearer ${zeissIdToken}`);
    },
  });

  return proxy(req, res, () => {});
};
