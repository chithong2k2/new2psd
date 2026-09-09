// In-memory project store (MVP - no database)
const projects = new Map();

function createProject(id) {
  const project = {
    id,
    status: 'CREATED', // CREATED | PSD_UPLOADED | ARTICLE_ANALYZED | CONTENT_SET | PREVIEW_READY
    psdFilename: null,
    psdFileSize: null,
    psdCompatible: null,
    incompatibilityReason: null,
    articleData: null,
    selectedImageUrl: null,
    caption: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.set(id, project);
  return project;
}

function getProject(id) {
  const p = projects.get(id);
  if (!p) throw new Error(`Project not found: ${id}`);
  return p;
}

function updateProject(id, updates) {
  const p = getProject(id);
  Object.assign(p, updates, { updatedAt: new Date().toISOString() });
  return p;
}

module.exports = { createProject, getProject, updateProject };
