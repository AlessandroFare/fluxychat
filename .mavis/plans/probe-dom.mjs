// Probe whether Node 18+ has DOMParser/XMLSerializer available globally
// (Workers runtime does — it's how the rest of the code parses XML).
const xml = '<a xmlns="urn:test"><b x="1">hi</b></a>';
try {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  console.log("DOMParser works:", new XMLSerializer().serializeToString(doc.documentElement));
} catch (e) {
  console.log("DOMParser NOT available:", e.message);
}
