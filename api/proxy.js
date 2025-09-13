// api/proxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");
const axios = require("axios");
const FormData = require("form-data");

let zeissIdToken = null;

// Acquire Zeiss ID Access Token
async function acquireZeissIdAccessToken(email, password) {
  console.log("🔑 Acquiring new Zeiss ID access token...");

  try {
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

    console.log("✅ Successfully acquired access token.");
    return tokenRes.data.access_token;
  } catch (err) {
    console.error("❌ Failed to acquire Zeiss ID access token:", err.message);
    throw err;
  }
}

module.exports = async (req, res) => {
  console.log("➡️ Incoming request:", req.url);

  try {
    if (!zeissIdToken) {
      console.log("⚠️ No token cached. Fetching...");
      zeissIdToken = await acquireZeissIdAccessToken(
        process.env.CARIN_USER,
        process.env.CARIN_PASSWORD
      );
    } else {
      console.log("✅ Using cached Zeiss ID token.");
    }

    const path = req.query.path || "";
    console.log(`📡 Forwarding request to path: /${path}`);

    const proxy = createProxyMiddleware({
      target: process.env.TARGET_URL,
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        "^/api/proxy": `/${path}`,
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader("Authorization", `Bearer ${zeissIdToken}`);
        console.log("🔐 Added Authorization header with Zeiss token.");
      },
      onError: (err, req, res) => {
        console.error("❌ Proxy error:", err.message);
        res.status(500).json({ error: "Proxy request failed" });
      },
    });

    return proxy(req, res, () => {});
  } catch (err) {
    console.error("❌ Error handling request:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
