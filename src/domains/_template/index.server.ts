import { templateManifest } from "./manifest";
import { createTemplateDefinition, templateResultBinding } from "./presenter";
export const templateDomain = { ...createTemplateDefinition(templateManifest), resultBindings: [templateResultBinding] };
