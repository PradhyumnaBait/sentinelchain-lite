/**
 * Optional Vision AI adapter placeholder.
 * Can be connected to Google Cloud Vision or Vertex Vision.
 */

async function detectRoadHazardsFromImage() {
  return {
    enabled: false,
    hazardDetected: false,
    hazardType: null,
    confidence: 0,
    note: "Vision hazard detection is optional and not configured.",
  };
}

module.exports = {
  detectRoadHazardsFromImage,
};
