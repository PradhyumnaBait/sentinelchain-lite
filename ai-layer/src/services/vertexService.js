/**
 * Lightweight Vertex AI orchestration adapter.
 * For MVP, this provides an integration seam and metadata.
 */

function getVertexConfig() {
  return {
    enabled: Boolean(process.env.VERTEX_PROJECT_ID && process.env.VERTEX_LOCATION),
    projectId: process.env.VERTEX_PROJECT_ID || null,
    location: process.env.VERTEX_LOCATION || null,
    agentBuilderAppId: process.env.VERTEX_AGENT_BUILDER_APP_ID || null,
  };
}

function attachVertexMetadata(result, stage) {
  return {
    ...result,
    orchestration: {
      provider: "vertex-ai",
      stage,
      config: getVertexConfig(),
    },
  };
}

module.exports = {
  getVertexConfig,
  attachVertexMetadata,
};
