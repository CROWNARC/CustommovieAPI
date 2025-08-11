// utils/urlMapping.js
// Template helper file where you can add rules to construct provider URLs from tokens

module.exports = {
  // Example: try to construct a URL from patterns like "G1 (ID)" or "Z1 (ID)".
  tryConstructFromToken(text) {
    if (!text) return null;
    // Look for patterns like: G1 (4J9UvBsaBI)
    const re = /([A-Za-z0-9_-]+)\s*\(\s*([A-Za-z0-9_-]+)\s*\)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const provider = m[1];
      const id = m[2];
      // Add rules below based on provider token
      if (/^G1$/i.test(provider)) {
        // Example mapping (UNCONFIRMED): map G1 -> short.icu
        return `https://short.icu/${id}`;
      }
      if (/^Z1$/i.test(provider)) {
        return `https://zoro.rpmplay.xyz/${id}`;
      }
      // add more provider rules as needed
    }
    return null;
  }
};
